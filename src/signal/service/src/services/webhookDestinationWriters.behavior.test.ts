import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { idState, senderMock, txRef } = vi.hoisted(() => ({
  idState: { value: 100 },
  senderMock: vi.fn(),
  txRef: { current: null as unknown }
}));
vi.mock('../db', () => ({
  db: {
    $transaction: async (run: (tx: unknown) => unknown) => await run(txRef.current),
    webhookDestinationWebhook: {
      findFirst: async (args: unknown) =>
        await (txRef.current as any).webhookDestinationWebhook.findFirst(args)
    },
    webhookDestinationSigningSecret: {
      findMany: async ({ where }: { where: Row }) =>
        (txRef.current as any).__state.signingSecrets.filter(
          (row: Row) =>
            row.webhookDestinationWebhookOid === where.webhookDestinationWebhookOid &&
            row.tenantOid === where.tenantOid &&
            row.purpose === where.purpose
        )
    }
  }
}));
vi.mock('../env', () => ({
  env: {
    encryption: {
      ENCRYPTION_KEY: 'signal-writer-key',
      ENCRYPTION_ACTIVE_KEY_VERSION: 1,
      ENCRYPTION_ACTIVE_AAD_VERSION: 1,
      ENCRYPTION_SUPPORTED_AAD_VERSIONS: '1'
    }
  }
}));
vi.mock('../id', () => ({
  getId: (prefix: string) => {
    idState.value += 1;
    return { oid: BigInt(idState.value), id: `${prefix}-${idState.value}` };
  },
  snowflake: {
    nextId: () => {
      idState.value += 1;
      return BigInt(idState.value);
    }
  }
}));
vi.mock('./sender', () => ({
  senderService: { upsertSender: senderMock }
}));
vi.mock('../queues/send/callbackEventPayload', () => ({
  offloadCallbackEventPayloadQueue: { addMany: vi.fn() }
}));
vi.mock('../queues/send/init', () => ({ newEventQueue: { add: vi.fn() } }));
vi.mock('./event', () => ({ eventService: { createEvent: vi.fn() } }));

import { callbackService } from './callback';
import { eventDestinationService } from './eventDestination';
import { eventDestinationPresenter } from '../presenters/eventDestination';
import { webhookDestinationSigningSecretService } from './webhookDestinationSigningSecret';

