# CSRF "Invalid Authenticity Token" Fix

**Date:** 2025-10-21
**Issue:** Login form failing with "Invalid Authenticity Token"

---

## Root Cause

**Problem:** Session cookies require HTTPS with `Secure` flag

Canvas production mode has `config.force_ssl = true` hardcoded in:
```ruby
# config/environments/production.rb:72
config.force_ssl = true
```

This causes session cookies to be set with:
- `Secure` flag (requires HTTPS)
- `SameSite=None` (requires Secure flag)

**Result:** Browsers reject cookies over HTTP → no session → CSRF tokens fail

---

## The Fix

### 1. Created Local Production Override

**File:** `config/environments/production-local.rb`

```ruby
# Disable force_ssl for local HTTP development
config.force_ssl = ENV.fetch("FORCE_SSL", "false") == "true"
```

### 2. Mounted as Volume

**File:** `docker-compose.oci-local.yml`

```yaml
web:
  volumes:
    - ./config/environments/production-local.rb:/usr/src/app/config/environments/production-local.rb
```

### 3. Result

**Before:**
```ruby
{key: "_normandy_session", same_site: :none, secure: true, ...}
```
❌ Cookies rejected over HTTP

**After:**
```ruby
{key: "_normandy_session", expire_after: 1 day, ...}
```
✅ Cookies work over HTTP

---

## How to Verify

### 1. Check Config Loaded
```bash
docker logs canvas-lms-web-1 2>&1 | grep "LOCAL CONFIG"
# Should show: [LOCAL CONFIG] force_ssl set to: false
```

### 2. Check Session Options
```bash
docker exec canvas-lms-web-1 bundle exec rails runner \
  "puts CanvasRails::Application.config.session_options.inspect"
# Should NOT have: secure: true, same_site: :none
```

### 3. Test Cookie Setting
```bash
curl -v http://localhost:3000/login 2>&1 | grep "Set-Cookie"
# Should see: _normandy_session=... (without Secure flag)
```

### 4. Test Login
1. Clear browser cookies for localhost:3000
2. Navigate to http://localhost:3000/login
3. Enter: admin@localhost / AdminCanvas2025!
4. Should redirect to dashboard

---

## For Production Deployments

⚠️ **This fix is for LOCAL DEVELOPMENT ONLY**

For real production:
1. Use HTTPS (Let's Encrypt, CloudFlare, load balancer SSL)
2. Keep `force_ssl = true` in production.rb
3. Either:
   - Remove `production-local.rb` mount from docker-compose
   - Set `FORCE_SSL=true` environment variable

---

## Troubleshooting

### Still Getting CSRF Errors?

**1. Clear browser cache & cookies**
   - Chrome/Edge: F12 → Application → Clear storage
   - Firefox: F12 → Storage → Clear all

**2. Verify config is loaded**
```bash
docker logs canvas-lms-web-1 | grep "LOCAL CONFIG"
```

**3. Check no env override**
```bash
docker exec canvas-lms-web-1 printenv FORCE_SSL
# Should show: false
```

**4. Recreate container if needed**
```bash
docker compose -f docker-compose.oci-local.yml stop web
docker compose -f docker-compose.oci-local.yml rm -f web
docker compose -f docker-compose.oci-local.yml up -d web
```

---

## Files Modified

| File | Change |
|------|--------|
| `config/environments/production-local.rb` | Created (override force_ssl) |
| `docker-compose.oci-local.yml` | Added volume mount for override file |

---

**Questions?** See `docs/AUTHENTICATION.md` for comprehensive auth documentation.
