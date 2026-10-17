import puppeteer from '../tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { createServer } from './server.mjs';
const srv=createServer();await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
const url=`http://127.0.0.1:${srv.address().port}/${process.argv[2]||'video/bench/index.html'}`;
const b=await puppeteer.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars']});
const pg=await b.newPage();await pg.setViewport({width:1920,height:1080});pg.on('console',m=>console.log('console:',m.text()));pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.goto(url);await pg.waitForFunction('window.ready===true',{timeout:120000});
console.log(await pg.evaluate('window.info&&window.info()'));
const cdp=await pg.createCDPSession();
for(let i=0;i<6;i++){const t0=Date.now();await pg.evaluate(t=>window.renderFrameAt(t),i/30);const t1=Date.now();
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',optimizeForSpeed:true});const t2=Date.now();
 console.log('render',t1-t0,'ms capture',t2-t1,'ms',shot.data.length);}
await b.close();srv.close();
