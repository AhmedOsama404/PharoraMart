# Free & Unlimited Translation with LibreTranslate

This project uses **LibreTranslate** (self-hosted) for all translation needs — completely free, unlimited, and production-safe.

## Quick Start

```bash
# 1. Start LibreTranslate (from NovaBackend directory)
cd D:\NovaBackend
docker compose -f docker-compose.libretranslate.yml up -d

# 2. Verify it's running
curl http://localhost:5000/languages

# 3. Run storefront (will use http://localhost:5000 automatically)
cd D:\Default Project
npm start
```

## What You Get

| Feature | Details |
|---------|---------|
| **Cost** | $0 forever — runs on your hardware |
| **Limits** | None (your CPU/RAM only) |
| **Languages** | 100+ (configured: en, ar, de, fr, es, it, cs, pl, sk) |
| **API** | REST (`/translate`, `/languages`, `/detect`) |
| **Offline** | Works air-gapped after model download |
| **Privacy** | Zero data leaves your network |

## Architecture

```
┌─────────────────┐     HTTP      ┌──────────────────┐
│  Storefront     │ ────────────► │  LibreTranslate  │
│  (Angular)      │ ◄──────────── │  (Docker)        │
└─────────────────┘   JSON        └──────────────────┘
       ▲
       │ Angular service
       ▼
┌─────────────────┐
│ LibreTranslateService │
│  - translate()      │
│  - translateBatch() │
│  - getLanguages()   │
│  - detect()         │
└─────────────────┘
```

## Configuration

Environment variable (both `environment.ts` and `environment.development.ts`):

```typescript
libreTranslateUrl: 'http://localhost:5000'
```

For production behind a reverse proxy (nginx/Traefik):

```typescript
libreTranslateUrl: 'https://translate.yourdomain.com'
```

## API Usage

```typescript
// Single translation
this.translate.translate('Welcome', 'ar').subscribe(arabic => ...);

// Batch translation (efficient for UI batches)
this.translate.translateBatch(['Save', 'Cancel', 'Delete'], 'de').subscribe(german => ...);

// Language detection
this.translate.detect('مرحبا').subscribe(lang => console.log(lang)); // 'ar'

// Health check (for readiness probes)
this.translate.healthCheck().subscribe(healthy => ...);
```

## Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 2 GB | 4 GB |
| CPU | 2 cores | 4+ cores |
| Disk | 3 GB | 5 GB |
| Startup | 30–60 s | 15–30 s |

Models are downloaded on first run (~1 GB). Subsequent starts are fast.

## Scaling

- **Horizontal**: Run multiple containers behind a load balancer
- **Vertical**: Increase `LT_THREADS` and memory limit
- **GPU**: Add `--gpus all` to docker run for CUDA acceleration

## Monitoring

Health endpoint: `GET /languages` (returns 200 + language list)

```yaml
# Prometheus scrape config
- job_name: 'libretranslate'
  static_configs:
    - targets: ['localhost:5000']
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 503 on first request | Wait for model download (check `docker logs libretranslate`) |
| High memory | Reduce `LT_LOAD_ONLY` to only needed languages |
| Slow translation | Increase `LT_THREADS` or add GPU |
| CORS errors | Ensure storefront origin allowed (LibreTranslate allows all by default) |

## Updating Languages

Edit `LT_LOAD_ONLY` in `docker-compose.libretranslate.yml` and restart:

```bash
docker compose -f docker-compose.libretranslate.yml restart
```

Full language list: https://libretranslate.com/languages