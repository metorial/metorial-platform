# Signal

Signal is a webhook delivery and event orchestration service that manages reliable event distribution to HTTP endpoints. It handles event routing, delivery retries, failure tracking, and provides detailed delivery analytics.

## Features

- **Event Management**: Create, track, and manage events with custom types, topics, and payloads
- **Webhook Destinations**: Configure HTTP endpoints to receive events with flexible filtering
- **Delivery Orchestration**: Automated delivery with configurable retry strategies (linear/exponential)
- **Delivery Tracking**: Monitor delivery attempts, response data, and failure reasons
- **Topic-Based Routing**: Route events to destinations based on event types and topics
- **Multi-Tenant Support**: Isolated event streams per tenant with sender identification
- **Webhook Signing**: Cryptographic signing of webhook payloads for security verification
- **Delivery Analytics**: Track success rates, attempt counts, and delivery metrics

## Quick Start

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: signal
      POSTGRES_PASSWORD: signal
      POSTGRES_DB: signal
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - signal-network

  redis:
    image: redis:7-alpine
    networks:
      - signal-network

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
      - signal-network

  signal:
    image: ghcr.io/metorial/signal:latest
    ports:
      - "25050:52050"
    environment:
      DATABASE_URL: postgresql://signal:signal@postgres:5432/signal
      REDIS_URL: redis://redis:6379/0
      OBJECT_STORAGE_URL: http://object-storage:52010
      LOGS_BUCKET_NAME: logs
    depends_on:
      - postgres
      - redis
      - object-storage
    networks:
      - signal-network

volumes:
  postgres_data:
  object-store-data:

networks:
  signal-network:
    driver: bridge
```

Start the services:

```bash
docker-compose up -d
```

The Signal service will be available at `http://localhost:25050`

## TypeScript Client

### Installation

```bash
npm install @metorial-services/signal-client
yarn add @metorial-services/signal-client
bun add @metorial-services/signal-client
```

### Basic Usage

```typescript
import { createSignalClient } from '@metorial-services/signal-client';

let client = createSignalClient({
  endpoint: 'http://localhost:25050',
});
```

### Core API Examples

#### 1. Tenant Management

Tenants represent isolated workspaces for event management:

```typescript
// Create/update a tenant
let tenant = await client.tenant.upsert({
  name: 'My Application',
  identifier: 'my-app',
});

// Get a tenant
let retrievedTenant = await client.tenant.get({
  tenantId: tenant.id,
});
```

#### 2. Sender Management

Senders identify the source of events within a tenant:

```typescript
// Create/update a sender
let sender = await client.sender.upsert({
  name: 'Payment Service',
  identifier: 'payment-service',
});

// Get a sender
let retrievedSender = await client.sender.get({
  senderId: sender.id,
});
```

#### 3. Event Destination Management

Destinations define HTTP endpoints that receive events:

```typescript
// Create a webhook destination
let destination = await client.eventDestination.create({
  tenantId: tenant.id,
  senderId: sender.id,
  name: 'Production Webhook',
  description: 'Main production event receiver',
  eventTypes: ['payment.created', 'payment.failed'],
  retry: {
    type: 'exponential',
    delaySeconds: 60,
    maxAttempts: 5,
  },
  variant: {
    type: 'http_endpoint',
    url: 'https://api.example.com/webhooks',
    method: 'POST',
  },
});

console.log('Destination ID:', destination.id);
console.log('Signing Secret:', destination.webhook?.signingSecret);

// List destinations
let destinations = await client.eventDestination.list({
  tenantId: tenant.id,
  limit: 20,
  order: 'desc',
});

// Get destination details
let destinationDetails = await client.eventDestination.get({
  tenantId: tenant.id,
  eventDestinationId: destination.id,
});

// Update a destination
let updated = await client.eventDestination.update({
  tenantId: tenant.id,
  eventDestinationId: destination.id,
  name: 'Updated Webhook',
  eventTypes: null, // Receive all event types
});

// Delete a destination
await client.eventDestination.delete({
  tenantId: tenant.id,
  eventDestinationId: destination.id,
});
```

#### 4. Creating Events

