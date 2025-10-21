import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { authenticateWithLogin } from '../scripts/playwright-auth.mjs';

const BASE = process.env.CANVAS_BASE_URL || 'http://localhost:3000';
const ACC  = process.env.CANVAS_ACCOUNT_ID || '1';
const NAME = process.env.THEME_NAME || 'Stimulo';
const DIST = path.resolve('theme', 'dist');

if (!fs.existsSync(path.join(DIST, 'stimulo.css'))) {
  throw new Error('Run theme:prepare first to build theme assets');
}

// Launch browser and authenticate automatically
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ baseURL: BASE });
const p = await ctx.newPage();

// Authenticate with form login (required for Theme Editor UI)
console.log('Authenticating with Canvas...');
await authenticateWithLogin(p, {
  email: process.env.CANVAS_ADMIN_EMAIL || 'admin@localhost',
  password: process.env.CANVAS_ADMIN_PASSWORD || 'AdminCanvas2025!'
}, BASE);

await p.goto(`/accounts/${ACC}/themes`);
const has = await p.locator(`text=${NAME}`).first().isVisible().catch(()=>false);
if(has){ await p.getByRole('link',{name:NAME}).first().click(); await p.getByRole('button',{name:/Edit/i}).click(); }
else{ await p.getByRole('button',{name:/Create theme/i}).click(); await p.getByLabel(/Theme name/i).fill(NAME); }

const up = async (lab,file) => { const f=path.join(DIST,file); if(fs.existsSync(f)) await p.getByLabel(new RegExp(lab,'i')).setInputFiles(f); };
await up('Upload CSS','stimulo.css'); await up('Upload JavaScript','stimulo.js'); await up('Logo','logo.png'); await up('Favicon','favicon.ico');

await p.getByRole('button',{name:/Save theme/i}).click();
await p.getByRole('button',{name:/Apply theme/i}).click();
console.log('Applied theme',NAME); await b.close();
