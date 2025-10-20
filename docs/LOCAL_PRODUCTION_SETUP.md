# Canvas LMS Local Production Setup

Quick setup guide for running Canvas LMS in production mode locally with complete infrastructure stack including S3-compatible object storage.

## Overview

This setup provides a complete production environment running locally via Docker Compose, including:
- Canvas LMS (web + background jobs)
- PostgreSQL database
- Redis cache
- MinIO (S3-compatible object storage)
- MailHog (email testing)

## Prerequisites

- Docker and Docker Compose installed
- 8GB+ RAM available
- Git

## Quick Start (Clone to Login in ~15 minutes)

### 1. Build Images

```bash
docker compose -f docker-compose.oci-local.yml build
```

This will build the Canvas production image. Takes 10-15 minutes on first run.

### 2. Start Services

```bash
docker compose -f docker-compose.oci-local.yml up -d
```

Wait 30-60 seconds for health checks to pass. Check status:

```bash
docker compose -f docker-compose.oci-local.yml ps
```

All services should show "healthy" status.

### 3. Initialize Database (One-time)

```bash
docker compose -f docker-compose.oci-local.yml run --rm \
  -e CANVAS_LMS_STATS_COLLECTION=opt_out \
  web bundle exec rake db:create db:initial_setup
```

This creates the database, runs migrations, and sets up the admin user. Takes 5-10 minutes.

### 4. Access Canvas

Open http://localhost:3000 in your browser

**Default Admin Credentials:**
- Email: `admin@localhost`
- Password: `AdminCanvas2025!`

## Service Endpoints

| Service | URL | Credentials |
|---------|-----|-------------|
| Canvas LMS | http://localhost:3000 | admin@localhost / AdminCanvas2025! |
| MinIO Console | http://localhost:9001 | localaccess / localsecret |
| MailHog (Email) | http://localhost:8025 | (no auth) |
| PostgreSQL | localhost:5432 | canvas / secret |
| Redis | localhost:6379 | password: secret |

## Configuration Notes

### HTTP vs HTTPS

The local setup uses **HTTP** with `FORCE_SSL=false` to enable session cookies without SSL certificates. This is configured via environment variable in `docker-compose.oci-local.yml`.

**For production deployments:** Set `FORCE_SSL=true` and use HTTPS with valid SSL certificates.

### Domain Configuration

Canvas uses `localhost:3000` for the local setup. On container restarts, the domain configuration may revert to the baked-in default (`canvas.docker`).

**If you get "Invalid Authenticity Token" errors after restart:**

```bash
# Fix domain configuration
docker compose -f docker-compose.oci-local.yml exec web bash -c \
  'echo "production:
  domain: localhost:3000
  files_domain: localhost:3000" > config/domain.yml'

# Restart web service
docker compose -f docker-compose.oci-local.yml restart web
```

### S3 Object Storage

MinIO provides S3-compatible storage locally. Files are stored in the Docker volume `canvas-lms_miniodata`.

- Bucket name: `canvas-files`
- Access: http://localhost:9001
- Credentials: localaccess / localsecret

### Email Testing

MailHog captures all outgoing emails. View them at http://localhost:8025

## Common Commands

```bash
# View logs
docker compose -f docker-compose.oci-local.yml logs -f web

# Access Rails console
docker compose -f docker-compose.oci-local.yml exec web bundle exec rails console

# Run migrations
docker compose -f docker-compose.oci-local.yml exec web bundle exec rake db:migrate

# Restart services
docker compose -f docker-compose.oci-local.yml restart

# Stop all services
docker compose -f docker-compose.oci-local.yml down

# Stop and remove volumes (DESTRUCTIVE)
docker compose -f docker-compose.oci-local.yml down -v
```

## Troubleshooting

### Invalid Authenticity Token

**Symptoms:** Login shows "Invalid Authenticity Token" error

**Solutions:**
1. Clear browser cookies for localhost
2. Use a private/incognito browser window
3. Verify domain configuration (see Domain Configuration section above)
4. Ensure `FORCE_SSL=false` is set in environment

