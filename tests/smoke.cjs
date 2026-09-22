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

async function drawStraightPath(page, moveEvents) {
  const box = await page.locator('#cv').boundingBox();
  assert(box && box.width > 20 && box.height > 20, 'canvas must have a usable hit area');
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.18, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.82, y, { steps: moveEvents });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

async function tapAt(page, xFraction, yFraction = 0.5) {
  const box = await page.locator('#cv').boundingBox();
  assert(box && box.width > 20 && box.height > 20, 'canvas must have a usable hit area');
  const x = box.x + box.width * xFraction;
  const y = box.y + box.height * yFraction;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
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

async function apiDownload(page, method, ...args) {
  const pending = page.waitForEvent('download');
  await page.evaluate(({ name, values }) => window.SigilStudio[name](...values), {
    name: method,
    values: args,
  });
  const result = await pending;
  const file = await result.path();
  assert(file, `download ${result.suggestedFilename()} has no local path`);
  return { name: result.suggestedFilename(), buffer: fs.readFileSync(file) };
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
    const translations = [...documentNode.querySelectorAll('g[id^="layer-art-"] > g[transform]')]
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
      filters: [...documentNode.querySelectorAll('filter')].map(node => node.id),
      filterUses: [...documentNode.querySelectorAll('use[filter]')]
        .map(node => node.getAttribute('filter')),
      uvMarks: [...documentNode.querySelectorAll('g[data-uv-ink]')].map(node => ({
        reactive: node.getAttribute('data-uv-ink') === 'true',
        filter: node.getAttribute('filter') || '',
      })),
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

async function comparePngToCanvas(page, buffer) {
  return page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const source = document.querySelector('#cv');
    if (bitmap.width !== source.width || bitmap.height !== source.height) {
      return {
        mismatch: Infinity,
        png: [bitmap.width, bitmap.height],
        canvas: [source.width, source.height],
      };
    }
    const decoded = document.createElement('canvas');
    decoded.width = bitmap.width;
    decoded.height = bitmap.height;
    const decodedContext = decoded.getContext('2d');
    decodedContext.drawImage(bitmap, 0, 0);
    const exported = decodedContext.getImageData(0, 0, decoded.width, decoded.height).data;
    const current = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
    let mismatch = 0;
    let maxChannelDelta = 0;
    for (let index = 0; index < current.length; index++) {
      const delta = Math.abs(current[index] - exported[index]);
      if (delta) mismatch++;
      if (delta > maxChannelDelta) maxChannelDelta = delta;
    }
    return {
      mismatch,
      maxChannelDelta,
      png: [bitmap.width, bitmap.height],
      canvas: [source.width, source.height],
    };
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

test('a straight stroke is independent of pointer event rate', async () => {
  async function capture(moveEvents) {
    return withApp(async page => {
      await page.evaluate(() => {
        const options = {
          brush: 'finetip', showGrid: false, collide: 'off', scale: 42, brushR: 70,
          dens: 9, gap: 0, chaos: 0, rays: false, noRepeat: false,
        };
        for (const [key, value] of Object.entries(options)) window.SigilStudio.setOption(key, value);
        window.SigilStudio.selectSymbol(window.SIGIL_LIB[0].n);
      });
      await drawStraightPath(page, moveEvents);
      return page.evaluate(() => window.SigilStudio.getProject());
    });
  }

  const sparse = await capture(5);
  const dense = await capture(50);
  assert(sparse.stamps.length > 3, 'stroke fixture did not create enough marks');
  assert.equal(dense.stamps.length, sparse.stamps.length, 'event rate changed the mark count');
  assert.equal(dense.rngState, sparse.rngState, 'event rate consumed a different random sequence');
  for (let index = 0; index < sparse.stamps.length; index++) {
    const a = sparse.stamps[index];
    const b = dense.stamps[index];
    assert.equal(b.n, a.n, `mark ${index} changed symbol`);
    assert(Math.abs(b.x - a.x) < 0.1, `mark ${index} drifted horizontally`);
    assert(Math.abs(b.y - a.y) < 0.1, `mark ${index} drifted vertically`);
    assert(Math.abs(b.s - a.s) < 0.0001, `mark ${index} changed size`);
  }
});

test('brush footprint previews scale, scatter, ink and the selected mark without entering exports', () =>
  withApp(async page => {
    await prepareCanvas(page);
    const canvasBox = await page.locator('#cv').boundingBox();
    assert(canvasBox, 'canvas has no pointer target');
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const cursor = page.locator('#brushCursor');
    await poll(
      async () => cursor.evaluate(element => element.classList.contains('visible')),
      'brush footprint did not appear over the canvas',
    );
    const readPreview = () => cursor.evaluate(element => ({
      footprint: parseFloat(element.style.getPropertyValue('--footprint-size')),
      mark: parseFloat(element.style.getPropertyValue('--mark-size')),
      ink: element.style.getPropertyValue('--ink-preview').trim().toLowerCase(),
      symbol: element.dataset.symbol || '',
      glyphs: element.querySelectorAll('.brush-mark svg').length,
    }));
    const generic = await readPreview();
    assert(generic.footprint > 8, 'generic brush footprint has no useful size');
    assert(generic.mark > 4, 'generic brush mark has no useful size');
    assert.equal(generic.symbol, '', 'generic brush unexpectedly previews a selected symbol');
    assert.equal(generic.glyphs, 0, 'generic brush should use its brush silhouette');

    await page.evaluate(() => window.SigilStudio.setOption('scale', 120));
    const scaled = await poll(async () => {
      const value = await readPreview();
      return value.mark > generic.mark * 1.8 ? value : null;
    }, 'brush mark preview did not respond to scale');

    await page.evaluate(() => window.SigilStudio.setOption('brushR', 180));
    const scattered = await poll(async () => {
      const value = await readPreview();
      return value.footprint > scaled.footprint * 1.25 ? value : null;
    }, 'brush footprint did not respond to scatter radius');
    assert(scattered.footprint > scattered.mark, 'scatter footprint collapsed onto the mark preview');

    await page.evaluate(() => window.SigilStudio.setOption('ink', '#ff35bb'));
    await poll(
      async () => (await readPreview()).ink === '#ff35bb',
      'brush preview did not adopt the current ink',
    );

    const selected = await page.evaluate(() => {
      const name = window.SIGIL_LIB[0].n;
      window.SigilStudio.selectSymbol(name);
      return name;
    });
    await poll(async () => {
      const value = await readPreview();
      return value.symbol === selected && value.glyphs === 1 ? value : null;
    }, 'selected symbol did not replace the generic brush silhouette');

    const visibleSvg = await page.evaluate(() => window.SigilStudio.getSVG());
    const visiblePng = await decodePng(page, (await apiDownload(page, 'exportPNG', 1)).buffer);
    await page.mouse.move(1, 1);
    await poll(
      async () => cursor.evaluate(element => !element.classList.contains('visible')),
      'brush footprint did not leave with the pointer',
    );
    const hiddenSvg = await page.evaluate(() => window.SigilStudio.getSVG());
    const hiddenPng = await decodePng(page, (await apiDownload(page, 'exportPNG', 1)).buffer);
    assert.equal(hiddenSvg, visibleSvg, 'SVG export included the live brush footprint');
    assert.deepEqual(hiddenPng, visiblePng, 'PNG export included the live brush footprint');
  }));

test('UV light fluoresces only reactive marks and restores exact daylight artwork', () =>
  withApp(async page => {
    await page.evaluate(() => {
      const options = {
        brush: 'finetip', showGrid: false, collide: 'off', scale: 180, brushR: 1,
        dens: 8, gap: 0, chaos: 0, rays: false, tex: 'flat', op: 1,
        field: 'off', bgMode: 'plain', bg: '#14110c', uvLight: false,
      };
      for (const [key, value] of Object.entries(options)) window.SigilStudio.setOption(key, value);
      window.SigilStudio.selectSymbol(window.SIGIL_LIB[0].n);
      window.SigilStudio.selectInk('#ff2e7e', false);
    });
    await tapAt(page, 0.25);
    await page.evaluate(() => window.SigilStudio.selectInk('#ff2e7e', true));
    await tapAt(page, 0.75);

    const daylightProject = await page.evaluate(() => window.SigilStudio.getProject());
    assert.equal(daylightProject.settings.uvLight, false, 'UV light should default off');
    assert.equal(daylightProject.settings.uvInk, true, 'reactive ink selection was not retained');
    assert.equal(daylightProject.stamps.length, 2, 'UV fixture should contain two real pointer marks');
    assert.deepEqual(
      daylightProject.stamps.map(stamp => ({ ink: stamp.ink.toLowerCase(), uvInk: stamp.uvInk })),
      [
        { ink: '#ff2e7e', uvInk: false },
        { ink: '#ff2e7e', uvInk: true },
      ],
      'same pigment did not retain independent regular and UV identities',
    );
    await page.locator('#cv').evaluate(canvas => {
      window.__uvDaylight = new Uint8ClampedArray(
        canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
      );
    });

    const daylightSvg = await parseSvg(
      page,
      Buffer.from(await page.evaluate(() => window.SigilStudio.getSVG())),
    );
    assert.deepEqual(daylightSvg.uvMarks.map(mark => mark.reactive), [false, true]);
    assert.equal(
      daylightSvg.filters.some(id => id.startsWith('uv-glow')),
      false,
      'daylight SVG contains a UV glow filter',
    );

    await page.locator('#uvLightToggle').click();
    await poll(
      async () => (await page.evaluate(() => window.SigilStudio.getState())).settings.uvLight,
      'persistent UV switch did not turn on the light',
    );
    assert.equal(await page.locator('#uvLightToggle').getAttribute('aria-pressed'), 'true');
    const litProject = await page.evaluate(() => window.SigilStudio.getProject());
    assert.equal(litProject.rngState, daylightProject.rngState, 'UV light consumed random state');
    assert.deepEqual(litProject.stamps, daylightProject.stamps, 'UV light mutated saved mark geometry');

    const fluorescence = await page.locator('#cv').evaluate((canvas, marks) => {
      const before = window.__uvDaylight;
      const { width, height } = canvas;
      const after = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      const roomDelta =
        after[0] + after[1] + after[2] -
        before[0] - before[1] - before[2];
      let regularExcess = 0;
      let reactiveExcess = 0;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const regularRadius = Math.max(30, marks[0].s * 1.4);
          const reactiveRadius = Math.max(30, marks[1].s * 1.4);
          const inRegular = Math.hypot(x - marks[0].x, y - marks[0].y) <= regularRadius;
          const inReactive = Math.hypot(x - marks[1].x, y - marks[1].y) <= reactiveRadius;
          if (!inRegular && !inReactive) continue;
          const offset = (y * width + x) * 4;
          const beforeLight = before[offset] + before[offset + 1] + before[offset + 2];
          const afterLight = after[offset] + after[offset + 1] + after[offset + 2];
          if (afterLight - beforeLight > roomDelta + 20) {
            if (inRegular) regularExcess++;
            if (inReactive) reactiveExcess++;
          }
        }
      }
      return { roomDelta, regularExcess, reactiveExcess };
    }, daylightProject.stamps.map(stamp => ({ x: stamp.x, y: stamp.y, s: stamp.s })));
    assert(fluorescence.reactiveExcess > 30, 'reactive mark did not fluoresce under UV');
    assert(
      fluorescence.regularExcess < Math.max(3, fluorescence.reactiveExcess * 0.03),
      `same-color regular mark fluoresced as if it were UV reactive: ${JSON.stringify(fluorescence)}`,
    );

    const litSvg = await parseSvg(
      page,
      Buffer.from(await page.evaluate(() => window.SigilStudio.getSVG())),
    );
    const uvFilter = litSvg.filters.find(id => id.startsWith('uv-glow'));
    assert(uvFilter, 'lit SVG omitted its UV glow effect');
    const regularMark = litSvg.uvMarks.find(mark => !mark.reactive);
    const reactiveMark = litSvg.uvMarks.find(mark => mark.reactive);
    assert.equal(regularMark.filter, '', 'regular same-color mark received the UV filter');
    assert.equal(reactiveMark.filter, `url(#${uvFilter})`, 'reactive mark did not receive the UV filter');
    const litPng = await apiDownload(page, 'exportPNG', 1);
    assert.deepEqual(
      await comparePngToCanvas(page, litPng.buffer),
      { mismatch: 0, maxChannelDelta: 0, png: [1200, 900], canvas: [1200, 900] },
      'lit PNG does not match the rendered UV canvas',
    );

    await page.locator('#uvLightToggle').click();
    await poll(
      async () => !(await page.evaluate(() => window.SigilStudio.getState())).settings.uvLight,
      'persistent UV switch did not restore daylight',
    );
    assert.equal(await page.locator('#uvLightToggle').getAttribute('aria-pressed'), 'false');
    const restored = await page.locator('#cv').evaluate(canvas => {
      const before = window.__uvDaylight;
      const after = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let mismatch = 0;
      for (let index = 0; index < after.length; index++) if (after[index] !== before[index]) mismatch++;
      return mismatch;
    });
    assert.equal(restored, 0, 'switching UV off did not restore the exact daylight canvas bytes');
    assert.deepEqual(
      await page.evaluate(() => window.SigilStudio.getProject()),
      daylightProject,
      'UV on/off cycle changed coordinates, RNG or project state',
    );
    const restoredSvg = await page.evaluate(() => window.SigilStudio.getSVG());
    assert(!restoredSvg.includes('id="uv-glow'), 'daylight SVG retained the UV effect');
    const daylightPng = await apiDownload(page, 'exportPNG', 1);
    assert.deepEqual(
      await comparePngToCanvas(page, daylightPng.buffer),
      { mismatch: 0, maxChannelDelta: 0, png: [1200, 900], canvas: [1200, 900] },
      'daylight PNG does not match the restored canvas',
    );
  }));

test('UV ink and light survive project save, load and recovery while old projects default off', () =>
  withApp(async page => {
    await page.evaluate(() => {
      const options = {
        brush: 'finetip', showGrid: false, collide: 'off', scale: 120,
        brushR: 1, chaos: 0, rays: false, tex: 'flat', bgMode: 'plain',
      };
      for (const [key, value] of Object.entries(options)) window.SigilStudio.setOption(key, value);
      window.SigilStudio.selectSymbol(window.SIGIL_LIB[0].n);
      window.SigilStudio.selectInk('#8fffbe', true);
      window.SigilStudio.setOption('uvLight', true);
    });
    await tapAt(page, 0.5);

    const saved = await download(page, '#btnSave');
    const project = JSON.parse(saved.buffer.toString('utf8'));
    assert.equal(project.settings.uvInk, true, 'project save lost the reactive-ink selection');
    assert.equal(project.settings.uvLight, true, 'project save lost the UV-light state');
    assert(project.stamps.length > 0, 'UV persistence fixture contains no marks');
    assert(project.stamps.every(stamp => stamp.uvInk === true), 'project save lost a mark UV flag');
    await poll(async () => page.evaluate(() => {
      const value = localStorage.getItem('sigil-studio-recovery-v2');
      if (!value) return false;
      const recovery = JSON.parse(value);
      return recovery.settings?.uvInk === true &&
        recovery.settings?.uvLight === true &&
        recovery.stamps?.every(stamp => stamp.uvInk === true);
    }), 'local recovery did not retain the UV flags');

    await page.evaluate(() => {
      window.SigilStudio.selectInk('#8fffbe', false);
      window.SigilStudio.setOption('uvLight', false);
      window.SigilStudio.clear();
    });
    await loadProject(page, project, saved.name);
    const loaded = await poll(async () => {
      const state = await page.evaluate(() => window.SigilStudio.getState());
      return !state.busy && state.settings.uvLight && state.settings.uvInk ? state : null;
    }, 'project load did not restore the UV settings');
    assert.equal(loaded.stamps, project.stamps.length);
    assert(
      (await page.evaluate(() => window.SigilStudio.getProject())).stamps
        .every(stamp => stamp.uvInk === true),
      'project load did not restore reactive marks',
    );

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      () => document.body.classList.contains('studio-ready') && !!window.SigilStudio?.getState(),
    );
    const fresh = await page.evaluate(() => window.SigilStudio.getState());
    assert.equal(fresh.settings.uvInk, false, 'fresh session inherited UV ink before recovery');
    assert.equal(fresh.settings.uvLight, false, 'fresh session inherited UV light before recovery');
    await page.locator('#resumeStrip').waitFor({ state: 'visible' });
    await page.locator('#resumeLast').click();
    const recovered = await poll(async () => {
      const state = await page.evaluate(() => window.SigilStudio.getState());
      return state.hasArtwork && state.settings.uvInk && state.settings.uvLight ? state : null;
    }, 'session recovery did not restore the UV state');
    assert.equal(recovered.stamps, project.stamps.length);
    assert(
      (await page.evaluate(() => window.SigilStudio.getProject())).stamps
        .every(stamp => stamp.uvInk === true),
      'session recovery did not restore reactive mark flags',
    );

    const legacy = structuredClone(project);
    delete legacy.settings.uvInk;
    delete legacy.settings.uvLight;
    for (const stamp of legacy.stamps) delete stamp.uvInk;
    const legacyLoaded = await page.evaluate(value => window.SigilStudio.load(value), legacy);
    assert.equal(legacyLoaded, true, 'old v2 project failed to load');
    const legacyState = await page.evaluate(() => window.SigilStudio.getState());
    assert.equal(legacyState.settings.uvInk, false, 'old project defaulted to reactive ink');
    assert.equal(legacyState.settings.uvLight, false, 'old project defaulted to UV light on');
    assert(
      (await page.evaluate(() => window.SigilStudio.getProject())).stamps
        .every(stamp => stamp.uvInk === false),
      'old project marks defaulted to reactive',
    );
    assert(
      !(await page.evaluate(() => window.SigilStudio.getSVG())).includes('id="uv-glow'),
      'old project unexpectedly exported a UV effect',
    );
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
    await page.locator('#layDn').click();
    const displayOrder = await page.locator('.layer-row .ly-name').evaluateAll(inputs =>
      inputs.map(input => input.value),
    );
    assert.deepEqual(displayOrder, ['Base', 'Top'], 'top-first layer list did not reflect send backward');
    await closeDialog(page, '#layersDialog');
    const reordered = await parseSvg(page, (await download(page, '#btnSVG')).buffer);
    assert.deepEqual(reordered.layerNames.slice(0, 2), ['Top', 'Base']);

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('#layUp').click();
    await page.locator('#layDel').click();
    assert.equal(await page.locator('.layer-row').count(), 1, 'delete did not remove Top');
    await closeDialog(page, '#layersDialog');
    await poll(async () => (await canvasPixels(page)).teal[2] < 10, 'deleted Top stayed visible');
    assert((await canvasPixels(page)).teal[0] > 15, 'deleting Top damaged Base');
  }));

test('optional layer shadow renders, persists, follows history and vanishes with a hidden layer', () =>
  withApp(async page => {
    await prepareCanvas(page);
    await page.evaluate(() => {
      const options = {
        bg: '#efe9dc', brush: 'finetip', scale: 112, brushR: 8, dens: 2,
        gap: 0, chaos: 0, rays: false, tex: 'flat', field: 'off',
      };
      for (const [key, value] of Object.entries(options)) window.SigilStudio.setOption(key, value);
      window.SigilStudio.selectSymbol(window.SIGIL_LIB[0].n);
    });
    await drawAt(page, 0.5, 0.5);
    await poll(
      async () => (await page.evaluate(() => window.SigilStudio.getState())).stamps > 0,
      'shadow fixture did not create artwork',
    );

    const defaultShadow = await page.evaluate(() => window.SigilStudio.getState().layers[0].shadow);
    assert.deepEqual(defaultShadow, { enabled: false, distance: 8, blur: 16, opacity: 0.3 });
    await page.locator('#cv').evaluate(canvas => {
      window.__shadowBaseline = new Uint8ClampedArray(
        canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
      );
    });

    await openDialog(page, '#layersOpen', '#layersDialog');
    assert.equal(await page.locator('#shadowEnabled').isChecked(), false);
    assert.equal(await page.locator('#shadowOptions').evaluate(element => element.hidden), true);
    await page.locator('#shadowEnabled').check();
    await poll(
      async () => (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow.enabled,
      'shadow checkbox did not update the active layer',
    );
    assert.equal(await page.locator('#shadowOptions').evaluate(element => element.hidden), false);
    await closeDialog(page, '#layersDialog');

    await page.evaluate(() => window.SigilStudio.undo());
    assert.equal(
      (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow.enabled,
      false,
      'undo did not remove the shadow toggle',
    );
    await page.evaluate(() => window.SigilStudio.redo());
    assert.equal(
      (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow.enabled,
      true,
      'redo did not restore the shadow toggle',
    );

    await page.evaluate(() => window.SigilStudio.setLayerShadow({
      enabled: true, distance: 48, blur: 18, opacity: 0.75,
    }));
    const configured = await page.evaluate(() => window.SigilStudio.getState().layers[0].shadow);
    assert.deepEqual(configured, { enabled: true, distance: 48, blur: 18, opacity: 0.75 });
    await openDialog(page, '#layersOpen', '#layersDialog');
    assert.equal(await page.locator('#shadowDistance').inputValue(), '48');
    assert.equal(await page.locator('#shadowBlur').inputValue(), '18');
    assert.equal(await page.locator('#shadowOpacity').inputValue(), '75');
    await closeDialog(page, '#layersDialog');

    const screenShadow = await page.locator('#cv').evaluate(canvas => {
      const before = window.__shadowBaseline;
      const { width, height } = canvas;
      const now = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let darkerBelow = 0;
      for (let y = Math.floor(height * 0.5); y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const offset = (y * width + x) * 4;
          const beforeLight = before[offset] + before[offset + 1] + before[offset + 2];
          const nowLight = now[offset] + now[offset + 1] + now[offset + 2];
          if (beforeLight - nowLight > 12) darkerBelow++;
        }
      }
      return darkerBelow;
    });
    assert(screenShadow > 20, 'enabled shadow did not darken pixels below the artwork');

    const shadowSvg = await parseSvg(
      page,
      Buffer.from(await page.evaluate(() => window.SigilStudio.getSVG())),
    );
    const shadowFilter = shadowSvg.filters.find(id => id.startsWith('layer-shadow-'));
    assert(shadowFilter, 'SVG export omitted the layer shadow filter');
    assert(
      shadowSvg.filterUses.includes(`url(#${shadowFilter})`),
      'SVG artwork does not reference its layer shadow filter',
    );

    await page.evaluate(() => window.SigilStudio.undo());
    assert.deepEqual(
      (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow,
      { enabled: true, distance: 8, blur: 16, opacity: 0.3 },
      'undo did not restore the prior shadow settings',
    );
    await page.evaluate(() => window.SigilStudio.redo());
    assert.deepEqual(
      (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow,
      configured,
      'redo did not restore the configured shadow',
    );

    const saved = await download(page, '#btnSave');
    const project = JSON.parse(saved.buffer.toString('utf8'));
    assert.deepEqual(project.layers[0].shadow, configured, 'project save omitted the layer shadow');
    await page.evaluate(() => window.SigilStudio.setLayerShadow({ enabled: false }));
    await loadProject(page, project, saved.name);
    await poll(async () => {
      const state = await page.evaluate(() => window.SigilStudio.getState());
      return !state.busy && state.layers[0].shadow.distance === 48 ? state : null;
    }, 'project load did not restore the saved shadow');
    assert.deepEqual(
      (await page.evaluate(() => window.SigilStudio.getState())).layers[0].shadow,
      configured,
    );

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('.layer-row.active .ly-eye').uncheck();
    await closeDialog(page, '#layersDialog');
    const hiddenSvg = await parseSvg(
      page,
      Buffer.from(await page.evaluate(() => window.SigilStudio.getSVG())),
    );
    assert.equal(hiddenSvg.layerNames.length, 0, 'hidden layer stayed in the SVG');
    assert.equal(hiddenSvg.filters.length, 0, 'hidden layer still cast an SVG shadow');
    const hiddenPixels = await page.locator('#cv').evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBackground = 0;
      for (let offset = 0; offset < data.length; offset += 16) {
        if (
          Math.abs(data[offset] - 239) +
          Math.abs(data[offset + 1] - 233) +
          Math.abs(data[offset + 2] - 220) > 3
        ) nonBackground++;
      }
      return nonBackground;
    });
    assert.equal(hiddenPixels, 0, 'hidden layer still left artwork or shadow pixels on the canvas');
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
      const quickActions = document.querySelector('.quick-actions').getBoundingClientRect();
      const uvButton = document.querySelector('#uvLightToggle').getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        stageWidth: stage.width,
        quickActions: { left: quickActions.left, right: quickActions.right, width: quickActions.width },
        uvButton: { left: uvButton.left, right: uvButton.right, width: uvButton.width },
        uvPressed: document.querySelector('#uvLightToggle').getAttribute('aria-pressed'),
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
    assert(layout.documentWidth <= layout.viewport + 1, 'mobile shell overflows horizontally');
    assert(
      layout.quickActions.left >= 0 && layout.quickActions.right <= layout.viewport,
      'mobile quick actions are clipped off-screen',
    );
    assert(
      layout.uvButton.width >= 44 && layout.uvButton.left >= 0 && layout.uvButton.right <= layout.viewport,
      'mobile UV switch is missing or clipped off-screen',
    );
    assert.equal(layout.uvPressed, 'false', 'mobile UV switch should start off');

    await openDialog(page, '#inkOpen', '#inkDialog');
    await page.locator('#inkDialog').evaluate(async dialog => {
      await Promise.all(dialog.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    const inkLayout = await page.evaluate(() => {
      const dialog = document.querySelector('#inkDialog');
      const bounds = dialog.getBoundingClientRect();
      const palette = document.querySelector('#uvPalette').getBoundingClientRect();
      return {
        dialogLeft: bounds.left,
        dialogRight: bounds.right,
        dialogWidth: bounds.width,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
        paletteLeft: palette.left,
        paletteRight: palette.right,
        uvSwatches: document.querySelectorAll('#uvPalette button[data-uv="true"]').length,
        regularSwatches: document.querySelectorAll('#inkPalette button[data-uv="false"]').length,
      };
    });
    assert(inkLayout.uvSwatches > 0, 'mobile ink panel has no UV swatches');
    assert(inkLayout.regularSwatches > 0, 'mobile ink panel has no standard swatches');
    assert(
      inkLayout.dialogLeft >= 0 && inkLayout.dialogRight <= layout.viewport + 1,
      'mobile UV ink panel is clipped off-screen',
    );
    assert(
      inkLayout.dialogScrollWidth <= inkLayout.dialogClientWidth + 1 &&
      inkLayout.paletteLeft >= inkLayout.dialogLeft &&
      inkLayout.paletteRight <= inkLayout.dialogRight + 1,
      `mobile UV ink panel overflows horizontally: ${JSON.stringify(inkLayout)}`,
    );
    await page.locator('#uvPalette [data-ink="#ff2e7e"][data-uv="true"]').click();
    let inkState = await page.evaluate(() => window.SigilStudio.getState().settings);
    assert.equal(inkState.ink.toLowerCase(), '#ff2e7e');
    assert.equal(inkState.uvInk, true, 'UV swatch did not atomically select reactive ink');
    await page.locator('#inkPalette [data-ink="#ff2e7e"][data-uv="false"]').click();
    inkState = await page.evaluate(() => window.SigilStudio.getState().settings);
    assert.equal(inkState.ink.toLowerCase(), '#ff2e7e');
    assert.equal(inkState.uvInk, false, 'same-color standard swatch stayed UV reactive');
    await closeDialog(page, '#inkDialog');
    await page.locator('#uvLightToggle').click();
    assert.equal(await page.locator('#uvLightToggle').getAttribute('aria-pressed'), 'true');
    await page.locator('#uvLightToggle').click();
    assert.equal(await page.locator('#uvLightToggle').getAttribute('aria-pressed'), 'false');

    await openDialog(page, '#layersOpen', '#layersDialog');
    await page.locator('#shadowEnabled').check();
    const shadowLayout = await page.evaluate(() => {
      const dialog = document.querySelector('#layersDialog');
      const range = document.querySelector('#shadowOpacity').getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      return {
        dialogLeft: bounds.left,
        dialogRight: bounds.right,
        dialogWidth: bounds.width,
        dialogScrollWidth: dialog.scrollWidth,
        rangeLeft: range.left,
        rangeRight: range.right,
      };
    });
    assert(
      shadowLayout.dialogLeft >= 0 && shadowLayout.dialogRight <= layout.viewport + 1,
      'mobile shadow dialog is clipped off-screen',
    );
    assert(
      shadowLayout.dialogScrollWidth <= shadowLayout.dialogWidth + 1,
      'mobile shadow dialog scrolls horizontally',
    );
    assert(
      shadowLayout.rangeLeft >= shadowLayout.dialogLeft &&
      shadowLayout.rangeRight <= shadowLayout.dialogRight + 1,
      'mobile shadow control extends outside its dialog',
    );
    await closeDialog(page, '#layersDialog');

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