Publish events that will be delivered to matching destinations:

```typescript
// Create an event
let event = await client.event.create({
  tenantId: tenant.id,
  senderId: sender.id,
  eventType: 'payment.created',
  topics: ['payments', 'transactions'],
  payloadJson: JSON.stringify({
    paymentId: 'pay_123',
    amount: 1000,
    currency: 'USD',
    customer: {
      id: 'cust_456',
      email: 'customer@example.com',
    },
  }),
  headers: {
    'X-Custom-Header': 'custom-value',
  },
  onlyForDestinations: undefined, // Send to all matching destinations
});

console.log('Event ID:', event.id);
console.log('Status:', event.status);
console.log('Destination Count:', event.destinationCount);

// Get event details
let eventDetails = await client.event.get({
  tenantId: tenant.id,
  eventId: event.id,
});

console.log('Success Count:', eventDetails.successCount);
console.log('Failure Count:', eventDetails.failureCount);

// List events with filters
let events = await client.event.list({
  tenantId: tenant.id,
  eventTypes: ['payment.created', 'payment.failed'],
  topics: ['payments'],
  senderIds: [sender.id],
  limit: 50,
  order: 'desc',
});

for (let evt of events.items) {
  console.log(`Event ${evt.id}: ${evt.type} - ${evt.status}`);
}
```

#### 5. Delivery Intent Tracking

Monitor delivery intents for each destination:

```typescript
// List delivery intents
let intents = await client.eventDeliveryIntent.list({
  tenantId: tenant.id,
  eventIds: [event.id],
  status: ['pending', 'retrying', 'failed'],
  limit: 20,
  order: 'desc',
});

for (let intent of intents.items) {
  console.log('Intent ID:', intent.id);
  console.log('Status:', intent.status);
  console.log('Attempt Count:', intent.attemptCount);
  console.log('Destination:', intent.destination.name);
  console.log('Next Attempt At:', intent.nextAttemptAt);

  if (intent.error) {
    console.log('Error Code:', intent.error.code);
    console.log('Error Message:', intent.error.message);
  }
}

// Get specific intent details
let intent = await client.eventDeliveryIntent.get({
  tenantId: tenant.id,
  eventDeliveryIntentId: intents.items[0].id,
});

console.log('Event:', intent.event.type);
console.log('Destination URL:', intent.destination.webhook?.url);
```

#### 6. Delivery Attempt Analysis

View individual delivery attempts with response data:

```typescript
// List delivery attempts
let attempts = await client.eventDeliveryAttempt.list({
  tenantId: tenant.id,
  eventIds: [event.id],
  status: ['succeeded', 'failed'],
  limit: 50,
  order: 'desc',
});

for (let attempt of attempts.items) {
  console.log('Attempt ID:', attempt.id);
  console.log('Status:', attempt.status);
  console.log('Attempt Number:', attempt.attemptNumber);
  console.log('Duration:', attempt.durationMs, 'ms');

  if (attempt.response) {
    console.log('Response Status:', attempt.response.statusCode);
    console.log('Response Body:', attempt.response.body);
    console.log('Response Headers:', attempt.response.headers);
  }

  if (attempt.error) {
    console.log('Error Code:', attempt.error.code);
    console.log('Error Message:', attempt.error.message);
  }
}

// Get detailed attempt information
let attempt = await client.eventDeliveryAttempt.get({
  tenantId: tenant.id,
  eventDeliveryAttemptId: attempts.items[0].id,
});

console.log('Full attempt details:', attempt);
console.log('Started At:', attempt.startedAt);
console.log('Completed At:', attempt.completedAt);
console.log('Intent:', attempt.intent);
```

#### 7. Webhook Verification

Verify webhook signatures on the receiving end:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return signature === expectedSignature;
}

// In your webhook handler
app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-signal-signature'] as string;
  const payload = JSON.stringify(req.body);

  if (!verifyWebhookSignature(payload, signature, destination.webhook.signingSecret)) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  const event = req.body;
  console.log('Received event:', event.type);
  console.log('Payload:', event.payload);

  res.status(200).send('OK');
});
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built by <a href="https://metorial.com">Metorial</a></sub>
</div>
