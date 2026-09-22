/* Physical print planning. No payment or supplier order is made by this module. */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).get('renderer')==='print')return;
  const $=id=>document.getElementById(id),api=()=>window.SigilStudio;
  const families=[
    {ratio:3/4,defaults:[[12,16],[18,24],[30,40]],small:[[6,8],[12,16],[18,24],[24,32],[30,40]]},
    {ratio:2/3,defaults:[[12,18],[20,30],[24,36]],small:[[8,12],[12,18],[16,24],[20,30],[24,36]]},
    {ratio:4/5,defaults:[[8,10],[16,20],[20,24]],small:[[8,10],[16,20],[20,24]]},
    {ratio:1,defaults:[[12,12],[18,18],[24,24]],small:[[10,10],[12,12],[14,14],[18,18],[24,24]]}
  ];
  function sizesFor(source){
    const ratio=Math.min(source.width,source.height)/Math.max(source.width,source.height);
    const family=families.reduce((best,f)=>Math.abs(f.ratio-ratio)<Math.abs(best.ratio-ratio)?f:best);
    const oriented=p=>source.width>source.height?[p[1],p[0]]:p;
    let sizes=family.defaults.map(oriented);
    if(source.raster.length){
      const candidates=family.small.map(oriented);
      const usable=candidates.filter(([w,h])=>rasterPPI(source,w,h,'contain')>=150);
      sizes=usable.length?usable.slice(-3):candidates.slice(0,1);
    }
    return sizes.map(([width,height])=>({width,height,id:width+'x'+height}));
  }
  function placement(source,width,height,fit){
    const scale=(fit==='cover'?Math.max:Math.min)(width/source.width,height/source.height);
    return {width:source.width*scale,height:source.height*scale,scale};
  }
  function rasterPPI(source,width,height,fit){
    const p=placement(source,width,height,fit);
    return source.raster.length?Math.floor(Math.min(...source.raster.map(r=>Math.min(r.width/p.width,r.height/p.height)))):null;
  }
  function outputFor(source,size,fit){
    const p=placement(source,size.width,size.height,fit);
    const dpi=Math.floor(Math.min(300,8000/Math.max(size.width,size.height,p.width,p.height),Math.sqrt(39000000/(size.width*size.height)),Math.sqrt(39000000/(p.width*p.height))));
    return {width:Math.round(size.width*dpi),height:Math.round(size.height*dpi),dpi,rasterPPI:rasterPPI(source,size.width,size.height,fit)};
  }
  const launcher=document.createElement('button');launcher.id='printOpen';launcher.type='button';launcher.className='quiet-button print-open';
  launcher.setAttribute('aria-label','Print');launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls','printDialog');launcher.setAttribute('aria-expanded','false');launcher.title='Make a print';
  launcher.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V2h12v6M6 17H3V8h18v9h-3M6 14h12v8H6zM17 11h1"/></svg><span>Print</span>';
  $('exportOpen').before(launcher);
  const d=document.createElement('dialog');d.id='printDialog';d.className='studio-dialog print-room';d.setAttribute('aria-labelledby','printTitle');
  d.innerHTML=`<header class="dialog-heading"><div><p class="print-kicker">FROM YOUR HANDS. INTO THE WORLD.</p><h2 id="printTitle">Give it a wall.</h2><p>The marks you made. A little more permanent.</p></div><button type="button" id="printClose" class="close-button" aria-label="Back to drawing">×</button></header>
  <div class="print-layout"><section class="print-scene" aria-label="Print preview"><div class="print-wall"><div id="printPaper" class="print-paper"><img id="printPreview" alt="Your composition on the selected paper" hidden><span id="printLoading" role="status">Hanging your artwork…</span></div><div class="print-ledge" aria-hidden="true"></div></div><p class="print-caption"><span id="printDimensions"></span><span>Unframed · wall for scale only</span></p></section>
  <section class="print-options" aria-label="Print options"><p class="print-kicker">01 / MAKE SOME ROOM</p><div id="printSizes" class="print-sizes" role="group" aria-label="Paper size"></div>
  <p class="print-kicker">02 / CHOOSE THE LIGHT</p><div class="print-segment" role="group" aria-label="Print appearance"><button type="button" id="printDay">Daylight</button><button type="button" id="printUV">UV look</button></div><p id="printUVNote" class="print-note">Printed colors on matte paper. No reactive ink.</p>
  <p class="print-kicker">03 / FIND THE FIT</p><div class="print-segment" role="group" aria-label="Paper fit"><button type="button" id="printFit">Whole artwork</button><button type="button" id="printFill">Fill paper</button></div><p id="printFitNote" class="print-note"></p>
  <p id="printQuality" class="print-quality"></p><div class="print-checkout-note"><b>Print room preview</b><p>Size it. Save it. Ordering opens once pricing and fulfillment are connected.</p></div>
  <button type="button" id="printDownload" class="print-primary" disabled>Save print file <span aria-hidden="true">↗</span></button><button type="button" id="printPlan" class="print-secondary" disabled>Save print plan</button><p id="printStatus" role="status" class="print-note"></p></section></div>`;
  document.body.append(d);
  let snapshot,source,sizes,size,fit='contain',uv=false,frame,renderer,session=0,renderVersion=0,previewUrl,returnFocus,exporting=false,ready=false,previewReady=false;
  function cleanup(){session++;renderVersion++;frame?.remove();frame=renderer=null;ready=false;exporting=false;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('printPreview').removeAttribute('src');$('printPreview').hidden=true;launcher.setAttribute('aria-expanded','false');}
  d.addEventListener('close',()=>{cleanup();returnFocus?.focus();});
  $('printClose').onclick=()=>d.close();
  d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
  function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function updateControls(){
    const output=outputFor(source,size,fit),p=placement(source,size.width,size.height,fit);
    $('printDimensions').textContent=size.width+' × '+size.height+' in';
    $('printPaper').style.setProperty('--paper-ratio',size.width+'/'+size.height);
    $('printPaper').style.setProperty('--paper-aspect',String(size.width/size.height));
    // Artwork occupies more of the same wall as the selected physical size grows.
    $('printPaper').style.setProperty('--paper-scale',String(.55+.45*Math.max(size.width,size.height)/40));
    $('printDay').setAttribute('aria-pressed',String(!uv));$('printUV').setAttribute('aria-pressed',String(uv));
    $('printFit').setAttribute('aria-pressed',String(fit==='contain'));$('printFill').setAttribute('aria-pressed',String(fit==='cover'));
    const matching=Math.abs(p.width-size.width)<.01&&Math.abs(p.height-size.height)<.01;
    $('printFitNote').textContent=matching?'Your composition fits this paper edge to edge.':fit==='contain'?'Every mark stays. White margins fill the remaining paper.':'Centered crop. Marks beyond the paper edges are left out.';
    $('printUVNote').textContent=uv?'This saves the glow as printed color. The paper itself will not react to blacklight.':'Printed colors on matte paper. No reactive ink.';
    const detail=output.rasterPPI===null?'Vector marks render fresh at this size.':'Imported image detail: '+output.rasterPPI+' pixels per inch.'+(output.rasterPPI<150?' Choose a smaller print; enlarging cannot restore missing detail.':'');
    $('printQuality').textContent=output.width.toLocaleString()+' × '+output.height.toLocaleString()+' px · '+output.dpi+' ppi\n'+detail;
    $('printQuality').classList.toggle('print-caution',output.rasterPPI!==null&&output.rasterPPI<150);
    $('printSizes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.size===size.id)));
    d.querySelectorAll('.print-options button').forEach(b=>b.disabled=exporting||!ready);
    $('printDownload').disabled=exporting||!ready||!previewReady;
  }
  async function preview(){
    if(!renderer||!ready)return;
    const ticket=++renderVersion,owner=session;previewReady=false;updateControls();$('printLoading').hidden=false;$('printLoading').textContent='Updating your print…';
    $('printStatus').textContent='';
    try{
      renderer.setOption('uvLight',uv);
      const scale=900/Math.max(size.width,size.height),blob=await renderer.renderPrintPNG({width:Math.round(size.width*scale),height:Math.round(size.height*scale),fit});
      if(ticket!==renderVersion||owner!==session)return;
      const next=URL.createObjectURL(blob),previous=previewUrl;previewUrl=next;$('printPreview').src=next;$('printPreview').hidden=false;$('printLoading').hidden=true;previewReady=true;updateControls();
      if(previous)URL.revokeObjectURL(previous);
    }catch(error){if(ticket!==renderVersion||owner!==session)return;$('printLoading').textContent='Preview could not render.';$('printStatus').textContent=error.message+' Change a size or fit to retry.';}
  }
  function loadRenderer(owner){
    return new Promise((resolve,reject)=>{
      frame=document.createElement('iframe');const ownFrame=frame;ownFrame.hidden=true;ownFrame.tabIndex=-1;ownFrame.setAttribute('aria-hidden','true');ownFrame.title='Print rendering workspace';
      const timer=setTimeout(()=>reject(new Error('The print renderer took too long. Close and reopen Print to retry.')),20000);
      ownFrame.onload=async()=>{
        try{if(owner!==session){clearTimeout(timer);return resolve(null);}const engine=ownFrame.contentWindow.SigilStudio;if(!engine)throw new Error('Print renderer could not start.');
          const loaded=await engine.load(structuredClone(snapshot));if(!loaded)throw new Error('This drawing could not be prepared.');clearTimeout(timer);resolve(engine);
        }catch(error){clearTimeout(timer);reject(error);}
      };
      ownFrame.onerror=()=>{clearTimeout(timer);reject(new Error('Print renderer could not load.'));};
      ownFrame.src=new URL('index.html?renderer=print',location.href).href;document.body.append(ownFrame);
    });
  }
  async function open(){
    if(d.open)return;
    if(api().getState().busy){window.StudioShell.notify('Let this drawing finish loading first.');return;}
    source=api().getPrintSourceInfo();
    if(!source.hasArtwork){window.StudioShell.notify('Make a few marks first. Then give them a wall.');return;}
    snapshot=api().getProject();sizes=sizesFor(source);size=sizes[Math.min(1,sizes.length-1)];uv=snapshot.settings.uvLight===true;fit='contain';ready=false;exporting=false;previewReady=false;
    document.querySelectorAll('dialog[open]').forEach(other=>other.close());returnFocus=document.activeElement;
    d.showModal();launcher.setAttribute('aria-expanded','true');const owner=++session;
    $('printSizes').replaceChildren();sizes.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.dataset.size=s.id;b.innerHTML='<span>'+s.width+' × '+s.height+'″</span><small>'+(['Personal','Statement','Big energy'][i])+'</small>';b.onclick=()=>{size=s;preview();};$('printSizes').append(b);});
    $('printLoading').hidden=false;$('printLoading').textContent='Hanging your artwork…';$('printStatus').textContent='';updateControls();
    try{const engine=await loadRenderer(owner);if(owner!==session||!engine)return;renderer=engine;ready=true;await preview();}
    catch(error){if(owner===session){$('printLoading').textContent='The print room could not open.';$('printStatus').textContent=error.message;}}
  }
  launcher.onclick=open;
  $('printDay').onclick=()=>{uv=false;preview();};$('printUV').onclick=()=>{uv=true;preview();};
  $('printFit').onclick=()=>{fit='contain';preview();};$('printFill').onclick=()=>{fit='cover';preview();};
  $('printDownload').onclick=async()=>{
    if(!ready||exporting)return;exporting=true;const owner=session;updateControls();$('printStatus').textContent='Rendering your full-size file. Larger pieces take a moment…';
    // Yield a frame so the progress message paints before rendering begins.
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    if(owner!==session)return;
    try{renderer.setOption('uvLight',uv);const output=outputFor(source,size,fit),blob=await renderer.renderPrintPNG({...output,fit});if(owner!==session)return;
      save(blob,'sigil-print-'+size.id+'in-'+(uv?'uv-look':'daylight')+'-'+output.dpi+'ppi.png');$('printStatus').textContent='Print file saved. '+size.width+' × '+size.height+' inches at '+output.dpi+' ppi. No order has been placed.';
    }catch(error){if(owner===session)$('printStatus').textContent=error.message+' Your drawing is safe; try a smaller size.';}
    finally{if(owner===session){exporting=false;updateControls();}}
  };
  function plan(){const project=structuredClone(snapshot);project.settings.uvLight=uv;return {format:'sigil-print-plan',version:1,createdAt:new Date().toISOString(),paper:{...size,unit:'in',stock:'Matte paper (planning)'},appearance:uv?'uv-look':'daylight',fit,output:outputFor(source,size,fit),project,orderingEnabled:false};}
  $('printPlan').onclick=()=>{save(new Blob([JSON.stringify(plan(),null,2)],{type:'application/json'}),'sigil-print-'+size.id+'.json');$('printStatus').textContent='Print plan saved with your editable composition and paper choices.';};
  window.PrintRoom={open,getPlan:()=>snapshot?plan():null,sizesFor,outputFor};
})();
