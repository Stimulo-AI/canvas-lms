# Canvas LMS Authentication Guide

This guide covers authentication methods for local production mode, including API token usage and Playwright automation.

## Table of Contents

1. [Overview](#overview)
2. [API Token Authentication](#api-token-authentication)
3. [Cookie-Based Authentication](#cookie-based-authentication)
4. [Playwright Automation](#playwright-automation)
5. [Troubleshooting](#troubleshooting)

---

## Overview

Canvas LMS supports multiple authentication methods:

| Method | Use Case | Cookies Required |
|--------|----------|-----------------|
| **Cookie/Session** | Browser-based UI access | ✓ Yes |
| **API Token** | Programmatic API access | ✗ No |
| **OAuth 2.0** | Third-party integrations | ✗ No |

For **local production mode**, we provide simplified authentication helpers.

---

## API Token Authentication

API tokens allow programmatic access without browser sessions.

### Generate a Token

```bash
# Generate token for admin user
docker exec canvas-lms-web-1 bundle exec rails runner /tmp/generate_api_token.rb
```

**Output:**
```
Token: PBnGfFaKDJfKAuVHcJJuL2ac487aPLe2BCtVyGYPRyxftcZhTkDKAGZWV27yHZWQ
User: admin@localhost
Purpose: Local Development - Playwright Automation
Expires: Never (local dev only)
```

The token is automatically saved to `.canvas-token.local`.

### Use the Token

**curl Example:**
```bash
# Fetch current user info
curl -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  http://localhost:3000/api/v1/users/self

# List courses
curl -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  http://localhost:3000/api/v1/courses
```

**JavaScript/Node Example:**
```javascript
const token = 'YOUR_TOKEN_HERE';
const response = await fetch('http://localhost:3000/api/v1/users/self', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const user = await response.json();
console.log(user);
```

**Playwright API Requests:**
```javascript
import { getApiToken } from './scripts/playwright-auth.mjs';

const token = getApiToken();

// Make API request
const response = await page.request.get('http://localhost:3000/api/v1/users/self', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const user = await response.json();
```

### Important Notes

- **Local development only** - Never commit tokens or use in production
- **Full access** - Token has same permissions as the user
- **No expiration** - Token persists until manually deleted
- **API only** - Won't work for UI-based features (Theme Editor, etc.)

---

## Cookie-Based Authentication

Required for UI interactions and browser-based workflows.

### Manual Login

1. Clear browser cookies for `localhost:3000`
   - Chrome/Edge: F12 → Application → Cookies → Right-click → Clear
   - Firefox: F12 → Storage → Cookies → Right-click → Delete All

2. Navigate to `http://localhost:3000/login`

3. Login with credentials:
   ```
   Email: admin@localhost
   Password: AdminCanvas2025!
   ```

### Programmatic Login (Playwright)

Use the authentication helper:

```javascript
import { authenticateWithLogin } from './scripts/playwright-auth.mjs';

// Default credentials (admin@localhost)
await authenticateWithLogin(page);

// Custom credentials
await authenticateWithLogin(page, {
  email: 'user@example.com',
  password: 'password123'
}, 'http://localhost:3000');
```

### Environment Variables

Configure credentials via environment variables:

```bash
export CANVAS_ADMIN_EMAIL=admin@localhost
export CANVAS_ADMIN_PASSWORD=AdminCanvas2025!
```

Or in `.env`:
```env
CANVAS_ADMIN_EMAIL=admin@localhost
CANVAS_ADMIN_PASSWORD=AdminCanvas2025!
```

---

## Playwright Automation

### Quick Start

1. **Install dependencies:**
   ```bash
   yarn add -D @playwright/test playwright
   ```

2. **Import auth helper:**
   ```javascript
   import {
     authenticateWithToken,
     authenticateWithLogin
   } from './scripts/playwright-auth.mjs';
   ```

3. **Choose authentication method:**

   **For API calls:**
   ```javascript
   const user = await authenticateWithToken(page);
   ```

   **For UI interactions:**
   ```javascript
   await authenticateWithLogin(page);
   await page.goto('/accounts/1/theme_editor');
   ```

### Complete Example: Theme Upload

```javascript
import { chromium } from 'playwright';
import { authenticateWithLogin } from './scripts/playwright-auth.mjs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: 'http://localhost:3000'
});
const page = await context.newPage();

// Authenticate
await authenticateWithLogin(page);

// Navigate to theme editor
await page.goto('/accounts/1/themes');

// Upload theme assets
await page.getByRole('button', { name: /Create theme/i }).click();
await page.getByLabel(/Theme name/i).fill('My Theme');
await page.getByLabel(/Upload CSS/i).setInputFiles('./theme.css');
await page.getByRole('button', { name: /Save theme/i }).click();

await browser.close();
```

### Run Theme Upload Script

```bash
# Prepare theme assets
yarn theme:prepare

# Upload to Canvas
yarn theme:upload
```

---

## Troubleshooting

### "Invalid Token" Error

**Problem:** Seeing "invalid token" or auth failures after session secret reset.

**Solution:**
1. Clear browser cookies for `localhost:3000`
2. Regenerate API token if needed
3. Delete `auth.json` if using Playwright state persistence

### Playwright Login Fails

**Problem:** Login form submission doesn't work.

**Checklist:**
- Web container is healthy: `docker ps`
- Login page loads: `curl http://localhost:3000/login`
- Credentials are correct (check `.env.production.local`)
- Session secret exists in database
- No CSRF errors in logs

**Debug:**
```bash
# Check container logs
docker logs canvas-lms-web-1 --tail 50

# Verify session secret
docker exec canvas-lms-db-1 psql -U canvas -d canvas_production \
  -c "SELECT name, created_at FROM settings WHERE name = 'session_secret_key';"
```

### API Token Returns 401

**Problem:** API requests fail with 401 Unauthorized.

**Possible causes:**
1. Token expired or deleted
2. User account locked/deleted
3. Token string copied incorrectly

**Solution:**
```bash
# Regenerate token
docker exec canvas-lms-web-1 bundle exec rails runner /tmp/generate_api_token.rb

# Verify token in database
docker exec canvas-lms-db-1 psql -U canvas -d canvas_production \
  -c "SELECT id, user_id, purpose FROM access_tokens WHERE workflow_state = 'active';"
```

### Session Expires Immediately

**Problem:** Login works but session expires on refresh.

**Causes:**
- ENCRYPTION_KEY changed
- Redis cleared
- Cookie domain mismatch

**Fix:**
```bash
# Reset session secret
docker exec canvas-lms-db-1 psql -U canvas -d canvas_production \
  -c "DELETE FROM settings WHERE name = 'session_secret_key';"

docker restart canvas-lms-web-1

# Clear browser cookies and login again
```

---

## Security Best Practices

### Local Development

✓ Use API tokens for automation
✓ Keep `.canvas-token.local` in `.gitignore`
✓ Use environment variables for credentials
✓ Regenerate tokens after sharing screen/logs

### Production Deployments

✗ Never use permanent tokens (set expiration)
✗ Never commit tokens to git
✗ Never share tokens in plain text
✓ Use OAuth 2.0 for third-party integrations
✓ Enable FORCE_SSL and HTTPS
✓ Rotate tokens regularly

---

## Additional Resources

- [Canvas REST API Documentation](https://canvas.instructure.com/doc/api/)
- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [OAuth 2.0 Setup](https://canvas.instructure.com/doc/api/file.oauth.html)

---

**Generated:** 2025-10-21
**Canvas Version:** Production (local mode)
