#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createStaticServer } from './serve.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const args={};for(let i=2;i<process.argv.length;i++){const s=process.argv[i];if(s.startsWith('--'))args[s.slice(2)]=process.argv[i+1]?.startsWith('--')?'':process.argv[++i]}
if(args.help||!args.scene){console.log('node scripts/render.mjs --scene demos/canvas2d.html [--audio path/to/song.mp3 | --duration 3] [--output final/video.mp4] [--fps 30 --width 1920 --height 1080]');process.exit(args.help?0:1)}
const scene=resolve(root,args.scene),audio=args.audio?resolve(root,args.audio):null;
if(!scene.startsWith(root+sep)||!existsSync(scene))throw Error('Scene must exist inside tools folder: '+scene);
if(audio&&!existsSync(audio))throw Error('Audio file missing: '+audio);
const output=resolve(root,args.output||'final/music-video.mp4');mkdirSync(dirname(output),{recursive:true});
const fps=Number(args.fps||30),width=Number(args.width||1920),height=Number(args.height||1080);
if(![fps,width,height].every(Number.isFinite)||fps<1||fps>120||width<16||height<16)throw Error('Invalid dimensions or fps');
function ffprobe(file){const result=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file],{encoding:'utf8'});if(result.status!==0)throw Error('ffprobe failed: '+result.stderr);return Number(result.stdout.trim())}
const duration=audio?ffprobe(audio):Number(args.duration);
if(!Number.isFinite(duration)||duration<=0)throw Error('Supply valid --duration or --audio');
let puppeteer;try{puppeteer=(await import('puppeteer-core')).default}catch{throw Error('Missing puppeteer-core. Run npm install from tools/ first.')}
let executable=args.chrome||process.env.CHROME_PATH;
if(!executable){for(const c of ['google-chrome','chromium','chromium-browser','chrome','chrome.exe']){const res=spawnSync(process.platform==='win32'?'where':'which',[c],{encoding:'utf8'});if(res.status===0){executable=res.stdout.trim().split(/\r?\n/)[0];break}}}
if(!executable)throw Error('Chrome/Chromium executable not found. Set CHROME_PATH or --chrome <path>.');
const server=createStaticServer();await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
const port=server.address().port;let browser;const frames=join(os.tmpdir(),`music-video-tools-${process.pid}`);mkdirSync(frames,{recursive:true});
try{
 browser=await puppeteer.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle']});
 const page=await browser.newPage();await page.setViewport({width,height,deviceScaleFactor:1});
 page.on('pageerror',err=>console.error('PAGE ERROR:',err.message));
 await page.goto(`http://127.0.0.1:${port}/${scene.slice(root.length+1).split(sep).join('/')}`,{waitUntil:'networkidle0',timeout:60000});
 await page.waitForFunction('typeof window.renderFrameAt === "function"',{timeout:20000});
 const total=Math.ceil(duration*fps);
 console.log(`Rendering ${total} frames (${width}x${height} @ ${fps}fps) from ${scene}`);
 for(let i=0;i<total;i++){
  const t=i/fps;await page.evaluate(async sec=>{await window.renderFrameAt(sec)},t);
  await page.screenshot({path:join(frames,`${String(i).padStart(7,'0')}.png`),type:'png',omitBackground:false});
  if(i===0||i===total-1||i%30===0)console.log(`Frame ${i+1}/${total} at ${t.toFixed(2)}s`);
 }
 await browser.close();browser=null;
 const ffargs=['-hide_banner','-y','-framerate',String(fps),'-i',join(frames,'%07d.png')];
 if(audio)ffargs.push('-i',audio);
 ffargs.push('-t',String(duration),'-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p');
 if(audio)ffargs.push('-map','0:v:0','-map','1:a:0','-c:a','aac','-b:a','192k');else ffargs.push('-an');
 ffargs.push('-movflags','+faststart',output);
 await new Promise((ok,bad)=>{const child=spawn('ffmpeg',ffargs,{stdio:'inherit'});child.once('error',bad);child.once('close',code=>code===0?ok():bad(Error('FFmpeg exited '+code)))});
 console.log('Final video:',output);
}catch(e){console.error(e.stack||e.message);process.exitCode=1}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));if(!args['keep-frames'])rmSync(frames,{recursive:true,force:true});else console.log('Frames kept:',frames)}
