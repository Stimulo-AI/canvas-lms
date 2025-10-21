#!/usr/bin/env node
/**
 * Test Canvas Authentication Methods
 *
 * Demonstrates both API token and cookie-based authentication
 * Usage: node scripts/test-auth.mjs [token|login]
 */

import { chromium } from 'playwright';
import { authenticateWithToken, authenticateWithLogin, getApiToken } from './playwright-auth.mjs';

const authMethod = process.argv[2] || 'token';
const baseUrl = process.env.CANVAS_BASE_URL || 'http://localhost:3000';

console.log('\n===========================================');
console.log('Canvas Authentication Test');
console.log('===========================================\n');

if (authMethod === 'token') {
  // Test API token authentication
  console.log('Method: API Token\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  try {
    const user = await authenticateWithToken(page, baseUrl);
    console.log(`✓ User ID: ${user.id}`);
    console.log(`✓ Name: ${user.name}`);
    console.log(`✓ Email: ${user.email || user.login_id}`);
    console.log('\n✓ API token authentication successful!');
  } catch (error) {
    console.error('✗ API token authentication failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }

} else if (authMethod === 'login') {
  // Test cookie-based login
  console.log('Method: Cookie-Based Login\n');

  const browser = await chromium.launch({ headless: false }); // visible for demo
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  try {
    await authenticateWithLogin(page, {
      email: process.env.CANVAS_ADMIN_EMAIL || 'admin@localhost',
      password: process.env.CANVAS_ADMIN_PASSWORD || 'AdminCanvas2025!'
    }, baseUrl);

    // Navigate to dashboard to verify session
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log(`✓ Page title: ${title}`);
    console.log('\n✓ Cookie-based authentication successful!');
    console.log('✓ Browser window will close in 3 seconds...');

    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.error('✗ Cookie-based authentication failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }

} else {
  console.error('Invalid method. Use: token or login');
  process.exit(1);
}

console.log('\n===========================================\n');
