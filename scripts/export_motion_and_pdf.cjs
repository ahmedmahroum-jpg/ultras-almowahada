// Deterministic export of the authored HTML assets; no image generation or network.
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const {chromium} = require('C:/Users/mahro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const mode = process.argv[2] || 'pdf';
  const input = path.resolve(process.argv[3] || (mode === 'pdf' ? 'output/identity/guide.html' : 'output/identity/motion-preview.html'));
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
    await page.goto(pathToFileURL(input).href);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    if(mode==='pdf') {
      fs.mkdirSync('output/pdf',{recursive:true});
      await page.pdf({path:'output/pdf/ultras-brand-guide.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'10mm',right:'10mm',bottom:'10mm',left:'10mm'}});
      console.log('PDF exported.');
    } else {
      const frames=path.resolve('tmp/motion-frames'); fs.mkdirSync(frames,{recursive:true});
      const animations=await page.evaluate(()=>{const a=document.getAnimations({subtree:true});a.forEach(x=>x.pause());return a.length;});
      if(!animations) throw new Error('Motion page contains no animations.');
      for(let i=0;i<192;i++) {
        await page.evaluate(t=>document.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t;}),i*1000/24);
        await page.screenshot({path:path.join(frames,`${String(i).padStart(4,'0')}.png`)});
        if(i%48===0) console.log(`Captured ${i}/192 frames.`);
      }
      console.log('Captured 192 motion frames at 24 fps.');
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
