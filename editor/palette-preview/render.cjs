const {chromium}=require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu','--no-sandbox']});
 const assets=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
 for(const a of assets){
  const p=await b.newPage({viewport:{width:a.width,height:a.height},deviceScaleFactor:1});
  const svg=fs.readFileSync(path.join(__dirname,a.id+'.svg'),'utf8');
  await p.setContent('<html><style>body{margin:0}svg{display:block}</style><body>'+svg+'</body></html>');
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:path.join(__dirname,a.id+'.png')});await p.close();
 }
 const p=await b.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 await p.goto(pathToFileURL(path.join(__dirname,'../palette-comparison.html')).href);
 await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 for(const id of ['intro','story']){
  await p.locator('#'+id).screenshot({path:path.join(__dirname,id+'-comparison.png')});
 }
 console.log('Rendered four full-size variants and two comparison images.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
