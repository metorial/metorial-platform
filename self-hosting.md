# Self-Hosting Metorial

This guide walks you through self-hosting Metorial on your own infrastructure using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- At least 8GB of RAM available
- Sufficient disk space for volumes (recommended: 20GB+)

## Architecture Overview

Metorial consists of three main application components and several supporting services:

### Application Components

**API Service** - The core backend service built with Bun/TypeScript that handles:
- REST API endpoints
- MCP protocol implementation
- OAuth provider integration
- Portal management
- Integration APIs

**Engine Service** - A Go-based gRPC service that:
- Manages MCP server instances
- Handles containerized tool execution
- Provides resource management

**Frontend** - React-based dashboard providing:
- Web interface for managing integrations
- MCP server explorer
- Monitoring and debugging tools

### Supporting Services

- **PostgreSQL** - Primary database for application data
- **MongoDB** - Stores usage data and logs
- **Redis** - Caching and real-time data processing
- **Meilisearch** - Search functionality
- **MinIO** - Object storage
- **OpenSearch** - Log aggregation and search
- **etcd** - Distributed configuration management

## Configuration

### Environment Variables

Create a `.env` file in the `deployment/compose/` directory with the following required variables:

```bash
# Required
SECRET=your-secret-key-min-32-chars
HOST=http://localhost

# Email (AWS SES)
EMAIL_SES_ACCESS_KEY_ID=your-access-key
EMAIL_SES_SECRET_ACCESS_KEY=your-secret-key
EMAIL_SES_REGION=us-east-1
EMAIL_FROM_NAME=Metorial

# Optional: GitHub SCM integration
SCM_GITHUB_CLIENT_ID=your-github-client-id
SCM_GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional: Deno Deploy
DENO_DEPLOY_TOKEN=your-deno-token
DENO_ORGANIZATION_ID=your-org-id
```

### Port Mappings

The following ports will be exposed on your host:

**Application Ports:**
- 4300 - Dashboard frontend
- 4310 - Core API
- 4311 - MCP API
- 4312 - Marketplace API
- 4313 - OAuth provider
- 4314 - Private API
- 4315 - Portals API
- 4316 - Integrations API
- 4321 - ID API
- 50050 - Engine gRPC

**Service Ports:**
- 35432 - PostgreSQL
- 36379 - Redis
- 32707 - MongoDB
- 37700 - Meilisearch
- 32379, 32380 - etcd
- 9000, 9001 - MinIO
- 9200, 9600 - OpenSearch
- 5601 - OpenSearch Dashboards

## Running Metorial

### Start All Services

From the repository root, run:

```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml up
```

Add `-d` to run in detached mode:

```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml up -d
```

### Initial Startup

On first run, the services will:
1. Download required Docker images
2. Create data volumes in `deployment/compose/_volumes/`
3. Build the API and Engine services
4. Run database migrations
5. Start all services

This process may take 5-10 minutes depending on your system.

### Verify Installation

Once all services are running, verify the installation:

1. Check service health:
```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml ps
```

2. Access the dashboard at `http://localhost:4300`
3. Check API health at `http://localhost:4310/health`

### Stop Services

```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml down
```

To remove volumes and reset data:

```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml down -v
```

## Data Persistence

Data is persisted in the `deployment/compose/_volumes/` directory:

- `postgres/` - Application database
- `mongodb/` - Usage logs and analytics
- `redis/` - Cache data
- `meilisearch/` - Search indices
- `minio/` - Object storage
- `opensearch/` - Log data

Back up this directory regularly to prevent data loss.

## Troubleshooting

### Services Won't Start

Check logs for specific services:
```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml logs api
docker compose -f ./deployment/compose/metorial.docker-compose.yml logs engine
```

### Database Connection Issues

Ensure PostgreSQL is fully initialized before the API starts. If needed, restart the API service:
```bash
docker compose -f ./deployment/compose/metorial.docker-compose.yml restart api
```

### Port Conflicts

If you have conflicts with the default ports, modify the port mappings in `metorial.docker-compose.yml`. Update the corresponding environment variables in the API service to match your changes.

### Resource Constraints

Increase Docker's memory allocation if services crash or perform poorly. The stack requires at least 8GB of RAM to run comfortably.

## Production Considerations

For production deployments:

1. Use strong, unique values for `SECRET`
2. Configure proper SSL/TLS termination with a reverse proxy
3. Set up regular database backups
4. Configure appropriate resource limits in the compose file
5. Enable authentication in OpenSearch and MongoDB
6. Use external managed services for databases when possible
7. Implement proper logging and monitoring
8. Regularly update Docker images for security patches

## Next Steps

After successful deployment:

1. Create an account through the dashboard
2. Configure your first MCP server integration
3. Review the [documentation](https://metorial.com/docs) for SDK usage
4. Set up monitoring for your integrations