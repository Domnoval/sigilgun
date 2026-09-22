#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (portableError) {
    if (!process.env.SIGILGUN_PLAYWRIGHT) throw portableError;
    return require(process.env.SIGILGUN_PLAYWRIGHT);
  }
}

const { chromium } = loadPlaywright();
const tests = [];
const test = (name, run) => tests.push({ name, run });
let browser;
let baseUrl;

function startServer() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function openApp(options = {}) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: options.viewport || { width: 1180, height: 820 },
    deviceScaleFactor: options.deviceScaleFactor || 1,
    hasTouch: !!options.hasTouch,
    isMobile: !!options.isMobile,
  });
  const page = await context.newPage();
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForFunction(
    () => document.body.classList.contains('studio-ready') && !!window.SigilStudio?.getState(),
  );
  return { context, page, dialogs };
}

async function withApp(run, options) {
  const app = await openApp(options);
  try {
    return await run(app.page, app.dialogs);
  } finally {
    await app.context.close();
  }
}

async function prepareCanvas(page) {
  await page.evaluate(() => {
    const options = {
      showGrid: false,
      collide: 'off',
      scale: 46,
      brushR: 42,
      dens: 7,
      bg: '#3f2824',
      ink: '#26beb0',
    };
    for (const [key, value] of Object.entries(options)) window.SigilStudio.setOption(key, value);
  });
  await page.waitForTimeout(30);
}

async function openDialog(page, opener, dialog) {
  const target = page.locator(dialog);
  if (!(await target.evaluate(element => element.open))) {
    await page.locator(opener).click();
    await target.waitFor({ state: 'visible' });
  }
}

async function closeDialog(page, dialog) {
  const target = page.locator(dialog);
  if (await target.evaluate(element => element.open)) {
    await page.locator(`${dialog}Close`).click();
    await poll(async () => !(await target.evaluate(element => element.open)), `${dialog} did not close`);
  }
}

async function drawAt(page, xFraction, yFraction = 0.5, touch = false) {
  const canvas = page.locator('#cv');
  const box = await canvas.boundingBox();
  assert(box && box.width > 20 && box.height > 20, 'canvas must have a usable hit area');
  const x = box.x + box.width * xFraction;
  const y = box.y + box.height * yFraction;
  if (touch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(Math.min(box.x + box.width - 3, x + Math.max(12, box.width * 0.035)), y + 4, {
      steps: 4,
    });
    await page.mouse.up();
  }
  await page.waitForTimeout(60);
}

async function canvasPixels(page) {
  return page.locator('#cv').evaluate(canvas => {
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    const teal = [0, 0, 0];
    const magenta = [0, 0, 0];
    const changed = [0, 0, 0];
    const step = width * height > 1600000 ? 3 : 2;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const a = data[offset + 3];
        if (a < 20) continue;
        const region = Math.min(2, Math.floor((x / width) * 3));
        if (g - r > 38 && b - r > 28) teal[region]++;
        if (r - g > 45 && b - g > 20) magenta[region]++;
        const distance = Math.abs(r - 63) + Math.abs(g - 40) + Math.abs(b - 36);
        if (distance > 75) changed[region]++;
      }
    }
    return { width, height, teal, magenta, changed };
  });
}

async function poll(check, message, timeout = 4000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    last = await check();
    if (last) return last;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`${message}; last=${JSON.stringify(last)}`);
}

async function waitForPixels(page, selector, threshold = 15) {
  return poll(async () => {
    const summary = await canvasPixels(page);
    return selector(summary) > threshold ? summary : null;
  }, 'canvas pixels did not reach the expected state');
}

async function download(page, selector) {
  const isExport = ['#btnExport', '#btnSVG', '#btnSave'].includes(selector);
  if (isExport) await openDialog(page, '#exportOpen', '#exportDialog');
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const result = await pending;
  const file = await result.path();
  assert(file, `download ${result.suggestedFilename()} has no local path`);
  const value = { name: result.suggestedFilename(), buffer: fs.readFileSync(file) };
  if (isExport) await closeDialog(page, '#exportDialog');
  return value;
}