type Row = Record<string, any>;
let makeTransaction = () => {
  let state = {
    webhooks: [] as Row[],
    signingSecrets: [] as Row[],
    receipts: [] as Row[],
    audits: [] as Row[],
    destinations: [] as Row[],
    instances: [] as Row[],
    callbacks: [] as Row[]
  };
  let tx: any = {
    __state: state,
    webhookDestinationWebhook: {
      create: async ({ data }: { data: Row }) => {
        let row = { createdAt: new Date(), ...data };
        state.webhooks.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: Row }) => {
        let row = state.webhooks.find(
          row =>
            (where.oid === undefined || row.oid === where.oid) &&
            (where.id === undefined || row.id === where.id) &&
            (where.tenantOid === undefined || row.tenantOid === where.tenantOid)
        );
        return row ? { ...row, tenant } : null;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        let row = state.webhooks.find(webhook => webhook.oid === where.oid)!;
        Object.assign(row, data);
        return row;
      }
    },
    webhookDestinationSigningSecret: {
      findFirst: async ({ where }: { where: Row }) =>
        state.signingSecrets
          .filter(
            row =>
              (where.oid === undefined || row.oid === where.oid) &&
              (where.id === undefined || row.id === where.id) &&
              (where.webhookDestinationWebhookOid === undefined ||
                row.webhookDestinationWebhookOid === where.webhookDestinationWebhookOid) &&
              (where.tenantOid === undefined || row.tenantOid === where.tenantOid) &&
              (where.purpose === undefined || row.purpose === where.purpose) &&
              (where.status === undefined || row.status === where.status)
          )
          .sort((a, b) => (b.secretVersion ?? 0) - (a.secretVersion ?? 0))[0] ?? null,
      findFirstOrThrow: async ({ where }: { where: Row }) => {
        let row = await tx.webhookDestinationSigningSecret.findFirst({ where });
        if (!row) throw new Error('missing signing secret');
        return row;
      },
      create: async ({ data }: { data: Row }) => {
        let row = { createdAt: new Date(), validUntil: null, ...data };
        state.signingSecrets.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let rows = state.signingSecrets.filter(
          row =>
            row.oid === where.oid &&
            (where.status === undefined || row.status === where.status)
        );
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        let row = state.signingSecrets.find(secret => secret.oid === where.oid)!;
        Object.assign(row, data);
        return row;
      }
    },
    webhookSecretAuditRecord: {
      create: async ({ data }: { data: Row }) => {
        state.audits.push(data);
        return data;
      }
    },
    webhookSecretIssuanceReceipt: {
      create: async ({ data }: { data: Row }) => {
        state.receipts.push(data);
        return data;
      }
    },
    eventDestination: {
      findFirst: async ({ where }: { where: Row }) => {
        let destination = state.destinations.find(
          row =>
            (where.externalId === undefined || row.externalId === where.externalId) &&
            (where.tenantOid === undefined || row.tenantOid === where.tenantOid) &&
            (where.senderOid === undefined || row.senderOid === where.senderOid) &&
            (where.isCallbackDestination === undefined ||
              row.isCallbackDestination === where.isCallbackDestination)
        );
        if (!destination) return null;
        let instance = state.instances.find(row => row.oid === destination.currentInstanceOid);
        let webhook = state.webhooks.find(row => row.oid === instance?.webhookOid);
        return { ...destination, currentInstance: instance ? { ...instance, webhook } : null };
      },
      create: async ({ data }: { data: Row }) => {
        state.destinations.push(data);
        return data;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        let destination = state.destinations.find(row => row.oid === where.oid)!;
        Object.assign(destination, data);
        let instance = state.instances.find(row => row.oid === destination.currentInstanceOid);
        let webhook = state.webhooks.find(row => row.oid === instance?.webhookOid);
        return { ...destination, currentInstance: instance ? { ...instance, webhook } : null };
      }
    },
    eventDestinationInstance: {
      create: async ({ data }: { data: Row }) => {
        let row = { createdAt: new Date(), ...data };
        state.instances.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: Row }) => {
        let row = [...state.instances]
          .reverse()
          .find(
            instance =>
              instance.destinationOid === where.destinationOid && instance.type === where.type
          );
        if (!row) return null;
        return {
          ...row,
          webhook: state.webhooks.find(webhook => webhook.oid === row.webhookOid)
        };
      }
    },
    tenant: { findUniqueOrThrow: async () => tenant },
    callback: {
      findUnique: async ({ where }: { where: Row }) =>
        state.callbacks.find(row => row.id === where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        state.callbacks.push(data);
        return data;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        let callback = state.callbacks.find(row => row.oid === where.oid)!;
        Object.assign(callback, data);
        return callback;
      },
      findFirstOrThrow: async ({ where }: { where: Row }) =>
        state.callbacks.find(row => row.oid === where.oid)!
    },
    callbackDestinationLink: {
      createMany: async () => ({ count: 1 }),
      updateMany: async () => ({ count: 1 })
    }
  };
  return { state, tx };
};

let tenant = { oid: 1n, id: 'tenant-1' };
let sender = { oid: 2n, id: 'sender-1' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2029-12-31T23:59:00.000Z'));
  idState.value = 100;
  senderMock.mockReset();
  senderMock.mockResolvedValue(sender);
});

afterEach(() => vi.useRealTimers());

let assertGeneratedDualWrite = (state: ReturnType<typeof makeTransaction>['state']) => {
  expect(state.webhooks).toHaveLength(1);
  expect(state.signingSecrets).toHaveLength(1);
  expect(state.receipts).toHaveLength(1);
  expect(state.webhooks[0]!.signingSecret).toMatch(/^metorial_whsec_/);
  expect(state.signingSecrets[0]).toMatchObject({
    status: 'active',
    secretVersion: 1,
    tenantOid: tenant.oid
  });
  expect(state.signingSecrets[0]!.encryptedValue).not.toBe(state.webhooks[0]!.signingSecret);
  expect(state.audits.map(row => row.action)).toEqual([
    'secret_created',
    'secret_issuance_receipt_issued'
  ]);
};

