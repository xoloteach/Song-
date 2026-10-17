import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const tools={
 'Node.js':[['node','--version']],
 'Python':[['python3','--version'],['python','--version']],
 'FFmpeg':[['ffmpeg','-version']],
 'ffprobe':[['ffprobe','-version']],
 'Chrome/Chromium':[['google-chrome','--version'],['chromium','--version'],['chromium-browser','--version'],['chrome','--version']],
 'Blender (optional)':[['blender','--version']]
};
console.log('\nMUSIC VIDEO TOOLS — capability check\n');
let missing=0;
for(const [name, candidates] of Object.entries(tools)){
 let found=null;
 for(const [cmd,arg] of candidates){try{const r=spawnSync(cmd,[arg],{encoding:'utf8',timeout:5000,windowsHide:true});if(r.status===0){found=`${cmd} — ${(r.stdout||r.stderr).split('\n')[0]}`;break}}catch{}}
 console.log(`${found?'[OK]':'[--]'} ${name}: ${found||'not available'}`);
 if(!found && !name.includes('optional')) missing++;
}
for(const lib of ['three','animejs','puppeteer-core']){
 const ok=existsSync(join(root,'node_modules',lib,'package.json'));
 console.log(`${ok?'[OK]':'[--]'} npm ${lib}: ${ok?'installed':'run npm install'}`);
 if(!ok) missing++;
}
console.log(`\n${missing?'Install missing requirements before rendering.':'Ready for HTML rendering.'}\n`);