async function loadProject(page, project, filename = 'fixture.sigil.json') {
  await page.locator('#fileIn').setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
}

async function parseSvg(page, buffer) {
  return page.evaluate(xml => {
    const documentNode = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const parserErrors = documentNode.querySelectorAll('parsererror').length;
    const root = documentNode.documentElement;
    const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
    const layerNames = [...documentNode.querySelectorAll('g[data-layer]')].map(node =>
      node.getAttribute('data-layer'),
    );
    const translations = [...documentNode.querySelectorAll('g[data-layer] > g[transform]')]
      .map(node => node.getAttribute('transform') || '')
      .map(value => value.match(/translate\(\s*(-?[\d.]+)/))
      .filter(Boolean)
      .map(match => Number(match[1]));
    return {
      parserErrors,
      rootName: root.localName,
      viewBox,
      layerNames,
      translations,
      images: documentNode.querySelectorAll('image').length,
      paths: documentNode.querySelectorAll('path').length,
    };
  }, buffer.toString('utf8'));
}

async function decodePng(page, buffer) {
  return page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const teal = [0, 0, 0];
    const magenta = [0, 0, 0];
    const step = canvas.width * canvas.height > 2500000 ? 4 : 3;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const offset = (y * canvas.width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const region = Math.min(2, Math.floor((x / canvas.width) * 3));
        if (g - r > 38 && b - r > 28) teal[region]++;
        if (r - g > 45 && b - g > 20) magenta[region]++;
      }
    }
    return { width: canvas.width, height: canvas.height, teal, magenta };
  }, buffer.toString('base64'));
}

async function renameActiveLayer(page, name) {
  await openDialog(page, '#layersOpen', '#layersDialog');
  const input = page.locator('.layer-row.active .ly-name');
  await input.fill(name);
  await input.press('Tab');
}

test('drawing survives a real viewport resize', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await drawAt(page, 0.24);
    const before = await waitForPixels(page, pixels => pixels.teal[0]);
    const stageWidth = await page.locator('#stage').evaluate(stage => stage.getBoundingClientRect().width);
    await page.setViewportSize({ width: 1360, height: 740 });
    await page.waitForFunction(
      oldWidth => Math.abs(document.querySelector('#stage').getBoundingClientRect().width - oldWidth) > 20,
      stageWidth,
    );
    const after = await waitForPixels(page, pixels => pixels.teal.reduce((a, b) => a + b, 0));
    assert.equal(after.width, before.width, 'viewport resize changed the document width');
    assert.equal(after.height, before.height, 'viewport resize changed the document height');
    assert(after.teal.reduce((a, b) => a + b, 0) > 15, 'resize erased the drawing');
  }));

test("typing 'c' in a text input does not clear the canvas", () =>
  withApp(async page => {
    await prepareCanvas(page);
    await drawAt(page, 0.24);
    const before = await waitForPixels(page, pixels => pixels.teal[0]);
    await openDialog(page, '#symbolsOpen', '#symbolsDialog');
    const input = page.locator('#anchorIn');
    await input.focus();
    await page.keyboard.type('c');
    const after = await canvasPixels(page);
    assert(after.teal[0] >= before.teal[0] * 0.8, 'the canvas clear shortcut fired inside an input');
    await closeDialog(page, '#symbolsDialog');
  }));

