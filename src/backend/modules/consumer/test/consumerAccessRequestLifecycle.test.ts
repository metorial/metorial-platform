import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    consumerAccessRequest: {
      findUnique: vi.fn()
    },
    consumerGroup: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('../src/services/consumerAccess', () => ({
  consumerAccessService: {
    createConsumerAccess: vi.fn()
  }
}));

vi.mock('../src/queues/search/consumerAccessRequest', () => ({
  indexConsumerAccessRequestSearchQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/accessRequest/sendApprovedConsumerAccessRequestEmail', () => ({
  sendApprovedConsumerAccessRequestEmailQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/accessRequest/sendRejectedConsumerAccessRequestEmail', () => ({
  sendRejectedConsumerAccessRequestEmailQueue: {
    add: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn(handler => handler)
  }))
}));

describe('consumerAccessRequestUpdatedQueueProcessor', () => {
  let db: any;
  let consumerAccessService: any;
  let indexConsumerAccessRequestSearchQueue: any;
  let sendApprovedConsumerAccessRequestEmailQueue: any;
  let sendRejectedConsumerAccessRequestEmailQueue: any;
  let consumerAccessRequestUpdatedQueueProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    db = (await import('@metorial/db')).db;
    consumerAccessService = (await import('../src/services/consumerAccess/consumerAccess'))
      .consumerAccessService;
    indexConsumerAccessRequestSearchQueue = (
      await import('../src/queues/search/consumerAccessRequest')
    ).indexConsumerAccessRequestSearchQueue;
    sendApprovedConsumerAccessRequestEmailQueue = (
      await import('../src/queues/accessRequest/sendApprovedConsumerAccessRequestEmail')
    ).sendApprovedConsumerAccessRequestEmailQueue;
    sendRejectedConsumerAccessRequestEmailQueue = (
      await import('../src/queues/accessRequest/sendRejectedConsumerAccessRequestEmail')
    ).sendRejectedConsumerAccessRequestEmailQueue;
    consumerAccessRequestUpdatedQueueProcessor = (
      await import('../src/queues/lifecycle/consumerAccessRequest')
    ).consumerAccessRequestUpdatedQueueProcessor;
  });

  it('creates approved access and enqueues the approval email', async () => {
    let organization = { id: 'org_1', oid: 2n };
    let surface = { oid: 1n, organization };
    let personalConsumerGroup = { id: 'group_1', oid: 3n, status: 'active' };
    let providerTemplate = { id: 'pt_1', status: 'active' };

    db.consumerAccessRequest.findUnique.mockResolvedValue({
      id: 'req_1',
      status: 'approved',
      type: 'provider_template',
      surface,
      consumerProfile: {
        personalConsumerGroup
      },
      providerTemplate,
      magicMcpServer: null
    });

    await consumerAccessRequestUpdatedQueueProcessor({
      consumerAccessRequestId: 'req_1'
    });

    expect(indexConsumerAccessRequestSearchQueue.add).toHaveBeenCalledWith({
      consumerAccessRequestId: 'req_1'
    });
    expect(consumerAccessService.createConsumerAccess).toHaveBeenCalledWith({
      organization,
      consumerSurface: surface,
      consumerGroup: personalConsumerGroup,
      access: {
        type: 'provider_template',
        providerTemplate
      }
    });
    expect(sendApprovedConsumerAccessRequestEmailQueue.add).toHaveBeenCalledWith({
      consumerAccessRequestId: 'req_1'
    });
    expect(sendRejectedConsumerAccessRequestEmailQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues the rejection email without creating access', async () => {
    db.consumerAccessRequest.findUnique.mockResolvedValue({
      id: 'req_2',
      status: 'rejected'
    });

    await consumerAccessRequestUpdatedQueueProcessor({
      consumerAccessRequestId: 'req_2'
    });

    expect(indexConsumerAccessRequestSearchQueue.add).toHaveBeenCalledWith({
      consumerAccessRequestId: 'req_2'
    });
    expect(sendRejectedConsumerAccessRequestEmailQueue.add).toHaveBeenCalledWith({
      consumerAccessRequestId: 'req_2'
    });
    expect(sendApprovedConsumerAccessRequestEmailQueue.add).not.toHaveBeenCalled();
    expect(consumerAccessService.createConsumerAccess).not.toHaveBeenCalled();
  });
});
