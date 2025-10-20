import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const BASE = process.env.CANVAS_BASE_URL || 'http://localhost:3000';
const ACC  = process.env.CANVAS_ACCOUNT_ID || '1';
const STATE= process.env.PLAYWRIGHT_STATE || 'auth.json';
const NAME = process.env.THEME_NAME || 'Stimulo';
const DIST = path.resolve('theme','dist');

if(!fs.existsSync(path.join(DIST,'stimulo.css'))) throw new Error('Run prepare first');

const b=await chromium.launch(); const ctx=await b.newContext({ storageState: fs.existsSync(STATE)?STATE:undefined, baseURL: BASE }); const p=await ctx.newPage();
if(!fs.existsSync(STATE)){ await p.goto('/login'); process.stdout.write('Login then press Enter\n'); process.stdin.resume(); await new Promise(r=>process.stdin.once('data',r)); await ctx.storageState({path:STATE}); }

await p.goto(`/accounts/${ACC}/themes`);
const has = await p.locator(`text=${NAME}`).first().isVisible().catch(()=>false);
if(has){ await p.getByRole('link',{name:NAME}).first().click(); await p.getByRole('button',{name:/Edit/i}).click(); }
else{ await p.getByRole('button',{name:/Create theme/i}).click(); await p.getByLabel(/Theme name/i).fill(NAME); }

const up = async (lab,file) => { const f=path.join(DIST,file); if(fs.existsSync(f)) await p.getByLabel(new RegExp(lab,'i')).setInputFiles(f); };
await up('Upload CSS','stimulo.css'); await up('Upload JavaScript','stimulo.js'); await up('Logo','logo.png'); await up('Favicon','favicon.ico');

await p.getByRole('button',{name:/Save theme/i}).click();
await p.getByRole('button',{name:/Apply theme/i}).click();
console.log('Applied theme',NAME); await b.close();
