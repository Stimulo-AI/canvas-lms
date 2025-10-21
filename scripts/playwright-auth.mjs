#!/usr/bin/env node
/**
 * Canvas Playwright Authentication Helper
 *
 * Provides two auth methods for Playwright scripts:
 * 1. API Token (preferred): Use Authorization header
 * 2. Cookie-based: Login via form and save cookies
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = resolve(__dirname, '../.canvas-token.local');

/**
 * Get the Canvas API token from .canvas-token.local
 */
export function getApiToken() {
  try {
    return readFileSync(TOKEN_FILE, 'utf-8').trim();
  } catch (error) {
    console.error('Failed to read API token from .canvas-token.local');
    console.error('Run: docker exec canvas-lms-web-1 bundle exec rails runner /tmp/generate_api_token.rb');
    throw error;
  }
}

/**
 * Authenticate using API token (recommended)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} baseUrl - Canvas base URL (default: http://localhost:3000)
 */
export async function authenticateWithToken(page, baseUrl = 'http://localhost:3000') {
  const token = getApiToken();

  // Set Authorization header for API requests
  await page.setExtraHTTPHeaders({
    'Authorization': `Bearer ${token}`
  });

  // Verify token works by calling the API
  const response = await page.request.get(`${baseUrl}/api/v1/users/self`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok()) {
    throw new Error(`API token authentication failed: ${response.status()}`);
  }

  const user = await response.json();
  console.log(`✓ Authenticated as: ${user.name} (${user.login_id})`);

  return user;
}

/**
 * Authenticate using login form (cookie-based)
 * Use this for UI-based tests that require browser sessions
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.email - Email/username
 * @param {string} credentials.password - Password
 * @param {string} baseUrl - Canvas base URL (default: http://localhost:3000)
 */
export async function authenticateWithLogin(page, credentials = {
  email: 'admin@localhost',
  password: 'AdminCanvas2025!'
}, baseUrl = 'http://localhost:3000') {

  // Navigate to login page
  await page.goto(`${baseUrl}/login`);

  // Fill login form
  await page.fill('input[name="pseudonym_session[unique_id]"]', credentials.email);
  await page.fill('input[name="pseudonym_session[password]"]', credentials.password);

  // Submit form and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]')
  ]);

  // Verify we're logged in (should redirect to dashboard)
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error('Login failed - still on login page');
  }

  console.log(`✓ Logged in successfully (session-based)`);

  return { email: credentials.email };
}

/**
 * Save authentication cookies to file for reuse
 *
 * @param {import('@playwright/test').BrowserContext} context - Browser context
 * @param {string} filePath - Path to save cookies
 */
export async function saveCookies(context, filePath) {
  const cookies = await context.cookies();
  await writeFileSync(filePath, JSON.stringify(cookies, null, 2));
  console.log(`✓ Saved cookies to ${filePath}`);
}

/**
 * Load authentication cookies from file
 *
 * @param {import('@playwright/test').BrowserContext} context - Browser context
 * @param {string} filePath - Path to load cookies from
 */
export async function loadCookies(context, filePath) {
  const cookies = JSON.parse(readFileSync(filePath, 'utf-8'));
  await context.addCookies(cookies);
  console.log(`✓ Loaded cookies from ${filePath}`);
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Canvas Playwright Authentication Helper\n');
  console.log('Usage:');
  console.log('  import { authenticateWithToken, authenticateWithLogin } from "./scripts/playwright-auth.mjs";\n');
  console.log('API Token:');
  console.log(`  ${getApiToken()}\n`);
  console.log('Example (API token):');
  console.log('  const user = await authenticateWithToken(page);\n');
  console.log('Example (login form):');
  console.log('  await authenticateWithLogin(page, { email: "admin@localhost", password: "..." });\n');
}