describe('Signal production destination writers', () => {
  it('eventDestination create dual-writes generated legacy/encrypted material and receipt provenance', async () => {
    let harness = makeTransaction();
    txRef.current = harness.tx;
    let result = await eventDestinationService.createEventDestination({
      tenant: tenant as never,
      sender: sender as never,
      input: {
        name: 'Events',
        variant: { type: 'http_endpoint', url: 'https://example.com/events', method: 'POST' }
      }
    });
    assertGeneratedDualWrite(harness.state);
    expect(result.secretIssuanceReceipt).toMatchObject({ id: harness.state.receipts[0]!.id });
  });

  it('callback upsert uses the fixed sender and the same generated dual-write boundary', async () => {
    let harness = makeTransaction();
    txRef.current = harness.tx;
    let result = await callbackService.upsertCallback({
      tenant: tenant as never,
      input: {
        callbackId: 'callback-1',
        name: 'Callbacks',
        destinations: [
          {
            externalId: 'callback-destination-1',
            name: 'Callback destination',
            variant: {
              type: 'http_endpoint',
              url: 'https://example.com/callback',
              method: 'POST'
            }
          }
        ]
      }
    });
    assertGeneratedDualWrite(harness.state);
    expect(senderMock).toHaveBeenCalledWith({
      input: { identifier: 'callbacks', name: 'Callbacks' }
    });
    expect(harness.state.destinations[0]).toMatchObject({
      externalId: 'callback-destination-1',
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      isCallbackDestination: true
    });
    expect(result.secretIssuanceReceipts).toHaveLength(1);
  });

  it('eventDestination replace reuses active material, then explicit rotation dual-writes a generated replacement', async () => {
    let harness = makeTransaction();
    txRef.current = harness.tx;
    let created = await eventDestinationService.createEventDestination({
      tenant: tenant as never,
      sender: sender as never,
      input: {
        name: 'Events',
        variant: { type: 'http_endpoint', url: 'https://example.com/v1', method: 'POST' }
      }
    });
    let originalLegacy = harness.state.webhooks[0]!.signingSecret;
    let replaced = await eventDestinationService.updateEventDestination({
      eventDestination: harness.state.destinations[0] as never,
      input: {
        variant: { type: 'http_endpoint', url: 'https://example.com/v2', method: 'POST' }
      }
    });
    expect(harness.state.webhooks).toHaveLength(2);
    expect(harness.state.webhooks[1]!.signingSecret).toBe(originalLegacy);
    expect(harness.state.signingSecrets).toHaveLength(2);
    expect(harness.state.receipts).toHaveLength(1);
    expect(harness.state.audits.at(-1)?.action).toBe('secret_imported');

    let rotated = await webhookDestinationSigningSecretService.rotate({
      tenant: tenant as never,
      webhookId: harness.state.webhooks[1]!.id,
      graceMs: 30_000,
      now: new Date('2030-01-01T00:00:00.000Z')
    });
    expect(rotated.receipt).toBeDefined();
    expect(harness.state.webhooks[1]!.signingSecret).toMatch(/^metorial_whsec_/);
    expect(harness.state.webhooks[1]!.signingSecret).not.toBe(originalLegacy);
    let replacementRows = harness.state.signingSecrets.filter(
      row => row.webhookDestinationWebhookOid === harness.state.webhooks[1]!.oid
    );
    expect(replacementRows.map(row => [row.secretVersion, row.status])).toEqual([
      [1, 'retiring'],
      [2, 'active']
    ]);
    expect(replacementRows[0]!.validUntil).toEqual(new Date('2030-01-01T00:00:30.000Z'));
    expect(harness.state.receipts).toHaveLength(2);

    let presented = eventDestinationPresenter(replaced as never);
    expect(JSON.stringify(presented)).not.toMatch(
      /metorial_whsec_|encryptedValue|signingSecret(?!Configured)/
    );
    expect(JSON.stringify(created.secretIssuanceReceipt)).not.toContain(originalLegacy);
  });

  it('callback upsert reuses the tenant-scoped destination and rejects cross-tenant IDs', async () => {
    let harness = makeTransaction();
    txRef.current = harness.tx;
    let input = {
      callbackId: 'callback-1',
      name: 'Callbacks',
      destinations: [
        {
          externalId: 'callback-destination-1',
          name: 'Callback destination',
          variant: {
            type: 'http_endpoint' as const,
            url: 'https://example.com/callback',
            method: 'POST' as const
          }
        }
      ]
    };
    let first = await callbackService.upsertCallback({ tenant: tenant as never, input });
    let second = await callbackService.upsertCallback({ tenant: tenant as never, input });
    expect(first.secretIssuanceReceipts).toHaveLength(1);
    expect(second.secretIssuanceReceipts).toHaveLength(0);
    expect(harness.state.destinations).toHaveLength(1);
    expect(harness.state.webhooks).toHaveLength(2);
    expect(harness.state.webhooks[1]!.signingSecret).toBe(
      harness.state.webhooks[0]!.signingSecret
    );

    await expect(
      callbackService.upsertCallback({
        tenant: { oid: 999n, id: 'tenant-other' } as never,
        input: { ...input, callbackId: 'callback-other' }
      })
    ).rejects.toThrow('ownership is invalid');
  });
});
