# Deployment Document — Chinese Standard Mahjong Online

## 1. Environments

| Environment | Purpose | URL Pattern |
|------------|---------|-------------|
| Local | Development | `http://localhost:3000` (client), `:4000` (server) |
| Staging | Pre-production testing | `https://staging.mahjong.example.com` |
| Production | Live users | `https://mahjong.example.com` |

---

## 2. Local Development Setup

### Prerequisites
- Node.js ≥ 20 LTS
- pnpm (workspace manager)
- Docker & docker-compose (for PostgreSQL + Redis)
- Git

### Quick Start

```bash
# Clone and install
git clone <repo-url> && cd mahjong
pnpm install

# Start infrastructure
docker-compose up -d postgres redis

# Run database migrations
pnpm --filter server db:migrate

# Start development servers (hot reload)
pnpm dev
```

### docker-compose.yml (dev infrastructure)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mahjong
      POSTGRES_USER: mahjong
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 3. Containerized Build

### Dockerfile (multi-stage)

```dockerfile
# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
RUN corepack enable pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter common build
RUN pnpm --filter client build
RUN pnpm --filter server build

# --- Production stage ---
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./server/
COPY --from=builder /app/packages/client/dist ./client/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/packages/server/node_modules ./server/node_modules/

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server/index.js"]
```

The server serves the client's static build at `/` and handles WebSocket connections.

---

## 4. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: mahjong_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:coverage
        # Upload coverage to tracking service if desired

  e2e:
    runs-on: ubuntu-latest
    needs: lint-and-test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: npx playwright install --with-deps
      - run: pnpm test:e2e

  deploy:
    runs-on: ubuntu-latest
    needs: [lint-and-test, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        run: |
          docker build -t mahjong:${{ github.sha }} .
          # Push to container registry (ECR, GCR, GHCR, etc.)
      - name: Deploy to staging
        run: |
          # Deploy to staging environment
          # Run smoke tests
      - name: Deploy to production (manual approval)
        environment: production
        run: |
          # Deploy to production
```

---

## 5. Deployment Options (by phase)

### Phase 1–3: Single Server (Simple & Cheap)

**Recommended**: One VPS or cloud VM.

```
┌─────────────────────────────────────────┐
│  VPS (e.g., 2 vCPU, 4 GB RAM)          │
│                                         │
│  ┌──────────┐  ┌───────┐  ┌──────────┐ │
│  │ Node.js  │  │ Redis │  │PostgreSQL│ │
│  │ (app)    │  │       │  │          │ │
│  └──────────┘  └───────┘  └──────────┘ │
│                                         │
│  nginx (reverse proxy + TLS)            │
└─────────────────────────────────────────┘
```

- **Hosting options**: DigitalOcean Droplet, Hetzner, AWS Lightsail, Linode.
- **Cost**: ~$10–20/month.
- **TLS**: Let's Encrypt via certbot or nginx plugin.
- **Process manager**: PM2 or systemd.
- **WebSocket**: nginx configured with `proxy_pass` and `Upgrade` headers.

nginx config snippet:
```nginx
server {
    listen 443 ssl http2;
    server_name mahjong.example.com;

    ssl_certificate /etc/letsencrypt/live/mahjong.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mahjong.example.com/privkey.pem;

    # Static client files
    location / {
        root /app/client;
        try_files $uri $uri/ /index.html;
    }

    # API and WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Phase 4–5: Managed Services

Move database and cache to managed services for reliability.

```
┌────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Client    │────►│  VPS / Container │────►│ Managed PG   │
│ (Browser)  │     │  (Node.js app)   │     │ (RDS/Supabase│
└────────────┘     └────────┬─────────┘     └──────────────┘
                            │
                   ┌────────▼─────────┐
                   │  Managed Redis   │
                   │ (ElastiCache/    │
                   │  Upstash)        │
                   └──────────────────┘
```

### Phase 6–7: Horizontal Scaling

```
                   ┌──────────┐
                   │   Load   │
                   │ Balancer │
                   └────┬─────┘
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │Node #1 │ │Node #2 │ │Node #3 │
         └───┬────┘ └───┬────┘ └───┬────┘
             │          │          │
         ┌───▼──────────▼──────────▼───┐
         │     Redis (pub/sub +        │
         │     Socket.IO adapter)      │
         └─────────────────────────────┘
```

- Socket.IO Redis adapter for cross-instance event broadcast.
- Sticky sessions (IP hash or cookie-based) to keep WebSocket connections stable.
- Auto-scaling group based on CPU/connection count.

---

## 6. Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server listen port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/mahjong` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `JWT_SECRET` | Secret for signing JWTs | (random 64-char string) |
| `JWT_EXPIRY` | Token expiration | `24h` |
| `CORS_ORIGIN` | Allowed origin for CORS | `https://mahjong.example.com` |
| `STUN_URL` | STUN server for WebRTC | `stun:stun.l.google.com:19302` |
| `TURN_URL` | TURN server (optional) | `turn:turn.example.com:3478` |
| `TURN_USERNAME` | TURN credentials | — |
| `TURN_PASSWORD` | TURN credentials | — |

---

## 7. Database Migrations

- Tool: **node-pg-migrate** or **Prisma Migrate**.
- Migrations stored in `packages/server/migrations/`.
- Run before deployment: `pnpm --filter server db:migrate`.
- Rollback: `pnpm --filter server db:migrate:down`.
- CI runs migrations against test database before tests.

---

## 8. Monitoring & Observability

| Layer | Tool | What to monitor |
|-------|------|----------------|
| Application | Structured logging (pino) | Errors, game events, auth failures |
| Metrics | Prometheus + Grafana (or cloud equivalent) | Active rooms, concurrent connections, WebSocket message rate, response times |
| Uptime | UptimeRobot / Healthchecks.io | HTTP health endpoint (`GET /health`) |
| Error tracking | Sentry | Unhandled exceptions, failed scoring computations |
| Database | pg_stat_statements | Slow queries, connection pool usage |

### Health Endpoint

```
GET /health → 200 { status: "ok", rooms: N, connections: N, db: "connected", redis: "connected" }
```

---

## 9. Backup & Recovery

| Data | Strategy | Frequency |
|------|----------|-----------|
| PostgreSQL | Automated backups (managed) or pg_dump | Daily + before migrations |
| Redis | RDB snapshots (if persistence needed) | Hourly |
| Application | Docker images tagged with git SHA | Every deploy |

Redis data is ephemeral (room state); loss means active games are interrupted but no permanent data is lost. PostgreSQL holds all durable data.

---

## 10. TURN Server Setup (for voice chat)

For users behind restrictive NATs/firewalls, a TURN server is needed.

```bash
# Install coturn
apt-get install coturn

# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
realm=mahjong.example.com
server-name=mahjong.example.com
lt-cred-mech
user=mahjong:secretpassword
cert=/etc/letsencrypt/live/mahjong.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/mahjong.example.com/privkey.pem
```

Alternatively, use a managed TURN service (Twilio, Xirsys) to avoid self-hosting.

---

## 11. Deployment Checklist

Before each production deployment:

- [ ] All tests pass (unit + integration + E2E)
- [ ] Database migrations tested on staging
- [ ] Environment variables set in production
- [ ] Docker image built and tagged with git SHA
- [ ] Staging deployment verified
- [ ] Health endpoint returns 200
- [ ] WebSocket connections establish successfully
- [ ] No console errors in browser
- [ ] Rollback plan documented (previous image tag noted)
