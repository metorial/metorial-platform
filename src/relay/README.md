# Relay

Relay is an email delivery service that provides a centralized platform for managing and sending emails across multiple applications. It handles sender identification, email identity management, asynchronous email delivery, and provides detailed delivery tracking with automatic retry logic.

## Features

- **Sender Management**: Create and track multiple senders (applications/services) with unique identifiers
- **Email Identity Management**: Configure custom "from" addresses with display names per sender
- **Multi-Backend Support**: Seamlessly switch between AWS SES (production) and SMTP (development)
- **Asynchronous Delivery**: Two-tier queue system for efficient email processing
- **Delivery Tracking**: Monitor email status (pending, sent, retry, failed) per recipient
- **Smart Retry Logic**: Exponential backoff with configurable retry attempts
- **Rate Limiting**: Built-in protection against overwhelming email destinations
- **Environment Prefixes**: Automatic [STAGING] or [DEV] subject prefixes for non-production environments
- **Automatic Cleanup**: Daily cron job removes email records older than 30 days
- **Subject Markers**: Custom subject markers per email identity for filtering and organization

## Quick Start

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: relay
      POSTGRES_PASSWORD: relay
      POSTGRES_DB: relay
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - relay-network

  redis:
    image: redis:7-alpine
    networks:
      - relay-network

  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    volumes:
      - object-store-data:/app/data
    environment:
      RUST_LOG: info
      OBJECT_STORE__SERVER__HOST: 0.0.0.0
      OBJECT_STORE__SERVER__PORT: 52010
      OBJECT_STORE__BACKEND__TYPE: local
    networks:
      - relay-network

  relay:
    image: ghcr.io/metorial/relay:latest
    ports:
      - "25050:52050"
    environment:
      DATABASE_URL: postgresql://relay:relay@postgres:5432/relay
      REDIS_URL: redis://redis:6379/0
      OBJECT_STORAGE_URL: http://object-storage:52010
      LOGS_BUCKET_NAME: logs
      METORIAL_ENV: development
      # For SMTP (development)
      EMAIL_HOST: smtp.example.com
      EMAIL_PORT: 587
      EMAIL_SECURE: false
      EMAIL_USER: your-email@example.com
      EMAIL_PASSWORD: your-password
      # For AWS SES (production)
      # EMAIL_SES_ACCESS_KEY_ID: your-access-key
      # EMAIL_SES_SECRET_ACCESS_KEY: your-secret-key
      # EMAIL_SES_REGION: us-east-1
    depends_on:
      - postgres
      - redis
      - object-storage
    networks:
      - relay-network

volumes:
  postgres_data:
  object-store-data:

networks:
  relay-network:
    driver: bridge
```

Start the services:

```bash
docker-compose up -d
```

The Relay service will be available at `http://localhost:25050`

## TypeScript Client

### Installation

```bash
npm install @metorial-services/relay-client
yarn add @metorial-services/relay-client
bun add @metorial-services/relay-client
```

### Basic Usage

```typescript
import { createRelayClient } from '@metorial-services/relay-client';

let client = createRelayClient({
  endpoint: 'http://localhost:25050',
});
```

### Core API Examples

#### 1. Sender Management

Senders represent applications or services that send emails:

```typescript
// Create/update a sender
let sender = await client.sender.upsert({
  name: 'My Application',
  identifier: 'my-app',
});

console.log('Sender ID:', sender.id);
console.log('Identifier:', sender.identifier);

// Get a sender
let retrievedSender = await client.sender.get({
  senderId: sender.id,
});

console.log('Sender Name:', retrievedSender.name);
console.log('Created At:', retrievedSender.createdAt);
```

#### 2. Email Identity Management

Email identities define the "from" addresses for your emails:

```typescript
// Create/update an email identity
let identity = await client.emailIdentity.upsert({
  senderId: sender.id,
  name: 'Support Team',
  email: 'support@example.com',
});

console.log('Identity ID:', identity.id);
console.log('From Name:', identity.fromName);
console.log('From Email:', identity.fromEmail);
console.log('Slug:', identity.slug); // URL-friendly identifier

// Get an email identity
let retrievedIdentity = await client.emailIdentity.get({
  senderId: sender.id,
  emailIdentityId: identity.id,
});

console.log('Identity Type:', retrievedIdentity.type); // "email"
console.log('Created At:', retrievedIdentity.createdAt);
```

#### 3. Sending Emails

Send emails with the configured identity:

```typescript
// Send a simple email
let emailResult = await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['user@example.com'],
  subject: 'Welcome to Our Service',
  html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
  text: 'Welcome! Thank you for signing up.',
});

console.log('Email queued successfully');

// Send to multiple recipients
let bulkEmailResult = await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
  cc: ['manager@example.com'],
  bcc: ['archive@example.com'],
  subject: 'Monthly Newsletter',
  html: '<h1>Newsletter</h1><p>Here are this month\'s updates...</p>',
  text: 'Newsletter\n\nHere are this month\'s updates...',
  replyTo: 'noreply@example.com',
});

// Send with custom headers
let customEmailResult = await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['customer@example.com'],
  subject: 'Order Confirmation',
  html: '<h1>Order #12345</h1><p>Your order has been confirmed.</p>',
  text: 'Order #12345\n\nYour order has been confirmed.',
  headers: {
    'X-Order-ID': '12345',
    'X-Customer-ID': 'cust_456',
  },
});
```

### Environment-Specific Behavior

The Relay service automatically adjusts email subjects based on the environment:

