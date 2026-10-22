import { createHmac } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ID, type EventDeliveryRetryStrategy, type SystemEventSource } from '@metorial/db';
import { eventually, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { afterAll, beforeAll, expect } from 'vitest';
import { eventDeliveryService } from '../src';

export let deliveryWait = { timeoutMs: 60_000, intervalMs: 500 };

export let blockedHostUrl = () => `http://localhost:9/${uniqueId('hook')}`;

export let createDestination = async (
  fixture: OrganizationFixture,
  input: {
    url?: string;
    status?: 'active' | 'archived';
    retry?: {
      strategy?: EventDeliveryRetryStrategy;
      maxAttempts?: number;
      baseDelaySeconds?: number;
      maxDelaySeconds?: number;
    };
  } = {}
) => {
  let webhookDestination = await db.webhookDestination.create({
    data: {
      id: await ID.generateId('webhookDestination'),
      url: input.url ?? blockedHostUrl(),
      method: 'POST',
      signingSecret: await ID.generateId('webhookSigningSecret'),
      organizationOid: fixture.organization.oid
    }
  });

  return db.eventDestination.create({
    data: {
      id: await ID.generateId('eventDestination'),
      name: uniqueId('destination'),
      status: input.status ?? 'active',
      archivedAt: input.status == 'archived' ? new Date() : null,
      type: 'webhook',
      retryStrategy: input.retry?.strategy ?? 'fixed',
      retryMaxAttempts: input.retry?.maxAttempts ?? 1,
      retryBaseDelaySeconds: input.retry?.baseDelaySeconds ?? 1,
      retryMaxDelaySeconds: input.retry?.maxDelaySeconds ?? 1,
      organizationOid: fixture.organization.oid,
      webhookDestinationOid: webhookDestination.oid
    },
    include: { webhookDestination: true }
  });
};

export let createListener = async (
  fixture: OrganizationFixture,
  destination: { oid: bigint },
  input: {
    type?: 'event' | 'callback' | 'chat';
    eventTypes?: string[];
    callbackId?: string;
    chatConnectionId?: string;
    providerId?: string;
    triggers?: string[];
  }
) =>
  db.eventDestinationListener.create({
    data: {
      id: await ID.generateId('eventDestinationListener'),
      type: input.type ?? 'event',
      eventTypes: input.eventTypes ?? [],
      callbackId: input.callbackId,
      chatConnectionId: input.chatConnectionId,
      providerId: input.providerId,
      triggers: input.triggers ?? [],
      instanceOid: fixture.instance.oid,
      eventDestinationOid: destination.oid
    }
  });

export let createSystemEvent = async (
  fixture: OrganizationFixture,
  input: {
    eventType: string;
    source?: SystemEventSource;
    organizationLevel?: boolean;
    payload?: Record<string, any>;
    callbackId?: string;
    callbackTriggerKey?: string;
    chatConnectionId?: string;
    providerId?: string;
  }
) =>
  db.systemEvent.create({
    data: {
      id: await ID.generateId('systemEvent'),
      source: input.source ?? 'resource',
      eventType: input.eventType,
      organizationOid: fixture.organization.oid,
      instanceOid: input.organizationLevel ? null : fixture.instance.oid,
      payloadJson: input.payload,
      callbackId: input.callbackId,
      callbackTriggerKey: input.callbackTriggerKey,
      chatConnectionId: input.chatConnectionId,
      providerId: input.providerId
    }
  });

export let intentsFor = (systemEvent: { oid: bigint }) =>
  db.eventDeliveryIntent.findMany({
    where: { systemEventOid: systemEvent.oid },
    include: {
      eventDestination: { include: { webhookDestination: true } },
      attempts: { orderBy: { attemptNumber: 'asc' } }
    },
    orderBy: { oid: 'asc' }
  });

export let waitForDestinations = (systemEvent: { oid: bigint }, destinationIds: string[]) =>
  eventually(async () => {
    let intents = await intentsFor(systemEvent);
    expect(intents.map(intent => intent.eventDestination.id).sort()).toEqual(
      [...destinationIds].sort()
    );
    return intents;
  }, deliveryWait);

export let waitForDelivery = (
  fixture: OrganizationFixture,
  eventDeliveryId: string,
  expected: { status: string; attemptCount?: number },
  options: { timeoutMs?: number } = {}
) =>
  eventually(
    async () => {
      let delivery = await eventDeliveryService.getEventDeliveryById({
        organization: fixture.organization,
        eventDeliveryId
      });
      expect(delivery).toMatchObject(expected);
      return delivery;
    },
    { ...deliveryWait, ...options }
  );

export let headerValue = (headers: { key: string; value: string }[], key: string) =>
  headers.find(header => header.key === key)?.value;

export let expectedSignature = (d: {
  body: string;
  timestamp: string;
  signingSecret: string;
}) =>
  `t=${d.timestamp},v1=${createHmac('sha256', d.signingSecret)
    .update(`${d.timestamp}.${d.body}`)
    .digest('hex')}`;

export interface ReceivedRequest {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

export let useRecordingReceiver = () => {
  let requests: ReceivedRequest[] = [];
  let server: Server | undefined;
  let port = 0;

  beforeAll(async () => {
    server = createServer((request, response) => {
      let chunks: Buffer[] = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', () => {
        requests.push({
          method: request.method ?? '',
          path: request.url ?? '',
          headers: request.headers,
          body: Buffer.concat(chunks).toString('utf-8')
        });
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('ok');
      });
    });

    await new Promise<void>(resolve => server!.listen(0, '0.0.0.0', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
  });

  return {
    requests,
    get port() {
      return port;
    },
    clear: () => {
      requests.length = 0;
    }
  };
};
