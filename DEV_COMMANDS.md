# Dev Environment & Testing Commands

## 1. Setup

```bash
# Install all dependencies
pnpm install

# Copy env file (edit as needed)
cp .env.example .env
```

## 2. Docker (PostgreSQL + Redis)

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes (wipes all data)
docker-compose down -v

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Restart a single service
docker-compose restart postgres
docker-compose restart redis
```

## 3. Build & Dev

```bash
# Run all dev servers (client :5173, server :3001)
pnpm dev

# Build all packages
pnpm build

# Build individual packages
pnpm --filter server build
pnpm --filter client build
pnpm --filter common build
```

## 4. Testing

```bash
# Run all tests
pnpm test

# Run tests per package
pnpm --filter server test
pnpm --filter client test
pnpm --filter common test

# Run tests in watch mode
pnpm --filter server exec vitest
pnpm --filter client exec vitest
pnpm --filter common exec vitest

# Run a specific test file
pnpm --filter server exec vitest run src/__tests__/auth.test.ts
```

## 5. Inspect PostgreSQL

```bash
# Open psql shell
docker-compose exec postgres psql -U mahjong -d mahjong

# One-liner queries (no need to enter psql shell)
docker-compose exec postgres psql -U mahjong -d mahjong -c '\dt'              # list tables
docker-compose exec postgres psql -U mahjong -d mahjong -c 'SELECT * FROM users;'
docker-compose exec postgres psql -U mahjong -d mahjong -c 'SELECT * FROM user_stats;'
docker-compose exec postgres psql -U mahjong -d mahjong -c '\d users'         # describe table
docker-compose exec postgres psql -U mahjong -d mahjong -c '\d user_stats'

# Count rows
docker-compose exec postgres psql -U mahjong -d mahjong -c 'SELECT count(*) FROM users;'

# Check connection info
docker-compose exec postgres psql -U mahjong -d mahjong -c '\conninfo'
```

## 6. Inspect Redis

```bash
# Open redis-cli shell
docker-compose exec redis redis-cli

# One-liner commands
docker-compose exec redis redis-cli KEYS '*'                  # list all keys
docker-compose exec redis redis-cli KEYS 'room:*'             # list room keys
docker-compose exec redis redis-cli TYPE room:ABCD             # check key type
docker-compose exec redis redis-cli HGETALL room:ABCD          # get room hash
docker-compose exec redis redis-cli GET room:ABCD:game         # get game state JSON
docker-compose exec redis redis-cli LRANGE room:ABCD:chat 0 -1 # get chat messages
docker-compose exec redis redis-cli TTL room:ABCD              # check TTL (seconds)
docker-compose exec redis redis-cli DBSIZE                     # total key count
docker-compose exec redis redis-cli FLUSHDB                    # wipe all keys (careful!)
docker-compose exec redis redis-cli INFO memory                # memory usage
```

## 7. Quick Reference

| What              | URL / Port                                      |
|-------------------|--------------------------------------------------|
| Client (dev)      | http://localhost:5173                             |
| Server (API)      | http://localhost:3001                             |
| PostgreSQL        | `postgresql://mahjong:mahjong@localhost:5432/mahjong` |
| Redis             | `redis://localhost:6379`                         |