### Database Connection Issues

**Symptoms:** Services fail to start or connect

**Solutions:**
1. Check all services are healthy: `docker compose -f docker-compose.oci-local.yml ps`
2. Wait 30-60 seconds after starting for health checks to pass
3. Check PostgreSQL logs: `docker compose -f docker-compose.oci-local.yml logs db`
4. Restart services: `docker compose -f docker-compose.oci-local.yml restart`

### File Upload Issues

**Symptoms:** Cannot upload files or files don't save

**Solutions:**
1. Verify MinIO is running: http://localhost:9001
2. Check bucket exists: Login to MinIO console, look for `canvas-files` bucket
3. Check MinIO logs: `docker compose -f docker-compose.oci-local.yml logs minio`
4. Recreate bucket:
   ```bash
   docker compose -f docker-compose.oci-local.yml exec minio-mc-init sh -c \
     'mc alias set local http://minio:9000 localaccess localsecret && mc mb -p local/canvas-files'
   ```

### Web Service Won't Start

**Symptoms:** Web container keeps restarting

**Solutions:**
1. Check logs: `docker compose -f docker-compose.oci-local.yml logs web`
2. Verify database is ready: `docker compose -f docker-compose.oci-local.yml exec db pg_isready`
3. Check Redis: `docker compose -f docker-compose.oci-local.yml exec redis redis-cli -a secret ping`
4. Rebuild image: `docker compose -f docker-compose.oci-local.yml build web`

## OCI Production Deployment

For production deployment to Oracle Cloud Infrastructure (OCI):

1. Copy the template: `cp .env.production.local.sample .env.production.local`

2. Configure required variables:
   - `CANVAS_DOMAIN` - Your public domain (e.g., canvas.example.com)
   - `PGHOST`, `PGPASSWORD` - OCI managed PostgreSQL credentials
   - `REDIS_URL` - OCI Redis connection string
   - `S3_*` variables - OCI Object Storage S3 compatibility endpoint
   - `SMTP_*` variables - Email service credentials
   - `ENCRYPTION_KEY` - Generate new: `openssl rand -hex 64`
   - `CANVAS_LMS_ADMIN_PASSWORD` - Strong admin password

3. Set `FORCE_SSL=true` for production

4. Configure SSL/TLS certificates for your domain

5. Use a proper secrets management solution (OCI Vault) for sensitive values

## Development Notes

- The local setup is designed for development and testing of production configurations
- Database and file storage persist across restarts via Docker volumes
- To start fresh, remove volumes: `docker compose -f docker-compose.oci-local.yml down -v`
- Production images are built without asset compilation in development mode
- Changes to config files may require container recreation: `docker compose -f docker-compose.oci-local.yml up -d --force-recreate`

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (http://localhost:3000)                │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Canvas Web (Nginx + Passenger)                 │
│  - Port 3000 → 80                               │
│  - FORCE_SSL=false for local HTTP              │
└─────┬──────────┬──────────┬─────────────────────┘
      │          │          │
      │          │          │
┌─────▼────┐ ┌───▼────┐ ┌──▼──────┐
│PostgreSQL│ │ Redis  │ │  MinIO  │
│  :5432   │ │ :6379  │ │ :9000   │
└──────────┘ └────────┘ └─────────┘

┌──────────────────────────────────────────┐
│  Canvas Jobs (Background Workers)        │
│  - Delayed jobs, async processing        │
└─────┬────────────────────────────────────┘
      │
┌─────▼────────────────┐
│  MailHog (SMTP Test) │
│  :8025 (Web)         │
│  :1025 (SMTP)        │
└──────────────────────┘
```

## Additional Resources

- Canvas LMS Documentation: https://canvas.instructure.com/doc/
- Docker Compose: https://docs.docker.com/compose/
- MinIO Documentation: https://min.io/docs/
- OCI Object Storage S3 Compatibility: https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm
