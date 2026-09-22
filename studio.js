/* Studio 137 instrument shell. The drawing engine remains independently usable. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = () => window.SigilStudio;
  const icons = {
    undo:'<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(1 -2)"/>',
    redo:'<path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12" transform="translate(-1 -2)"/>',
    brush:'<path d="m15 3 6 6-10 10-6-6Z M5 13c-4 0-2 5-4 8 5 0 9-1 8-4"/>',
    symbols:'<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/><circle cx="12" cy="12" r="6"/>',
    ink:'<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
    shape:'<path d="m12 2 10 18H2Z"/><circle cx="12" cy="13" r="6"/>',
    layers:'<path d="m12 2 10 5-10 5L2 7Z M2 12l10 5 10-5M2 17l10 5 10-5"/>',
    burst:'<path d="m12 1 2 7 7-4-4 7 6 2-7 2 4 7-7-4-2 6-2-7-7 4 4-7-6-2 7-2-4-7 7 4Z"/>',
    export:'<path d="M12 16V2m-5 5 5-5 5 5M4 14v7h16v-7"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    help:'<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1"/>',
    check:'<path d="m5 12 4 4L20 5"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
  const button = (id, label, glyph, className='') => '<button type="button" id="'+id+'" aria-label="'+label+'" class="'+className+'">'+(glyph?icon(glyph):'')+'<span>'+label+'</span></button>';
  const stage = $('stage'), panel = $('panel'), wrap = $('wrap');
  let returnFocus, activeDialog, toastTimer;
  const shellHeader = document.createElement('header');
  shellHeader.className = 'studio-header';
  shellHeader.innerHTML = '<a class="wordmark" href="#" aria-label="Sigil Gun home"><span class="brand-symbol" aria-hidden="true">✳</span><span>sigil gun<small>A Studio 137 instrument</small></span></a><div class="header-actions">'+button('projectOpen','Project','menu','quiet-button')+button('exportOpen','Export','export','export-button')+'</div>';
  document.body.prepend(shellHeader);
  shellHeader.querySelector('a').addEventListener('click', e => e.preventDefault());
  const leftGrip = document.createElement('nav');
  leftGrip.className = 'grip grip-left';
  leftGrip.setAttribute('aria-label','History');
  leftGrip.innerHTML = '<div class="grip-light"></div>'+button('undo','Undo','undo','round-button')+button('redo','Redo','redo','round-button')+'<span class="grip-mark" aria-hidden="true">137</span>';
  const rightGrip = document.createElement('nav');
  rightGrip.className = 'grip grip-right';
  rightGrip.setAttribute('aria-label','Quick play');
  rightGrip.innerHTML = '<div class="grip-light"></div>'+button('burst','Burst','burst','round-button')+button('helpOpen','Help','help','round-button')+'<span class="grip-ridges" aria-hidden="true"></span>';
  panel.hidden=true;
  document.body.append(panel);
  wrap.prepend(leftGrip);
  wrap.append(rightGrip);
  wrap.setAttribute('aria-label','Drawing console');
  wrap.setAttribute('role','main');
  stage.insertAdjacentHTML('beforeend','<div id="emptyState" class="empty-state"><div class="hero-glyph" aria-hidden="true"></div><h1>Make a little chaos.</h1><p>Drag to paint. Every mark is yours.</p></div><div id="brushCursor" aria-hidden="true"></div>');
  $('cv').setAttribute('aria-label','Drawing canvas. Drag to paint with the selected brush and symbols.');
  const footer = document.createElement('footer');
  footer.className='studio-footer';
  footer.innerHTML='<div class="play-dock" role="toolbar" aria-label="Drawing tools">'+
    button('brushOpen','Brush','brush','dock-button')+button('symbolsOpen','Symbols','symbols','dock-button')+
    button('inkOpen','Ink','ink','dock-button')+button('shapeOpen','Structure','shape','dock-button')+
    button('layersOpen','Layers','layers','dock-button')+'</div>'+
    '<div id="resumeStrip" class="resume-strip" hidden><span>Your last session is here.</span>'+button('resumeLast','Resume',null)+button('dismissLast','Start fresh',null)+'</div>'+
    '<div class="session-line"><span id="shellStatus" role="status">Ready when you are.</span><div class="mobile-history">'+button('undoMobile','Undo','undo')+button('redoMobile','Redo','redo')+button('burstMobile','Burst','burst')+'</div><span id="documentSize"></span></div>';
  document.body.append(footer);
  const toast=document.createElement('div'); toast.id='studioToast'; toast.setAttribute('role','status'); document.body.append(toast);
  function notify(message) {
    toast.textContent=message; toast.classList.add('visible'); clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('visible'),3000);
  }
  function dialog(id,title,subtitle){
    const d=document.createElement('dialog'); d.id=id; d.className='studio-dialog';
    d.setAttribute('aria-labelledby',id+'Title');
    d.innerHTML='<header class="dialog-heading"><div><h2 id="'+id+'Title">'+title+'</h2><p>'+subtitle+'</p></div>'+button(id+'Close','Close','close','close-button')+'</header><div class="dialog-content"></div>';
    document.body.append(d);
    $(id+'Close').onclick=()=>d.close();
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
    d.addEventListener('close',()=>{
      if(activeDialog!==d)return;
      document.querySelectorAll('[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));
      activeDialog=null;if(d.returnFocus?.isConnected)d.returnFocus.focus();
    });
    return d.querySelector('.dialog-content');
  }
  function open(id,from){
    if(activeDialog) activeDialog.close();
    if(id==='symbolsDialog')renderSymbols();
    returnFocus=from||document.activeElement; activeDialog=$(id); activeDialog.returnFocus=returnFocus;activeDialog.showModal();
    if(from) from.setAttribute('aria-expanded','true');
  }
  function trigger(buttonId,dialogId){
    const b=$(buttonId); b.setAttribute('aria-haspopup','dialog'); b.setAttribute('aria-controls',dialogId); b.setAttribute('aria-expanded','false');
    b.onclick=()=>open(dialogId,b);
  }
  function take(id,target,parent=false){const n=$(id);if(n)target.append(parent?n.parentElement:n);}
  function section(parent,title){const s=document.createElement('section');s.className='control-section';s.innerHTML='<h3>'+title+'</h3>';parent.append(s);return s;}
  function moveSlider(id,target){const n=$(id);if(n)target.append(n.closest('.slider')||n.closest('.row')||n);}
  const brushContent=dialog('brushDialog','Choose your touch.','Five ways to leave a mark. All of them yours.');
  take('brushes',brushContent);
  ['scale','brush','dens','op','chaos','gap'].forEach(id=>moveSlider(id,brushContent));
  const motion=section(brushContent,'The small differences');
  take('rays',motion,true);take('noRepeat',motion,true);take('bimodal',motion,true);
  const symbolsContent=dialog('symbolsDialog','Your symbol cabinet.','Pick a mark to paint with, or let the whole collection play.');
  symbolsContent.innerHTML='<div class="symbol-search"><label class="sr-only" for="symbolSearch">Find a symbol</label><input id="symbolSearch" type="search" placeholder="Find a symbol or collection…" autocomplete="off">'+button('randomSymbols','Mix all',null,'text-button')+'</div>';
  moveSlider('setSel',symbolsContent);
  symbolsContent.insertAdjacentHTML('beforeend','<p id="symbolCount" class="symbol-count"></p><div id="symbolGrid" class="symbol-grid"></div>');
  const anchorSection=section(symbolsContent,'Mix in favorite symbols');
  moveSlider('anchorIn',anchorSection);moveSlider('anchorP',anchorSection);take('atlas',anchorSection,true);
  $('anchorP').max='100';
  const inkContent=dialog('inkDialog','Set the mood.','The next marks take the new ink. Your existing marks stay as drawn.');
  inkContent.innerHTML='<div class="color-editors"><label>Ink<input type="color" id="shellInk" value="#e8dfce"></label><label>Canvas<input type="color" id="shellBackground" value="#14110c"></label></div><div id="inkPalette" class="ink-palette"></div>';
  const palettes=section(inkContent,'Pairings');
  const paletteChips=panel.querySelector('.chip[data-p]')?.parentElement;
  if(paletteChips) palettes.append(paletteChips);
  moveSlider('texM',inkContent);take('accentC',inkContent,true);
  const accentSlider=document.createElement('div');accentSlider.className='slider';accentSlider.innerHTML='<label for="accRate">Accent frequency <span id="accentValue"></span></label>';
  take('vAccRate',accentSlider.querySelector('#accentValue'));take('accRate',accentSlider);inkContent.append(accentSlider);
  take('duo',inkContent,true);moveSlider('bgM',inkContent);
  const shapeContent=dialog('shapeDialog','Give it a rhythm.','Start loose. Find a system. Break it again.');
  const lenses=section(shapeContent,'Ways of making');
  take('lensChips',lenses);take('lensNote',lenses);
  ['fieldM','fieldD','snap'].forEach(id=>moveSlider(id,shapeContent));
  take('showGrid',shapeContent,true);take('fieldNote',shapeContent);
  const seedGroup=section(shapeContent,'Repeatable randomness');
  moveSlider('seed',seedGroup);take('btnSeed',seedGroup);take('btnAuto',seedGroup);
  const layersContent=dialog('layersDialog','Build it in layers.','Keep an idea separate. Hide it, blend it, move it.');
  const layerButtons=document.createElement('div');layerButtons.className='layer-actions';layersContent.append(layerButtons);
  ['layAdd','layDel','layUp','layDn'].forEach(id=>take(id,layerButtons));
  take('layList',layersContent);['blendM','collideM'].forEach(id=>moveSlider(id,layersContent));
  const exportContent=dialog('exportDialog','Take it with you.','An image to share. A vector to build with. A project to keep exploring.');
  moveSlider('expK',exportContent);
  ['btnExport','btnSVG','btnSave'].forEach(id=>take(id,exportContent));
  exportContent.insertAdjacentHTML('beforeend','<p class="export-note">PNG keeps the rendered look. SVG preserves your vector marks; older raster projects keep their embedded artwork.</p>');
  const projectContent=dialog('projectDialog','Your workspace.','Keep a copy. Come back to it. Make another mess.');
  projectContent.innerHTML='<div id="recoveryNotice" hidden><p>A saved session is on this browser.</p>'+button('restoreSession','Restore session',null,'text-button')+'</div>'+
    button('shellSave','Save project',null,'project-action')+button('shellLoad','Open project',null,'project-action')+
    '<div class="control-section"><h3>New canvas</h3><p class="dim">Start fresh in a different shape. Undo brings the previous piece back.</p><div class="canvas-presets">'+button('landscapeCanvas','Landscape',null)+button('portraitCanvas','Portrait',null)+button('squareCanvas','Square',null)+'</div></div>'+
    button('shellClear','Clear canvas',null,'project-action danger-button')+button('projectHelp','How to play','help','project-action');
  take('btnLoad',projectContent);$('btnLoad').hidden=true;
  take('fileIn',projectContent);take('btnClear',projectContent);$('btnClear').hidden=true;
  const helpContent=dialog('helpDialog','Pick up and play.','Your marks. Your rules.');
  helpContent.innerHTML='<ol class="help-steps"><li><b>Drag to draw.</b><span>Use your finger, mouse, or pen. A burst fills the canvas for you.</span></li><li><b>Find your mark.</b><span>Open Symbols to pick one of your hand-drawn shapes. Mix all brings back the whole collection.</span></li><li><b>Follow a hunch.</b><span>Brush changes the touch. Ink changes the mood. Structure gives your marks a rhythm.</span></li><li><b>Keep the good stuff.</b><span>Undo is always nearby. Export an image, or save a project to keep every editable mark.</span></li></ol><p class="keyboard-note">Keyboard: Ctrl / ⌘ Z to undo, Shift Z to redo. S saves a project. E exports PNG. Shortcuts rest while you type.</p>';
  // Retain engine-owned elements that were not promoted into the shell.
  panel.hidden=true; panel.setAttribute('aria-hidden','true');document.body.append(panel);
  ['brush','symbols','ink','shape','layers','project','export','help'].forEach(name=>trigger(name+'Open',name+'Dialog'));
  function doUndo(){api()?.undo();}
  function doRedo(){api()?.redo();}
  $('undo').onclick=$('undoMobile').onclick=doUndo;$('redo').onclick=$('redoMobile').onclick=doRedo;
  function burst(){ $('btnAuto').click(); notify('A little chaos. Undo takes it back.'); }
  $('burst').onclick=$('burstMobile').onclick=burst;
  $('shellSave').onclick=()=>api()?.save();
  $('shellLoad').onclick=()=>$('fileIn').click();
  $('shellClear').onclick=()=>{api()?.clear();$('projectDialog').close();notify('Canvas cleared. You can undo this.');};
  $('restoreSession').onclick=async()=>{await api()?.restoreRecovery();$('resumeStrip').hidden=true;$('projectDialog').close();};
  $('resumeLast').onclick=async()=>{await api()?.restoreRecovery();$('resumeStrip').hidden=true;};
  $('dismissLast').onclick=()=>{api()?.discardRecovery();$('resumeStrip').hidden=true;};
  $('projectHelp').onclick=()=>open('helpDialog',$('projectOpen'));
  for(const [id,w,h] of [['landscapeCanvas',1200,900],['portraitCanvas',900,1200],['squareCanvas',1200,1200]])$(id).onclick=()=>{api()?.newProject(w,h);$('projectDialog').close();};
  $('shellInk').addEventListener('input',e=>api()?.setOption('ink',e.target.value));
  $('shellBackground').addEventListener('input',e=>api()?.setOption('bg',e.target.value));
  const colors=[['Bone','#E8DFCE'],['Void','#0A0907'],['Phosphor','#63D98F'],['Magenta','#FF2E7E'],['Copper','#36B9A2'],['Signal','#DF7A1F']];
  colors.forEach(([name,value])=>{const b=document.createElement('button');b.type='button';b.className='ink-swatch';b.style.setProperty('--swatch',value);b.title=name;b.setAttribute('aria-label',name+' ink');b.onclick=()=>api()?.setOption('ink',value);$('inkPalette').append(b);});
  const glyphSVG = sym => {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',sym.d);path.setAttribute('fill','currentColor');svg.append(path);return svg;
  };
  const library=window.SIGIL_LIB;
  const hero=library.find(s=>s.n==='pink_tight-spiral')||library[0];
  document.querySelector('.hero-glyph').append(glyphSVG(hero));
  let selected=null;
  function renderSymbols(){
    const search=$('symbolSearch').value.toLowerCase().trim(),set=$('setSel').value;
    const matches=library.filter(s=>(set==='all'||s.s===set)&&(!search||s.n.toLowerCase().includes(search)||s.s.includes(search)));
    $('symbolGrid').replaceChildren();
    for(const sym of matches){
      const b=document.createElement('button');b.type='button';b.className='symbol-tile';b.dataset.symbol=sym.n;
      const name=sym.n.replaceAll('_',' ').replaceAll('-',' ');
      b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(sym.n===selected));b.append(glyphSVG(sym));
      b.onclick=()=>{selected=sym.n;api()?.selectSymbol(sym.n);renderSymbols();$('symbolsDialog').close();notify('Painting with '+name+'.');};
      $('symbolGrid').append(b);
    }
    $('symbolCount').textContent=matches.length+' symbol'+(matches.length===1?'':'s')+(selected?' · One selected':' · Mixing freely');
    if(!matches.length){const p=document.createElement('p');p.className='no-symbols';p.textContent='No marks found. Try another word or collection.';$('symbolGrid').append(p);}
  }
  $('symbolSearch').addEventListener('input',renderSymbols);
  $('setSel').addEventListener('input',()=>{selected=null;api()?.selectSymbol(null);renderSymbols();});
  $('randomSymbols').onclick=()=>{selected=null;api()?.selectSymbol(null);$('symbolSearch').value='';$('setSel').value='all';$('setSel').dispatchEvent(new Event('input'));$('symbolsDialog').close();notify('The whole collection is in play.');};
  renderSymbols();
  const friendlyLabels={scale:'Mark size',brush:'Brush reach',dens:'Density',op:'Opacity',chaos:'Chaos',gap:'Breathing room',fieldD:'Depth',anchorP:'Favorite frequency'};
  for(const[id,label]of Object.entries(friendlyLabels)){
    const el=$(id)?.closest('.slider')?.querySelector('label');
    if(el?.firstChild?.nodeType===Node.TEXT_NODE)el.firstChild.textContent=label+' ';
  }
  const chipLabels={'teal-esp':'Bone / black','teal-dark':'Teal / black',cream:'Ink / paper',ghost:'Ghost'};
  document.querySelectorAll('.chip[data-p]').forEach(el=>el.textContent=chipLabels[el.dataset.p]||el.textContent);
  const labels={setSel:'Collection',fieldM:'Placement',snap:'Snap',texM:'Texture',bgM:'Canvas pattern',blendM:'Blend',collideM:'Avoid overlap'};
  for(const[id,label]of Object.entries(labels)){
    const el=$(id)?.closest('.slider')?.querySelector('label');
    if(el?.firstChild?.nodeType===Node.TEXT_NODE)el.firstChild.textContent=label+' ';
  }
  // Native button semantics for the retained engine controls.
  function makeAccessible(){
    document.querySelectorAll('.btn,.brush,.chip,.ly-clear').forEach(el=>{
      if(el.tagName==='BUTTON'||el.dataset.accessible)return;
      el.dataset.accessible='true';el.setAttribute('role','button');el.tabIndex=0;
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();el.click();}});
    });
  }
  makeAccessible();new MutationObserver(makeAccessible).observe($('layList'),{childList:true,subtree:true});
  document.querySelectorAll('select').forEach(el=>{if(!el.labels?.length&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.closest('.slider')?.querySelector('label')?.textContent.trim()||el.id);});
  document.querySelectorAll('.slider input[type="range"]').forEach(el=>{const label=el.closest('.slider').querySelector('label');if(label)label.htmlFor=el.id;});
  const brushLabels={spray:'Spray',wet:'Wet paint',calligraphy:'Pen',marker:'Marker',finetip:'Fine tip'};
  function sync(detail){
    const state=detail||api()?.getState();if(!state)return;
    const settings=state.settings||{};
    const hasArtwork=state.hasArtwork??state.stamps>0;
    $('emptyState').hidden=hasArtwork;
    $('undo').disabled=$('undoMobile').disabled=!state.canUndo;
    $('redo').disabled=$('redoMobile').disabled=!state.canRedo;
    $('documentSize').textContent=state.width+' × '+state.height;
    const layerCount=Array.isArray(state.layers)?state.layers.length:state.layers;
    $('shellStatus').textContent=hasArtwork?(state.stamps+' marks · '+layerCount+' layer'+(layerCount===1?'':'s')):'Drag to paint. Or try a burst.';
    if(state.status&&state.status!=='ready')$('shellStatus').textContent=state.status;
    $('recoveryNotice').hidden=!state.recoveryAvailable;
    $('brushOpen').querySelector('span').textContent=brushLabels[settings.brush]||'Brush';
    $('layersOpen').querySelector('span').textContent='Layers'+(layerCount>1?' · '+layerCount:'');
    $('inkOpen').style.setProperty('--current-ink',settings.ink||'#e8dfce');
    if(settings.ink)$('shellInk').value=settings.ink;
    if(settings.bg)$('shellBackground').value=settings.bg;
    if(state.selectedSymbol!==undefined&&selected!==state.selectedSymbol){selected=state.selectedSymbol;renderSymbols();}
    document.querySelectorAll('#brushes .brush').forEach(el=>el.setAttribute('aria-pressed',String(el.classList.contains('active'))));
    document.querySelectorAll('#lensChips .chip').forEach(el=>el.setAttribute('aria-pressed',String(el.classList.contains('active'))));
    if(hasArtwork)$('resumeStrip').hidden=true;
  }
  window.addEventListener('sigil:change',e=>sync(e.detail));
  const cursor=$('brushCursor');
  stage.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    const r=stage.getBoundingClientRect();cursor.style.transform='translate('+(e.clientX-r.left)+'px,'+(e.clientY-r.top)+'px)';cursor.classList.add('visible');
  });
  stage.addEventListener('pointerleave',()=>cursor.classList.remove('visible'));
  // Small physical response belongs to the controls, never to the artwork.
  document.querySelectorAll('.round-button,.dock-button').forEach(b=>{
    b.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=b.getBoundingClientRect();b.style.setProperty('--tilt',((e.clientX-r.left)/r.width-.5)*8+'deg');});
    b.addEventListener('pointerleave',()=>b.style.removeProperty('--tilt'));
  });
  document.body.classList.add('studio-ready');
  api()?.refresh();sync();
  $('resumeStrip').hidden=!api()?.getState().recoveryAvailable;
  window.StudioShell={open,notify};
})();