test('vector project save/load keeps old and new marks in PNG and SVG exports', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await drawAt(page, 0.2);
    await waitForPixels(page, pixels => pixels.teal[0]);

    const saved = await download(page, '#btnSave');
    const project = JSON.parse(saved.buffer.toString('utf8'));
    assert.equal(project.v, 2, 'new saves must use the vector project schema');
    assert(Array.isArray(project.stamps) && project.stamps.length > 0, 'save omitted vector stamps');
    assert(Array.isArray(project.layers) && project.layers.length > 0, 'save omitted layers');
    assert(project.width > 0 && project.height > 0, 'save omitted source dimensions');

    await page.evaluate(() => window.SigilStudio.clear());
    await loadProject(page, project, saved.name);
    await waitForPixels(page, pixels => pixels.teal[0]);
    await drawAt(page, 0.8);
    await waitForPixels(page, pixels => pixels.teal[2]);

    const png = await download(page, '#btnExport');
    const pngPixels = await decodePng(page, png.buffer);
    assert(pngPixels.teal[0] > 15, 'PNG lost the mark loaded from the project');
    assert(pngPixels.teal[2] > 15, 'PNG lost the mark drawn after loading');

    const svg = await download(page, '#btnSVG');
    const xml = await parseSvg(page, svg.buffer);
    assert.equal(xml.parserErrors, 0, 'SVG export is not valid XML');
    assert.equal(xml.rootName, 'svg');
    assert(xml.paths >= 2, 'SVG did not retain both vector marks');
    const width = xml.viewBox[2];
    assert(xml.translations.some(x => x < width * 0.4), 'SVG lost the loaded left-side mark');
    assert(xml.translations.some(x => x > width * 0.6), 'SVG lost the newly drawn right-side mark');
  }));

test('legacy raster projects stay intact when new vector marks are exported', () =>
  withApp(async page => {
    await prepareCanvas(page);
    const fixture = await page.evaluate(() => {
      const source = document.createElement('canvas');
      const stage = document.querySelector('#stage').getBoundingClientRect();
      source.width = Math.max(320, Math.round(stage.width));
      source.height = Math.max(320, Math.round(stage.height));
      const context = source.getContext('2d');
      context.fillStyle = '#ff35bb';
      context.fillRect(source.width * 0.08, source.height * 0.34, source.width * 0.18, source.height * 0.3);
      return {
        data: source.toDataURL('image/png'),
        width: source.width,
        height: source.height,
      };
    });
    const settings = {
      brush: 'spray', chaos: 0, scale: 46, gap: 0, brushR: 42, dens: 7, op: 1,
      bg: '#3f2824', ink: '#26beb0', set: 'all', lens: 'none', rays: false,
      noRepeat: false, bimodal: false, snap: 'off', anchors: [], anchorPower: 0,
      collide: 'off', blend: 'source-over', field: 'off', fieldD: 50, showGrid: false,
      tex: 'flat', accent: '#ff5eb1', accRate: 0, duo: false, bgMode: 'plain', atlas: false,
    };
    const legacy = {
      v: 1,
      seed: 137,
      S: settings,
      layers: [{
        name: 'Legacy paint', visible: true, opacity: 1, blend: 'source-over', data: fixture.data,
      }],
    };
    await loadProject(page, legacy, 'legacy-v1.sigil.json');
    await waitForPixels(page, pixels => pixels.magenta[0]);
    await drawAt(page, 0.8);
    await waitForPixels(page, pixels => pixels.teal[2]);

    const png = await download(page, '#btnExport');
    const pngPixels = await decodePng(page, png.buffer);
    assert(pngPixels.magenta[0] > 15, 'PNG lost the legacy raster base');
    assert(pngPixels.teal[2] > 15, 'PNG lost the new vector mark');

    const svg = await download(page, '#btnSVG');
    const xml = await parseSvg(page, svg.buffer);
    assert.equal(xml.parserErrors, 0, 'legacy SVG export is not valid XML');
    assert(xml.images > 0, 'SVG lost the embedded legacy raster base');
    assert(xml.paths > 0, 'SVG lost vector marks drawn after legacy load');
  }));

