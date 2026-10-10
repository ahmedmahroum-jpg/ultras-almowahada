const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'results','crop');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],network:[]};
let page;
async function check(name,fn){try{const details=await fn();report.checks.push({name,ok:true,details});console.log('PASS '+name);}catch(e){report.checks.push({name,ok:false,error:e.message});console.log('FAIL '+name+': '+e.message);}}
async function slider(key,value){const el=page.locator('input[name="crop-'+key+'"]');await el.fill(String(value));await el.dispatchEvent('input');}
async function frame(){return page.locator('#preview #editor-image-0').evaluate(e=>({x:+e.getAttribute('x'),y:+e.getAttribute('y'),width:+e.getAttribute('width'),height:+e.getAttribute('height')}));}
async function clips(){return page.locator('#preview > svg').evaluate(s=>Array.from(s.querySelectorAll('clipPath')).map(e=>e.outerHTML));}
async function download(selector,name){const promised=page.waitForEvent('download');await page.locator(selector).click();const d=await promised;const target=path.join(out,name);await d.saveAs(target);return target;}
async function colors(file){return page.evaluate(async url=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const a=x.getImageData(0,0,c.width,c.height).data;const counts={red:0,green:0,blue:0};for(let p=0;p<a.length;p+=4){if(a[p]===255&&a[p+1]===0&&a[p+2]===0)counts.red++;if(a[p]===0&&a[p+1]===255&&a[p+2]===0)counts.green++;if(a[p]===0&&a[p+1]===0&&a[p+2]===255)counts.blue++;}return counts;},'data:image/png;base64,'+fs.readFileSync(file).toString('base64'));}
(async()=>{
 const downloadsPath=path.resolve('C:/Users/mahro/AppData/Local/Temp/ultras-editor-downloads');fs.mkdirSync(downloadsPath,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath});
 try{
  const ctx=await browser.newContext({viewport:{width:1550,height:1040},acceptDownloads:true});await ctx.route(/^https?:\/\//,r=>{report.network.push(r.request().url());return r.abort();});page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'..','ultras-editor.html')).href);await page.waitForFunction(()=>window.EditorApp&&document.querySelector('#preview > svg'));await page.evaluate(()=>document.fonts.ready);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=400;const x=c.getContext('2d');['#ff0000','#00ff00','#0000ff'].forEach((color,i)=>{x.fillStyle=color;x.fillRect(i*400,0,400,400);});return c.toDataURL('image/png').split(',')[1];});
  const fixture=path.join(out,'landscape-bands.png');fs.writeFileSync(fixture,Buffer.from(png,'base64'));await page.locator('#field-portrait').setInputFiles(fixture);await page.waitForFunction(()=>window.EditorApp.getState().drafts['02-quote'].images.portrait);
  const originalClips=await clips();
  await check('Zoom supports 0.2 to 3',async()=>{const s=page.locator('input[name="crop-zoom"]');assert.equal(await s.getAttribute('min'),'0.2');assert.equal(await s.getAttribute('max'),'3');});
  await check('Shrinking exposes actual source-image pixels',async()=>{
    await slider('zoom',1);await slider('offsetX',0);await slider('offsetY',0);const before=await frame();const covered=await colors(await download('#exportPng','zoom-1.png'));
    await slider('zoom',0.2);const after=await frame();const shrunk=await colors(await download('#exportPng','zoom-02.png'));
    assert(after.width<before.width*0.3);assert(after.height<before.height*0.3);assert(covered.green>1000);assert.equal(covered.red,0);assert.equal(covered.blue,0);assert(shrunk.red>1000);assert(shrunk.blue>1000);return{before,after,covered,shrunk};
  });
  await check('Pan direction stays consistent above and below zoom one',async()=>{
    const results=[];for(const zoom of [0.2,3]){await slider('zoom',zoom);await slider('offsetX',-1);await slider('offsetY',-1);const low=await frame();await slider('offsetX',1);await slider('offsetY',1);const high=await frame();assert(high.x>low.x);assert(high.y>low.y);results.push({zoom,low,high});}return results;
  });
  await check('Clip geometry stays unchanged while resizing and panning',async()=>{assert.deepEqual(await clips(),originalClips);});
  await check('Contain, recenter and cover controls work',async()=>{
    await page.getByRole('button',{name:'احتواء الصورة كاملة',exact:true}).click();const fit=await frame();const box=await page.locator('#preview #editor-image-0').evaluate(e=>JSON.parse(e.getAttribute('data-editor-image-box')));
    assert(fit.width<=box.width+0.01);assert(fit.height<=box.height+0.01);assert.equal(await page.locator('[name="crop-offsetX"]').inputValue(),'0');assert.equal(await page.locator('[name="crop-offsetY"]').inputValue(),'0');const value=await page.locator('[name="crop-zoom"]').inputValue();assert(Number(value)<1);
    await slider('offsetX',0.6);await slider('offsetY',-0.6);await page.getByRole('button',{name:'توسيط الصورة',exact:true}).click();assert.equal(await page.locator('[name="crop-offsetX"]').inputValue(),'0');assert.equal(await page.locator('[name="crop-offsetY"]').inputValue(),'0');assert.equal(await page.locator('[name="crop-zoom"]').inputValue(),value);
    await page.getByRole('button',{name:'ملء الإطار',exact:true}).click();assert.equal(await page.locator('[name="crop-zoom"]').inputValue(),'1');const cover=await frame();assert(cover.width>=box.width);assert(cover.height>=box.height);return{fit,cover,box,fitZoom:value};
  });
  await check('Zoom below one survives JSON export/import and page reload',async()=>{
    await slider('zoom',0.35);await slider('offsetX',0.4);await slider('offsetY',-0.3);const file=await download('#saveFile','shrunken-project.json');const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(data.crop.portrait.zoom,0.35);assert.equal(data.crop.portrait.offsetX,0.4);
    await slider('zoom',2);await page.locator('#importFile').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('[name="crop-zoom"]').value==='0.35');assert.equal(await page.locator('[name="crop-offsetX"]').inputValue(),'0.4');await page.waitForTimeout(650);await page.reload();await page.waitForFunction(()=>window.EditorApp&&document.querySelector('[name="crop-zoom"]'));assert.equal(await page.locator('[name="crop-zoom"]').inputValue(),'0.35');assert.equal(await page.locator('[name="crop-offsetY"]').inputValue(),'-0.3');return data.crop.portrait;
  });
  await check('No runtime errors or network calls',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);});
  await page.screenshot({path:path.join(out,'shrink-ui.png'),fullPage:false});
  await page.getByRole('button',{name:'استعادة الصورة الأصلية',exact:true}).click();
  await page.getByRole('button',{name:'احتواء الصورة كاملة',exact:true}).click();
  const cropPreview=page.locator('.crop-controls');await cropPreview.screenshot({path:path.resolve(__dirname,'..','crop-controls-preview.png')});
 }catch(e){report.fatal=e.stack;console.error(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'crop-report.json'),JSON.stringify(report,null,2));}
 process.exitCode=report.fatal||report.checks.some(x=>!x.ok)?1:0;
})();
