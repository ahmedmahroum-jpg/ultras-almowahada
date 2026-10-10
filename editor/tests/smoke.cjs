const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const {pathToFileURL} = require('url');
const {chromium} = require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const editor = path.resolve(__dirname, '..', 'ultras-editor.html');
const out = path.resolve(__dirname, 'results');
fs.mkdirSync(out, {recursive:true});
const result = {checks:[], errors:[], network:[]};
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let page;
async function check(name, fn) {
  try { const details=await fn(); result.checks.push({name,ok:true,details}); console.log('PASS '+name); }
  catch(e) { result.checks.push({name,ok:false,error:e.message}); console.log('FAIL '+name+': '+e.message); }
}
async function select(id) {
  await page.evaluate(id=>window.EditorApp.selectTemplate(id),id);
  await page.waitForFunction(id=>window.EditorApp.getState().selectedId===id,id);
  await sleep(150);
}
async function download(button,filename) {
  const promised=page.waitForEvent('download',{timeout:20000});
  await page.locator(button).click();
  const d=await promised; const target=path.join(out,filename);await d.saveAs(target);return target;
}
async function fill(id,value) { await page.locator('#field-'+id).fill(value); await sleep(130); }
function dimensions(filename) {
  const data=fs.readFileSync(filename);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
}

