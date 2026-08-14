import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook()),
  organizationAdd: vi.fn(),
  projectAdd: vi.fn(),
  instanceAdd: vi.fn(),
  organizationActorAdd: vi.fn(),
  organizationMemberAdd: vi.fn(),
  consumerAdd: vi.fn(),
  consumerDeleteAdd: vi.fn(),
  consumerProfileAdd: vi.fn(),
  listen: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: mocks.addAfterTransactionHook
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: mocks.listen }
}));

vi.mock('../queues/metorialResource', () => ({
  syncMetorialOrganizationQueue: { add: mocks.organizationAdd },
  syncMetorialProjectQueue: { add: mocks.projectAdd },
  syncMetorialInstanceQueue: { add: mocks.instanceAdd },
  syncMetorialOrganizationActorQueue: { add: mocks.organizationActorAdd },
  syncMetorialOrganizationMemberQueue: { add: mocks.organizationMemberAdd },
  syncMetorialConsumerQueue: { add: mocks.consumerAdd },
  deleteMetorialConsumerQueue: { add: mocks.consumerDeleteAdd },
  syncMetorialConsumerProfileQueue: { add: mocks.consumerProfileAdd }
}));

import {
  deleteConsumerResource,
  syncConsumerProfileResource,
  syncConsumerResource,
  syncInstanceResource,
  syncOrganizationActorResource,
  syncOrganizationMemberResource,
  syncOrganizationResource,
  syncProjectResource
} from './metorialResource';

describe('Metorial resource Fabric listeners', () => {
  beforeEach(() => {
    mocks.addAfterTransactionHook.mockClear();
    mocks.organizationAdd.mockClear();
    mocks.projectAdd.mockClear();
    mocks.instanceAdd.mockClear();
    mocks.organizationActorAdd.mockClear();
    mocks.organizationMemberAdd.mockClear();
    mocks.consumerAdd.mockClear();
    mocks.consumerDeleteAdd.mockClear();
    mocks.consumerProfileAdd.mockClear();
  });

  it('registers creation and update listeners for every mirrored resource', () => {
    expect(mocks.listen.mock.calls.map(call => call[0])).toEqual([
      'organization.actor.created:after',
      'organization.actor.updated:after',
      'organization.member.created:after',
      'organization.member.updated:after',
      'organization.member.deleted:after',
      'consumer.created:after',
      'consumer.updated:after',
      'consumer.deleted:after',
      'consumer.profile.created:after',
      'consumer.profile.updated:after',
      'consumer.profile.deleted:after'
    ]);
  });

  it('enqueues synchronization through an after-transaction hook', async () => {
    await syncOrganizationResource({ organization: { id: 'org_1' } });
    await syncProjectResource({ project: { id: 'prj_1' } });
    await syncInstanceResource({ instance: { id: 'ins_1' } });
    await syncOrganizationActorResource({ actor: { id: 'oac_1' } });
    await syncOrganizationMemberResource({ member: { id: 'mem_1' } });
    await syncConsumerResource({ consumer: { id: 'con_1' } });
    await deleteConsumerResource({ consumerId: 'con_deleted' });
    await syncConsumerProfileResource({ consumerProfile: { id: 'cpf_1' } });

    expect(mocks.addAfterTransactionHook).toHaveBeenCalledTimes(8);
    expect(mocks.organizationAdd).toHaveBeenCalledWith({ organizationId: 'org_1' });
    expect(mocks.projectAdd).toHaveBeenCalledWith({ projectId: 'prj_1' });
    expect(mocks.instanceAdd).toHaveBeenCalledWith({ instanceId: 'ins_1' });
    expect(mocks.organizationActorAdd).toHaveBeenCalledWith({
      organizationActorId: 'oac_1'
    });
    expect(mocks.organizationMemberAdd).toHaveBeenCalledWith({
      organizationMemberId: 'mem_1'
    });
    expect(mocks.consumerAdd).toHaveBeenCalledWith({ consumerId: 'con_1' });
    expect(mocks.consumerDeleteAdd).toHaveBeenCalledWith({
      consumerId: 'con_deleted'
    });
    expect(mocks.consumerProfileAdd).toHaveBeenCalledWith({
      consumerProfileId: 'cpf_1'
    });
  });
});
