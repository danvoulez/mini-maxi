# Docker Development Guide

This guide explains how to run the application using Docker for local development.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/danvoulez/mini-maxi.git
   cd mini-maxi
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Start all services**:
   ```bash
   docker-compose up
   ```

4. **Access the application**:
   - App: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## Services

### Main Application (app)
- **Port**: 3000
- **Container**: `minicontratos-app`
- **Hot reload**: Enabled via volume mounting
- **Logs**: `docker-compose logs -f app`

### PostgreSQL Database (postgres)
- **Port**: 5432
- **Container**: `minicontratos-postgres`
- **Image**: pgvector/pgvector:pg16 (includes vector extension)
- **Credentials**:
  - User: `postgres`
  - Password: `postgres`
  - Database: `minicontratos`
- **Data persistence**: `postgres-data` volume

### Redis Cache (redis)
- **Port**: 6379
- **Container**: `minicontratos-redis`
- **Data persistence**: `redis-data` volume
- **AOF**: Enabled for data durability

### pgAdmin (optional)
- **Port**: 5050
- **Container**: `minicontratos-pgadmin`
- **Credentials**:
  - Email: `admin@minicontratos.local`
  - Password: `admin`
- **To enable**: `docker-compose --profile tools up`

## Common Commands

### Start services
```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Start specific service
docker-compose up app

# Start with pgAdmin
docker-compose --profile tools up
```

### Stop services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Run commands in containers
```bash
# Shell in app container
docker-compose exec app sh

# Run migrations
docker-compose exec app pnpm db:migrate

# Run tests
docker-compose exec app pnpm test

# Run linter
docker-compose exec app pnpm lint
```

### Database operations
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d minicontratos

# Backup database
docker-compose exec postgres pg_dump -U postgres minicontratos > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres minicontratos < backup.sql

# Enable pgvector extension
docker-compose exec postgres psql -U postgres -d minicontratos -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Redis operations
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

## Development Workflow

### 1. Code changes
- Edit files in your local directory
- Changes are reflected immediately via volume mounting
- Next.js Turbo mode provides fast refresh

### 2. Database changes
```bash
# Generate migration
docker-compose exec app pnpm db:generate

# Run migrations
docker-compose exec app pnpm db:migrate

# Open Drizzle Studio
docker-compose exec app pnpm db:studio
```

### 3. Testing
```bash
# Run unit tests
docker-compose exec app pnpm test

# Run specific test file
docker-compose exec app pnpm test tests/lib/memory.test.ts

# Run E2E tests
docker-compose exec app pnpm test:e2e
```

### 4. Debugging
```bash
# View application logs
docker-compose logs -f app

# View all logs
docker-compose logs -f

# Check container status
docker-compose ps

# Inspect container
docker-compose exec app sh
```

## Troubleshooting

### Port already in use
```bash
# Check what's using the port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Change port in docker-compose.yml or stop conflicting service
```

### Database connection failed
```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Permission issues
```bash
# Fix ownership (Linux)
sudo chown -R $USER:$USER .

# Or run as root (not recommended)
docker-compose exec -u root app sh
```

### Clean start
```bash
# Stop all services and remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild and start
docker-compose up --build
```

### Node modules issues
```bash
# Rebuild node_modules
docker-compose exec app rm -rf node_modules
docker-compose exec app pnpm install

# Or rebuild container
docker-compose up --build app
```

## Environment Variables

Required environment variables (add to `.env.local`):

```bash
# Database (auto-configured in docker-compose)
POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/minicontratos

# Cache (auto-configured in docker-compose)
REDIS_URL=redis://redis:6379

# Auth (generate your own)
AUTH_SECRET=your-secret-here

# AI Services (add your keys)
OPENAI_API_KEY=sk-...
AI_GATEWAY_API_KEY=...

# Optional
CEREBRO_TOKEN_BUDGET_TOTAL=2000
RAG_PROVIDER=pgIlike
```

## Performance Tips

### 1. Use volumes for node_modules
Already configured in docker-compose.yml to avoid copying node_modules.

### 2. Enable BuildKit
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### 3. Limit logs
```bash
# docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. Resource limits
Add to docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

## Production Deployment

**Note**: This Docker setup is for **development only**.

For production:
- Use multi-stage Dockerfile
- Use production-grade PostgreSQL (managed service)
- Use production Redis (managed service)
- Enable SSL/TLS
- Set proper secrets
- Use reverse proxy (nginx/traefik)
- Configure monitoring and logging
- See DEPLOYMENT_GUIDE.md for Vercel deployment

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Main README.md](./README.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## Getting Help

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Search existing GitHub issues
3. Create a new issue with logs and environment details

---

Happy coding! 🚀
