const {chromium}=require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path');
(async()=>{
 const out=path.resolve('C:/Users/mahro/AppData/Local/Temp/ultras-editor-downloads');require('fs').mkdirSync(out,{recursive:true});
 const server=require('http').createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(require('fs').readFileSync(path.resolve(__dirname,'..','ultras-editor.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:out});
 const context=await browser.newContext({acceptDownloads:true});
 const browserSession=await browser.newBrowserCDPSession();
 browserSession.on('Browser.downloadWillBegin',x=>console.log('willbegin',x));
 browserSession.on('Browser.downloadProgress',x=>console.log('progress',x));
 await browserSession.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:out,eventsEnabled:true});
 const page=await context.newPage();
 page.on('console',m=>console.log('console',m.text()));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.EditorApp);
 const pending=page.waitForEvent('download');await page.locator('#saveFile').click();const d=await pending;
 console.log('download',d.suggestedFilename(),'failure',await d.failure());
 try{await d.saveAs(path.join(out,'debug.json'));console.log('SAVED');}catch(e){console.log('save',e.message);}
 await page.setContent('<button id="test">save test</button>');
 await page.evaluate(()=>document.querySelector('#test').onclick=()=>{const url=URL.createObjectURL(new Blob(['hello'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='hello.txt';document.body.append(a);a.click();});
 const pending2=page.waitForEvent('download');await page.locator('#test').click();const d2=await pending2;
 console.log('testdownload',d2.suggestedFilename(),'failure',await d2.failure());
 const downloads=await context.newPage();await downloads.goto('chrome://downloads');await downloads.waitForTimeout(500);console.log('DOWNLOADS UI',await downloads.evaluate(()=>({items:document.querySelector('downloads-manager').items_,text:document.querySelector('downloads-manager').shadowRoot.innerHTML.slice(0,600)})));
 await browser.close();server.close();
})();