```typescript
// In development (METORIAL_ENV=development)
await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['test@example.com'],
  subject: 'Test Email',
  html: '<p>Testing...</p>',
});
// Subject will be: "[DEV] Test Email"

// In staging (METORIAL_ENV=staging)
await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['test@example.com'],
  subject: 'Test Email',
  html: '<p>Testing...</p>',
});
// Subject will be: "[STAGING] Test Email"

// In production (METORIAL_ENV=production)
await client.email.send({
  senderId: sender.id,
  emailIdentityId: identity.id,
  to: ['customer@example.com'],
  subject: 'Welcome',
  html: '<p>Welcome!</p>',
});
// Subject will be: "Welcome" (no prefix)
```

### Advanced Usage

#### Custom Subject Markers

Email identities can have custom subject markers for filtering:

```typescript
// The subject marker is automatically added by the system
// If an identity has a subject marker, it's prepended to the subject
let identity = await client.emailIdentity.upsert({
  senderId: sender.id,
  name: 'Billing Team',
  email: 'billing@example.com',
  // Subject marker can be set via database or API if extended
});

// When sending emails, the subject marker (if set) will be included
// Example: "[BILLING] Your invoice is ready"
```

#### Handling Multiple Senders

Manage different senders for different parts of your application:

```typescript
// Marketing emails
let marketingSender = await client.sender.upsert({
  name: 'Marketing Team',
  identifier: 'marketing',
});

let marketingIdentity = await client.emailIdentity.upsert({
  senderId: marketingSender.id,
  name: 'Marketing',
  email: 'marketing@example.com',
});

// Transactional emails
let transactionalSender = await client.sender.upsert({
  name: 'Transaction Service',
  identifier: 'transactions',
});

let transactionalIdentity = await client.emailIdentity.upsert({
  senderId: transactionalSender.id,
  name: 'Transactions',
  email: 'noreply@example.com',
});

// Send from different identities
await client.email.send({
  senderId: marketingSender.id,
  emailIdentityId: marketingIdentity.id,
  to: ['customer@example.com'],
  subject: 'Special Offer',
  html: '<p>Check out our special offer!</p>',
});

await client.email.send({
  senderId: transactionalSender.id,
  emailIdentityId: transactionalIdentity.id,
  to: ['customer@example.com'],
  subject: 'Payment Receipt',
  html: '<p>Your payment has been processed.</p>',
});
```

## Configuration

### Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (message queue)
REDIS_URL=redis://host:port/0

# Object Storage
OBJECT_STORAGE_URL=http://localhost:25010
LOGS_BUCKET_NAME=relay-logs

# Environment
METORIAL_ENV=production  # or staging, development
```

#### Email Backend Options

Choose one of the following email backends:

**Option 1: AWS SES (recommended for production)**

```bash
EMAIL_SES_ACCESS_KEY_ID=your-access-key
EMAIL_SES_SECRET_ACCESS_KEY=your-secret-key
EMAIL_SES_REGION=us-east-1
```

**Option 2: SMTP (development/testing)**

```bash
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-password
```

#### Optional Variables

```bash
# Database (alternative to DATABASE_URL)
DATABASE_USERNAME=relay
DATABASE_PASSWORD=relay
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=relay

# Redis (alternative to REDIS_URL)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_AUTH_TOKEN=your-token
REDIS_TLS=false

# Object Storage Backend
OBJECT_STORAGE_BACKEND_TYPE=local  # or aws
OBJECT_STORAGE_BACKEND_ROOT_PATH=/app/data  # for local backend
OBJECT_STORAGE_AWS_REGION=us-east-1
OBJECT_STORAGE_AWS_S3_BUCKET=relay-bucket
OBJECT_STORAGE_AWS_ACCESS_KEY_ID=your-key
OBJECT_STORAGE_AWS_SECRET_ACCESS_KEY=your-secret

# Shadow database for migrations
SHADOW_DATABASE_URL=postgresql://user:password@host:port/shadow_db
```

## Architecture

### Service Flow

```
Client Request
    ↓
RPC Endpoint (/metorial-relay)
    ↓
API Controllers
    ├── sender.upsert/get
    ├── emailIdentity.upsert/get
    └── email.send
    ↓
Email Service (Business Logic)
    ↓
Database (PostgreSQL)
    ├── Store email record
    └── Store destinations
    ↓
Queue System (Redis + BullMQ)
    ├── sendEmailQueue (fetch destinations)
    └── sendEmailSingleQueue (send to recipient)
    ↓
Email Transport
    ├── AWS SES (production)
    └── SMTP (development)
    ↓
Delivery Tracking
    └── Update status in database
```

### Key Components

- **RPC Layer**: Handles HTTP requests and routes to appropriate handlers
- **Email Service**: Core business logic for email operations
- **Queue System**: Two-tier asynchronous processing
  - Level 1: Fetch all destinations for an email
  - Level 2: Send to individual recipients
- **Transport Layer**: Pluggable email backends (SES/SMTP)
- **Database**: Tracks senders, identities, emails, and delivery status
- **Object Storage**: Stores email logs and delivery data

### Delivery Guarantees

- **Retry Logic**: Up to 10 retry attempts with exponential backoff
- **Rate Limiting**: 50 emails/minute to prevent overwhelming destinations
- **Status Tracking**: Each recipient tracked individually (pending → sent/failed/retry)
- **Automatic Cleanup**: Emails older than 30 days automatically deleted
- **Content Optimization**: Email content deleted after processing to save storage

## Development

### Local Setup

1. Clone the repository:
```bash
git clone https://github.com/metorial/relay.git
cd relay
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start dependencies with Docker Compose:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

5. Run database migrations:
```bash
cd service
bun run prisma:push
```

6. Start the development server:
```bash
bun run dev
```

The service will be available at `http://localhost:52050`

### Testing

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built by <a href="https://metorial.com">Metorial</a></sub>
</div>
