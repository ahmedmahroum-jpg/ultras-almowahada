const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1550,height:1040}});
    await context.route(/^https?:\/\//,r=>r.abort());
    const page=await context.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','ultras-editor.html')).href);
    await page.waitForFunction(()=>window.EditorApp && document.querySelector('#preview > svg'));
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.resolve(__dirname,'..','preview.png'),fullPage:false});
    await page.evaluate(()=>window.EditorApp.selectTemplate('04-important-news'));
    await page.screenshot({path:path.resolve(__dirname,'..','preview-news.png'),fullPage:false});
    console.log('Saved editor/preview.png and editor/preview-news.png');
  }finally {await browser.close();}
})();