(async()=>{
  assert(fs.existsSync(editor),'Bundle must exist before smoke test.');
  const downloadsPath=path.resolve('C:/Users/mahro/AppData/Local/Temp/ultras-editor-downloads');fs.mkdirSync(downloadsPath,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath});
  const context=await browser.newContext({viewport:{width:1550,height:1040},acceptDownloads:true});
  await context.route(/^https?:\/\//,route=>{result.network.push(route.request().url());return route.abort();});
  page=await context.newPage();
  page.on('pageerror',e=>result.errors.push(e.message));
  try {
    await page.goto(pathToFileURL(editor).href);
    await page.waitForFunction(()=>window.EditorApp && document.querySelector('#preview svg'),null,{timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    await check('Thirteen selectable templates',async()=>{
      const count=await page.locator('#gallery .template-option').count();assert.equal(count,13);
      const templates=await page.evaluate(()=>window.EDITOR_DATA.templates.map(t=>({id:t.id,width:t.width,height:t.height})));
      for(const t of templates){await select(t.id);assert.equal(await page.locator('#preview > svg').count(),1);assert(await page.locator('#selectedTitle').textContent());}
      return templates;
    });
    await check('Two-line introduction retains filled and outlined letter styles',async()=>{
      await select('01-introduction');
      const styles=()=>page.locator('#preview > svg').evaluate(svg=>{const spans=svg.querySelectorAll('#editor-text-3 > tspan');return (spans.length?Array.from(spans):['editor-text-3','editor-text-4'].map(id=>svg.querySelector('#'+id))).map((e,i)=>{const s=getComputedStyle(e);return {line:i,fill:s.fill,stroke:s.stroke,strokeWidth:s.stroke==='none'?'0px':s.strokeWidth,y:e.getAttribute('y')};});});
      const before=await styles();await fill('mainName','كلمات\nتجريبية');const after=await styles();
      assert.deepEqual(after,before);assert.notEqual(after[0].fill,after[1].fill);
      await page.screenshot({path:path.join(out,'introduction-styles.png'),fullPage:true});
      await download('#exportPng','introduction-export.png');return {before,after};
    });
    await select('02-quote');
    await check('Edit speaker, quotation, source and date',async()=>{
      for(const [id,value] of Object.entries({speaker:'اختبار الاسم العربي',quote:'هذا نص تجريبي للتحقق من وضوح الخط العربي.',sourceDate:'مصدر تجريبي · 08.10.2026'}))await fill(id,value);
      const txt=await page.locator('#preview svg').textContent();
      assert(txt.includes('اختبار الاسم العربي'));assert(txt.includes('هذا نص تجريبي'));assert(txt.includes('08.10.2026'));
      assert.equal(await page.locator('#overflowWarning').isVisible(),false);
      await page.screenshot({path:path.join(out,'quote-desktop.png'),fullPage:true});
    });
    await check('Upload local image and move crop',async()=>{
      const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=500;c.height=800;const x=c.getContext('2d');x.fillStyle='#E9DFCD';x.fillRect(0,0,500,800);x.fillStyle='#166D44';x.fillRect(0,0,250,800);x.fillStyle='#C0F07A';x.beginPath();x.arc(250,400,140,0,Math.PI*2);x.fill();return c.toDataURL('image/png').split(',')[1];});
      const img=path.join(out,'portrait-test.png');fs.writeFileSync(img,Buffer.from(data,'base64'));
      await page.locator('#field-portrait').setInputFiles(img);
      await page.waitForFunction(()=>!!window.EditorApp.getState().drafts['02-quote'].images.portrait);
      await sleep(200);
      assert.equal(await page.locator('#field-credit').inputValue(),'');
      const before=await page.locator('#preview svg').evaluate(el=>el.outerHTML);
      const slider=page.locator('input[name="crop-zoom"]');await slider.fill('1.75');await slider.dispatchEvent('input');
      const offset=page.locator('input[name="crop-offsetX"]');await offset.fill('0.5');await offset.dispatchEvent('input');
      await sleep(150);const after=await page.locator('#preview svg').evaluate(el=>el.outerHTML);
      assert.notEqual(before,after);return await page.evaluate(()=>window.EditorApp.getState().drafts['02-quote'].crop);
    });
    await check('PNG download is real 1080 by 1350',async()=>{
      await page.locator('#exportScale').selectOption('1');
      const file=await download('#exportPng','quote-export.png');assert.deepEqual(dimensions(file),[1080,1350]);
      return {bytes:fs.statSync(file).size,dimensions:dimensions(file)};
    });
    await check('SVG download preserves editable Arabic text and font',async()=>{
      const file=await download('#exportSvg','quote-export.svg');const svg=fs.readFileSync(file,'utf8');
      assert(svg.includes('<text'));assert(svg.includes('اختبار الاسم العربي'));assert(svg.includes('data:font/'));assert(svg.includes('data:image/'));
      const err=await page.evaluate(svg=>new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror')?.textContent,svg);assert(!err,err);
      return {bytes:fs.statSync(file).size};
    });
    let saved;
    await check('Save JSON, change values, import restores content and crop',async()=>{
      saved=await download('#saveFile','quote-project.json');const data=JSON.parse(fs.readFileSync(saved,'utf8'));
      assert.equal(data.format,'ultras-design');assert.equal(data.values.speaker,'اختبار الاسم العربي');assert(data.images.portrait);assert.equal(data.crop.portrait.zoom,1.75);
      await fill('speaker','اسم آخر');
      await page.locator('#importFile').setInputFiles(saved);
      await page.waitForFunction(()=>document.querySelector('#field-speaker').value==='اختبار الاسم العربي');
      assert.equal(await page.locator('input[name="crop-zoom"]').inputValue(),'1.75');
    });
    await check('Reload restores local draft',async()=>{
      await sleep(700);await page.reload();await page.waitForFunction(()=>window.EditorApp && document.querySelector('#field-speaker'));
      assert.equal(await page.locator('#field-speaker').inputValue(),'اختبار الاسم العربي');assert.equal(await page.locator('input[name="crop-zoom"]').inputValue(),'1.75');
    });
    await check('Important news headline changes in preview',async()=>{
      await select('04-important-news');await fill('headline','عنوان تجريبي مهم');assert((await page.locator('#preview svg').textContent()).includes('عنوان تجريبي مهم'));
      await page.screenshot({path:path.join(out,'news-desktop.png'),fullPage:true});
    });
    await check('Comparison fields stay independent',async()=>{
      await select('03-comparison');await fill('rightQuote','النص التجريبي الأول');await fill('leftQuote','النص التجريبي الثاني');
      const txt=await page.locator('#preview > svg').evaluate(svg=>Array.from(svg.querySelectorAll('text,tspan')).map(el=>el.textContent).join(' '));assert(txt.replace(/\s/g,'').includes('النصالتجريبيالأول'));assert(txt.replace(/\s/g,'').includes('النصالتجريبيالثاني'));
      assert.equal(await page.locator('#field-rightQuote').inputValue(),'النص التجريبي الأول');assert.equal(await page.locator('#field-leftQuote').inputValue(),'النص التجريبي الثاني');
    });
    await check('Long text warns and blocks clipped export',async()=>{
      await select('02-quote');await fill('quote','هذه فقرة اختبار طويلة للتحقق من تحذير تجاوز مساحة النص. '.repeat(150));
      assert(await page.locator('#overflowWarning').isVisible());assert(await page.locator('#exportPng').isDisabled());assert(await page.locator('#exportSvg').isDisabled());
      await fill('quote','هذا نص تجريبي للتحقق من وضوح الخط العربي.');assert.equal(await page.locator('#overflowWarning').isVisible(),false);assert.equal(await page.locator('#exportPng').isDisabled(),false);
    });
    await check('Malformed project cannot change state',async()=>{
      const before=await page.locator('#field-speaker').inputValue();const bad=path.join(out,'bad-project.json');fs.writeFileSync(bad,JSON.stringify({format:'ultras-design',version:1,templateId:'<script>',values:{speaker:'changed'}}));
      await page.locator('#importFile').setInputFiles(bad);await sleep(200);assert.equal(await page.locator('#field-speaker').inputValue(),before);assert(await page.locator('#toast').isVisible());
    });
    await check('Mobile width 390 has no horizontal overflow',async()=>{
      await page.setViewportSize({width:390,height:844});await sleep(300);
      const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert(sizes.scroll<=sizes.width+1,JSON.stringify(sizes));assert(sizes.body<=sizes.width+1,JSON.stringify(sizes));
      await page.screenshot({path:path.join(out,'quote-mobile.png'),fullPage:true});return sizes;
    });
    await check('No network dependency or browser runtime error',async()=>{assert.deepEqual(result.network,[]);assert.deepEqual(result.errors,[]);});
  }catch(e){result.fatal=e.stack;console.error(e.stack);}
  finally{await browser.close();fs.writeFileSync(path.join(out,'smoke-report.json'),JSON.stringify(result,null,2));}
  process.exitCode=result.fatal||result.checks.some(c=>!c.ok)?1:0;
})();
