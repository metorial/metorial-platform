import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let queues = new Map<string, { add: ReturnType<typeof vi.fn> }>();
  return {
    processors,
    queues,
    db: {
      eventDeliveryIntent: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        updateMany: vi.fn()
      },
      eventDeliveryAttempt: {
        findUnique: vi.fn(),
        create: vi.fn()
      }
    },
    axiosPost: vi.fn(),
    putObject: vi.fn(),
    intentFailedAdd: vi.fn(),
    intentSucceededAdd: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class QueueRetryError extends Error {},
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(async () => ({})),
      process: vi.fn((handler: (data: any) => Promise<void>) => {
        mocks.processors.set(opts.name, handler);
        return { name: opts.name };
      })
    };
    mocks.queues.set(opts.name, queue);
    return queue;
  }
}));
vi.mock('axios', () => ({ default: { post: mocks.axiosPost } }));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://test' },
    storage: { LOGS_BUCKET_NAME: 'logs' }
  }
}));
vi.mock('../../id', () => ({
  getId: (type: string) => ({ oid: 100n, id: `${type}-generated` })
}));
vi.mock('../../lib/signature', () => ({ generateSignature: vi.fn(async () => 'signature') }));
vi.mock('../../lib/ssrf', () => ({ getAxiosSsrfFilter: vi.fn(() => ({})) }));
vi.mock('../../storage', () => ({ storage: { putObject: mocks.putObject } }));
vi.mock('./intent', () => ({
  intentFailedQueue: { add: mocks.intentFailedAdd },
  intentSucceededQueue: { add: mocks.intentSucceededAdd }
}));

import './delivery';

let getIntent = (attemptCount: number, retryMaxAttempts = 5) => ({
  oid: 1n,
  id: 'intent-1',
  status: 'pending',
  attemptCount,
  event: {
    id: 'event-1',
    payloadJson: '{}',
    headers: [],
    sender: { id: 'sender-1', name: 'Test sender' }
  },
  destination: {
    retryDelaySeconds: 10,
    retryMaxAttempts,
    retryType: 'linear',
    currentInstance: {
      oid: 3n,
      webhook: {
        id: 'webhook-1',
        url: 'https://example.test/callback',
        signingSecret: 'ordinary-secret'
      }
    }
  }
});

describe('Signal delivery attempt processor scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.eventDeliveryIntent.findFirst.mockResolvedValue(getIntent(0));
    mocks.db.eventDeliveryAttempt.findUnique.mockResolvedValue(null);
    mocks.db.eventDeliveryAttempt.create.mockResolvedValue({
      oid: 5n,
      id: 'attempt-1',
      attemptNumber: 1,
      status: 'failed',
      errorCode: 'http_error',
      errorMessage: 'Destination responded with HTTP status 500'
    });
    mocks.db.eventDeliveryIntent.updateMany.mockResolvedValue({ count: 1 });
    mocks.axiosPost.mockResolvedValue({ status: 500, data: 'failed', headers: {} });
    mocks.putObject.mockResolvedValue(undefined);
  });

  it('queues attempt two with a distinct delayed job ID and preserves HTTP status', async () => {
    await mocks.processors.get('sgnl/event/att')!({ intentId: 'intent-1' });

    expect(mocks.db.eventDeliveryAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'http_error',
        errorMessage: 'Destination responded with HTTP status 500',
        responseStatusCode: 500
      })
    });
    expect(mocks.db.eventDeliveryIntent.updateMany).toHaveBeenCalledWith({
      where: { id: 'intent-1', status: { notIn: ['delivered', 'failed'] } },
      data: {
        status: 'retrying',
        attemptCount: 1,
        nextAttemptAt: expect.any(Date)
      }
    });
    expect(mocks.queues.get('sgnl/event/att')!.add).toHaveBeenCalledWith(
      { intentId: 'intent-1' },
      { id: 'intent-1:attempt:2', delay: 10_000 }
    );
  });

  it('finalizes a non-2xx last attempt with the actual HTTP failure', async () => {
    mocks.db.eventDeliveryIntent.findFirst.mockResolvedValue(getIntent(4));
    mocks.axiosPost.mockResolvedValue({ status: 502, data: 'failed', headers: {} });
    mocks.db.eventDeliveryAttempt.create.mockResolvedValue({
      oid: 6n,
      id: 'attempt-5',
      attemptNumber: 5,
      status: 'failed',
      errorCode: 'http_error',
      errorMessage: 'Destination responded with HTTP status 502'
    });

    await mocks.processors.get('sgnl/event/att')!({ intentId: 'intent-1' });

    expect(mocks.intentFailedAdd).toHaveBeenCalledWith(
      {
        intentId: 'intent-1',
        errorCode: 'http_error',
        errorMessage: 'Destination responded with HTTP status 502'
      },
      { id: 'intent-1' }
    );
    expect(mocks.queues.get('sgnl/event/att')!.add).not.toHaveBeenCalled();
  });

  it('resumes a persisted attempt without repeating the outbound HTTP request', async () => {
    mocks.db.eventDeliveryAttempt.findUnique.mockResolvedValue({
      attemptNumber: 1,
      status: 'failed',
      errorCode: 'request_error',
      errorMessage: 'connection reset'
    });

    await mocks.processors.get('sgnl/event/att')!({ intentId: 'intent-1' });

    expect(mocks.axiosPost).not.toHaveBeenCalled();
    expect(mocks.queues.get('sgnl/event/att')!.add).toHaveBeenCalledWith(
      { intentId: 'intent-1' },
      { id: 'intent-1:attempt:2', delay: 10_000 }
    );
  });
});
