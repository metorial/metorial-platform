import { beforeEach, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  accessInstance: vi.fn(),
  getConsumerProfile: vi.fn(),
  getConsumerAccessContext: vi.fn(),
  ensureConsumerProfileActor: vi.fn()
}));

vi.mock('@metorial/rest', () => ({
  Group: class Group {
    constructor(public _middleware: any[] = []) {}

    static create() {
      return new Group();
    }

    use(handler: any) {
      return new Group([...this._middleware, handler]);
    }
  },
  Path: (path: string, sdkPath: string) => ({ path, sdkPath })
}));
vi.mock('@metorial/module-access', () => ({
  accessService: {
    accessInstance: mocks.accessInstance
  }
}));
vi.mock('@metorial/consumer-auth', () => ({
  getConsumerAccessContextForConsumerProfile: mocks.getConsumerAccessContext
}));
vi.mock('@metorial/module-consumer-core', () => ({
  consumerProfileService: {
    getConsumerProfileByIdForInstance: mocks.getConsumerProfile
  }
}));
vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: {
    ensureConsumerProfileActor: mocks.ensureConsumerProfileActor
  }
}));

import { instanceGroup } from './instanceGroup';

let runGroup = async (group: any, input: any) => {
  let ctx = {
    query: {},
    body: undefined,
    apiVersion: 'test',
    url: 'https://api.metorial.com/test',
    headers: {},
    params: {},
    requestId: 'request_1',
    sharedMiddlewareMemo: new Map(),
    appendHeaders: vi.fn(),
    ...input
  };

  for (let middleware of group._middleware) {
    let result = await middleware(ctx);
    if (result) ctx = { ...ctx, ...result };
  }

  return ctx;
};

beforeEach(() => {
  vi.clearAllMocks();
});

it('builds an audit scope after resolving a user instance', async () => {
  let context = { ip: '127.0.0.1', ua: 'test-agent' };
  mocks.accessInstance.mockResolvedValue({
    type: 'user',
    instance: { id: 'ins_1', oid: 3n },
    organization: { id: 'org_1', oid: 1n },
    project: { id: 'prj_1', oid: 2n },
    actor: { id: 'act_1', oid: 4n },
    member: { id: 'mem_1' },
    resourceActor: { oid: 30n }
  });

  let result = await runGroup(instanceGroup, {
    auth: { type: 'user', user: { id: 'usr_1' }, orgScopes: [] },
    context,
    params: { instanceId: 'ins_1' }
  });

  expect(result.auditScope).toEqual({
    organizationOid: 1n,
    instanceOid: 3n,
    organizationActorOid: 4n,
    actor: {
      type: 'org_actor',
      id: 'act_1'
    },
    context
  });
});

it('overrides the audit actor when a consumer profile is selected', async () => {
  let context = { ip: '127.0.0.1', ua: 'test-agent' };
  let instance = { id: 'ins_1', oid: 3n };
  mocks.accessInstance.mockResolvedValue({
    type: 'user',
    instance,
    organization: { id: 'org_1', oid: 1n },
    project: { id: 'prj_1', oid: 2n },
    actor: { id: 'act_1', oid: 4n },
    member: { id: 'mem_1' },
    resourceActor: { oid: 30n }
  });
  mocks.getConsumerProfile.mockResolvedValue({
    id: 'cop_1',
    resourceActors: [{ oid: 40n, projectOid: 2n }],
    surface: {
      type: 'portal',
      portal: { id: 'por_1' }
    }
  });
  mocks.getConsumerAccessContext.mockResolvedValue({
    consumerGroups: [],
    accessTags: []
  });

  let result = await runGroup(instanceGroup, {
    auth: { type: 'user', user: { id: 'usr_1' }, orgScopes: [] },
    context,
    headers: { 'metorial-consumer-profile-id': 'cop_1' },
    params: { instanceId: 'ins_1' }
  });

  expect(result.auditScope).toEqual({
    organizationOid: 1n,
    instanceOid: 3n,
    organizationActorOid: undefined,
    actor: {
      type: 'consumer_profile',
      id: 'cop_1'
    },
    context
  });
});