test('layer clear, visibility, reorder and delete affect the real exports', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await renameActiveLayer(page, 'Base');
    await closeDialog(page, '#layersDialog');
    await drawAt(page, 0.2);
    await waitForPixels(page, pixels => pixels.teal[0]);

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('#layAdd').click();
    await renameActiveLayer(page, 'Top');
    await closeDialog(page, '#layersDialog');
    await drawAt(page, 0.8);
    await waitForPixels(page, pixels => pixels.teal[2]);

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('.layer-row.active .ly-clear').click();
    await closeDialog(page, '#layersDialog');
    await poll(async () => (await canvasPixels(page)).teal[2] < 10, 'clearing Top left its marks visible');
    assert((await canvasPixels(page)).teal[0] > 15, 'clearing Top damaged Base');
    await drawAt(page, 0.8);
    await waitForPixels(page, pixels => pixels.teal[2]);

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('.layer-row.active .ly-eye').uncheck();
    await closeDialog(page, '#layersDialog');
    await poll(async () => (await canvasPixels(page)).teal[2] < 10, 'hidden Top stayed visible');
    const hiddenPng = await decodePng(page, (await download(page, '#btnExport')).buffer);
    assert(hiddenPng.teal[0] > 15, 'hidden-layer PNG lost visible Base');
    assert(hiddenPng.teal[2] < 10, 'hidden-layer PNG included Top');
    const hiddenSvg = await parseSvg(page, (await download(page, '#btnSVG')).buffer);
    assert(hiddenSvg.layerNames.includes('Base'), 'hidden-layer SVG lost visible Base');
    assert(!hiddenSvg.layerNames.includes('Top'), 'hidden-layer SVG included Top');

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('.layer-row.active .ly-eye').check();
    await closeDialog(page, '#layersDialog');
    await waitForPixels(page, pixels => pixels.teal[2]);
    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('#layUp').click();
    const upOrder = await page.locator('.layer-row .ly-name').evaluateAll(inputs =>
      inputs.map(input => input.value),
    );
    assert.deepEqual(upOrder, ['Top', 'Base']);
    await closeDialog(page, '#layersDialog');
    const reordered = await parseSvg(page, (await download(page, '#btnSVG')).buffer);
    assert.deepEqual(reordered.layerNames.slice(0, 2), ['Top', 'Base']);

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('#layDn').click();
    await page.locator('#layDel').click();
    assert.equal(await page.locator('.layer-row').count(), 1, 'delete did not remove Top');
    await closeDialog(page, '#layersDialog');
    await poll(async () => (await canvasPixels(page)).teal[2] < 10, 'deleted Top stayed visible');
    assert((await canvasPixels(page)).teal[0] > 15, 'deleting Top damaged Base');
  }));

test('undo and redo restore a completed pointer stroke', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await drawAt(page, 0.22);
    const painted = await waitForPixels(page, pixels => pixels.teal[0]);
    await page.keyboard.press('Control+z');
    await poll(
      async () => (await canvasPixels(page)).teal[0] < Math.max(10, painted.teal[0] * 0.15),
      'undo did not remove the completed stroke',
    );
    await page.keyboard.press('Control+Shift+z');
    await waitForPixels(page, pixels => pixels.teal[0], Math.max(15, painted.teal[0] * 0.5));
  }));

test('undo and redo keep the symbol cabinet selection in sync', () =>
  withApp(async page => {
    await openDialog(page, '#symbolsOpen', '#symbolsDialog');
    const tile = page.locator('.symbol-tile').first();
    const symbol = await tile.getAttribute('data-symbol');
    assert(symbol, 'symbol cabinet is empty');
    await tile.click();
    await poll(
      async () => !(await page.locator('#symbolsDialog').evaluate(dialog => dialog.open)),
      'symbol cabinet did not close after choosing a symbol',
    );
    assert.equal((await page.evaluate(() => window.SigilStudio.getState())).selectedSymbol, symbol);

    await page.keyboard.press('Control+z');
    assert.equal((await page.evaluate(() => window.SigilStudio.getState())).selectedSymbol, null);
    await openDialog(page, '#symbolsOpen', '#symbolsDialog');
    assert.equal(
      await page.locator(`.symbol-tile[data-symbol="${symbol}"]`).getAttribute('aria-pressed'),
      'false',
    );
    await closeDialog(page, '#symbolsDialog');

    await page.keyboard.press('Control+Shift+z');
    assert.equal((await page.evaluate(() => window.SigilStudio.getState())).selectedSymbol, symbol);
    await openDialog(page, '#symbolsOpen', '#symbolsDialog');
    assert.equal(
      await page.locator(`.symbol-tile[data-symbol="${symbol}"]`).getAttribute('aria-pressed'),
      'true',
    );
    await closeDialog(page, '#symbolsDialog');
  }));

