# Session Authentication Fix Summary

**Date:** 2025-10-21
**Issue:** Canvas LMS session/auth failures blocking theme updates and Playwright automation

---

## Problems Fixed

### 1. Session Cookie Encryption Failures
- **Root cause:** Session secret key got out of sync with ENCRYPTION_KEY
- **Symptoms:**
  - "Invalid token" errors
  - Multi-browser login failures
  - Theme preview not persisting
  - Random authentication failures

**Resolution:**
- Deleted old session_secret_key from database
- Restarted web container to regenerate fresh secret
- Secret now matches ENCRYPTION_KEY environment variable

### 2. Cookie-Based Authentication Requirement
- **Problem:** All auth required cookies, blocking automation
- **Solution:** Added API token authentication for programmatic access

---

## What Was Created

### 1. API Access Token
**File:** `.canvas-token.local`
**Token:** `PBnGfFaKDJfKAuVHcJJuL2ac487aPLe2BCtVyGYPRyxftcZhTkDKAGZWV27yHZWQ`
**User:** admin@localhost
**Expires:** Never (local dev only)

### 2. Token Generation Script
**File:** `scripts/generate_api_token.rb`

**Usage:**
```bash
docker exec canvas-lms-web-1 bundle exec rails runner /tmp/generate_api_token.rb
```

### 3. Playwright Authentication Helper
**File:** `scripts/playwright-auth.mjs`

**Features:**
- `getApiToken()` - Read token from `.canvas-token.local`
- `authenticateWithToken(page)` - API-based auth for HTTP requests
- `authenticateWithLogin(page, credentials)` - Form-based auth for UI tests
- `saveCookies()` / `loadCookies()` - Cookie persistence helpers

### 4. Updated Theme Upload Script
**File:** `theme/upload-theme.playwright.mjs`

**Changes:**
- Removed manual login prompt
- Uses `authenticateWithLogin()` for automatic authentication
- No longer requires `auth.json` state file
- Supports environment variables for credentials

### 5. Authentication Test Script
**File:** `scripts/test-auth.mjs`

**Usage:**
```bash
# Test API token auth
node scripts/test-auth.mjs token

# Test cookie-based login (requires Playwright installed)
node scripts/test-auth.mjs login
```

### 6. Comprehensive Documentation
**File:** `docs/AUTHENTICATION.md`

**Covers:**
- API token authentication
- Cookie-based authentication
- Playwright automation patterns
- Troubleshooting guide
- Security best practices

---

## How to Use

### For API Access (No Cookies)

**curl:**
```bash
curl -H 'Authorization: Bearer PBnGfFaKDJfKAuVHcJJuL2ac487aPLe2BCtVyGYPRyxftcZhTkDKAGZWV27yHZWQ' \
  http://localhost:3000/api/v1/users/self
```

**JavaScript:**
```javascript
import { getApiToken } from './scripts/playwright-auth.mjs';

const token = getApiToken();
const response = await fetch('http://localhost:3000/api/v1/courses', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### For UI Automation (Requires Cookies)

**Playwright:**
```javascript
import { authenticateWithLogin } from './scripts/playwright-auth.mjs';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Login automatically
await authenticateWithLogin(page);

// Now you can interact with the UI
await page.goto('/accounts/1/theme_editor');
```

### For Theme Uploads

**Automatic (recommended):**
```bash
yarn theme:prepare  # Build theme assets
yarn theme:upload   # Upload to Canvas (auto-login)
```

**Manual:**
```bash
node theme/upload-theme.playwright.mjs
```

---

## Important Notes

### Cookie Clearing Required

**All users must clear browser cookies for `localhost:3000`** after the session secret reset.

**Chrome/Edge:**
1. Press F12
2. Application tab → Storage → Cookies
3. Right-click `http://localhost:3000` → Clear

**Firefox:**
1. Press F12
2. Storage tab → Cookies
3. Right-click `http://localhost:3000` → Delete All

### Security Warnings

⚠️ **The API token has FULL admin access**
⚠️ **Never commit `.canvas-token.local` to git** (already in .gitignore)
⚠️ **Token never expires** - suitable for local dev only
⚠️ **Regenerate token if shared** via screen sharing or logs

### Environment Variables

Create `.env` in project root (already gitignored):
```env
CANVAS_ADMIN_EMAIL=admin@localhost
CANVAS_ADMIN_PASSWORD=AdminCanvas2025!
CANVAS_BASE_URL=http://localhost:3000
CANVAS_ACCOUNT_ID=1
```

---

## Verification Steps

### 1. Test API Token
```bash
curl -H 'Authorization: Bearer PBnGfFaKDJfKAuVHcJJuL2ac487aPLe2BCtVyGYPRyxftcZhTkDKAGZWV27yHZWQ' \
  http://localhost:3000/api/v1/users/self
```

**Expected:** JSON with user info (id, name, email)

### 2. Test Manual Login
```bash
# 1. Clear cookies
# 2. Navigate to http://localhost:3000/login
# 3. Login: admin@localhost / AdminCanvas2025!
# 4. Should stay logged in across tabs
```

### 3. Test Playwright (when installed)
```bash
yarn add -D @playwright/test playwright  # Install first
node scripts/test-auth.mjs token         # Test API token
node scripts/test-auth.mjs login         # Test form login
```

---

## Files Modified

| File | Change |
|------|--------|
| Database | Deleted + regenerated `session_secret_key` |
| `.gitignore` | Added `.canvas-token.local` |
| `theme/upload-theme.playwright.mjs` | Auto-login via helper |

## Files Created

| File | Purpose |
|------|---------|
| `.canvas-token.local` | API token storage |
| `scripts/generate_api_token.rb` | Token generation |
| `scripts/playwright-auth.mjs` | Auth helper library |
| `scripts/test-auth.mjs` | Auth testing script |
| `docs/AUTHENTICATION.md` | Complete auth guide |
| `docs/SESSION_FIX_SUMMARY.md` | This document |

---

## Theme Data Status

✓ **All theme data preserved:**
- Brand config: `2ef51db08ad231abb07ee099cc340790`
- Stimulo purple: `#8e44ad`
- Logo files in MinIO: attachments 9-13
- Account 1 theme active

✓ **Background jobs completed:** All 18 theme sync jobs finished successfully

---

## Next Steps

1. **Clear cookies** in all browsers accessing localhost:3000
2. **Test login** - verify session persists across tabs
3. **Install Playwright** (optional):
   ```bash
   yarn add -D @playwright/test playwright
   ```
4. **Run theme upload** to verify end-to-end workflow:
   ```bash
   yarn theme:upload
   ```

---

## Troubleshooting

See `docs/AUTHENTICATION.md` for detailed troubleshooting steps.

**Quick diagnostics:**
```bash
# Check session secret
docker exec canvas-lms-db-1 psql -U canvas -d canvas_production \
  -c "SELECT name, created_at FROM settings WHERE name = 'session_secret_key';"

# Check API token
docker exec canvas-lms-db-1 psql -U canvas -d canvas_production \
  -c "SELECT id, purpose, workflow_state FROM access_tokens;"

# Check container health
docker ps --filter "name=canvas-lms-web"

# Check logs
docker logs canvas-lms-web-1 --tail 50
```

---

**Questions?** See `docs/AUTHENTICATION.md` for comprehensive documentation.
