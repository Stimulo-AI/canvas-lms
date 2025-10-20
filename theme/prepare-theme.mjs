import fs from 'fs'; import path from 'path';
const SRC = path.resolve('..','stimulo-ai','Stimulo','client');
const OUT = path.resolve('theme','dist'); fs.mkdirSync(OUT,{recursive:true});
const cfg = JSON.parse(fs.readFileSync(path.join(SRC,'tokens','default.json'),'utf-8'));
const emit=(p,o,buf=[])=>{for(const[k,v]of Object.entries(o||{})) typeof v==='string'?buf.push(`--${p}-${k}:${v};`):emit(`${p}-${k}`,v,buf); return buf};
const cssVars = `:root{${emit('color-brand',cfg.colors?.brand).join('')}${emit('color-neutral',cfg.colors?.neutral).join('')}${emit('color-accent',cfg.colors?.accent).join('')}}`;
const css = `${cssVars}
.Button,.btn{background-color:var(--color-brand-500)!important;border-color:var(--color-brand-600)!important}
.Button:hover,.btn:hover{background-color:var(--color-brand-600)!important}
a,.ic-Action--link{color:var(--color-brand-600)!important}
.ic-app-header__logomark svg [fill]{fill:var(--color-brand-500)!important}`;
fs.writeFileSync(path.join(OUT,'stimulo.css'),css);
fs.writeFileSync(path.join(OUT,'stimulo.js'),'/* placeholder */');
const tryCopy=(rel,cands=[])=>{if(!rel)return; const first=[rel,...cands].map(p=>path.join(SRC,p)).find(fs.existsSync); if(first) fs.copyFileSync(first,path.join(OUT,path.basename(first)));};
tryCopy(cfg.logo,['public/logo.png','assets/logo.png','static/logo.png']);
tryCopy(cfg.favicon,['public/favicon.ico','assets/favicon.ico','static/favicon.ico']);
console.log('Built theme to',OUT);