test('local recovery offers and restores the last painted session', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await drawAt(page, 0.24);
    const painted = await waitForPixels(page, pixels => pixels.teal[0]);
    await page.waitForFunction(() => !!localStorage.getItem('sigil-studio-recovery-v2'));

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => document.body.classList.contains('studio-ready') && !!window.SigilStudio?.getState(),
    );
    assert.equal((await page.evaluate(() => window.SigilStudio.getState())).hasArtwork, false);
    await page.locator('#resumeStrip').waitFor({ state: 'visible' });
    await page.locator('#resumeLast').click();
    await poll(
      async () => (await page.evaluate(() => window.SigilStudio.getState())).hasArtwork,
      'recovery did not restore the project state',
    );
    const restored = await waitForPixels(page, pixels => pixels.teal[0]);
    assert(restored.teal[0] >= painted.teal[0] * 0.8, 'recovery lost painted pixels');
  }));

test('mobile opens with a full-width stage and accepts a real touch pointer', () =>
  withApp(async page => {
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('#stage').getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        stageWidth: stage.width,
        openDialogs: document.querySelectorAll('dialog[open]').length,
        toolsVisible: !!document.querySelector('.play-dock')?.getClientRects().length,
        expandedControls: [...document.querySelectorAll('[aria-haspopup="dialog"]')]
          .filter(button => button.getAttribute('aria-expanded') === 'true').length,
      };
    });
    assert(layout.toolsVisible, 'mobile drawing tools are missing');
    assert.equal(layout.openDialogs, 0, 'mobile controls should start closed');
    assert.equal(layout.expandedControls, 0, 'a mobile control claims to start expanded');
    assert(
      layout.stageWidth >= layout.viewport * 0.8,
      `mobile canvas is only ${layout.stageWidth}px of ${layout.viewport}px`,
    );

    await prepareCanvas(page);
    await drawAt(page, 0.5, 0.5, true);
    const state = await page.evaluate(() => window.SigilStudio.getState());
    assert(state.stamps > 0, 'touch pointer did not create a mark');
    const pixels = await waitForPixels(
      page,
      value => value.teal.reduce((a, b) => a + b, 0),
      0,
    );
    assert(pixels.teal.reduce((a, b) => a + b, 0) > 0, 'touch mark did not reach canvas pixels');
  }, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  }));

(async () => {
  const { server, url } = await startServer();
  baseUrl = url;
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'sigilgun-smoke-'));
  let failures = 0;
  try {
    const launch = { headless: true, downloadsPath: artifacts };
    if (process.env.SIGILGUN_CHROMIUM) launch.executablePath = process.env.SIGILGUN_CHROMIUM;
    browser = await chromium.launch(launch);
    for (const entry of tests) {
      const started = Date.now();
      try {
        await entry.run();
        console.log(`PASS ${entry.name} (${Date.now() - started}ms)`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${entry.name}`);
        console.error(error && error.stack ? error.stack : error);
      }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(artifacts, { recursive: true, force: true });
  }
  if (failures) {
    console.error(`${failures}/${tests.length} smoke tests failed`);
    process.exitCode = 1;
  } else {
    console.log(`${tests.length}/${tests.length} smoke tests passed`);
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
