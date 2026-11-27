import {
  type BootstrappedOrganization,
  createRemoteProvider,
  eventually,
  expectOk,
  type McpTestServer,
  uniqueId,
  useFixture
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import type { IdentityActor } from '@metorial-subspace/db';
import { expect } from 'vitest';
import {
  type CreateIdentityActorParams,
  type CreateIdentityParams,
  identityActorService,
  identityService
} from '../src';

export let identityScope = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  return { instance: fixture.instance, auditScope: fixture.auditScope };
};

export let createActor = async (
  org: BootstrappedOrganization,
  input: Partial<CreateIdentityActorParams['input']> = {}
) =>
  identityActorService.createIdentityActor({
    ...(await identityScope(org)),
    input: { name: uniqueId('actor'), type: 'person', ...input }
  });

export let createIdentity = async (
  org: BootstrappedOrganization,
  input: Partial<CreateIdentityParams['input']> & { actor?: IdentityActor } = {}
) => {
  let { actor, ...rest } = input;

  return identityService.createIdentity({
    ...(await identityScope(org)),
    actor: actor ?? (await createActor(org)),
    input: { name: uniqueId('identity'), inputs: [], ...rest }
  });
};

export let waitForReconciliation = (identityId: string) =>
  eventually(async () => {
    let identity = await subspaceDb.identity.findUniqueOrThrow({ where: { id: identityId } });
    expect(identity.needsReconciliation).toBe(false);
    return identity;
  });

export let findDelegatedIdentity = (identity: { oid: bigint }, actor: { oid: bigint }) =>
  subspaceDb.delegatedIdentity.findUnique({
    where: { identityOid_actorOid: { identityOid: identity.oid, actorOid: actor.oid } },
    include: { credentials: true, delegatedIdentityUpdates: { orderBy: { oid: 'asc' } } }
  });

export let waitForDelegatedIdentity = (
  identity: { id: string; oid: bigint },
  actor: { oid: bigint },
  expected: Record<string, unknown>
) =>
  eventually(async () => {
    let delegated = await findDelegatedIdentity(identity, actor);
    expect(delegated).toMatchObject(expected);

    let reconciled = await subspaceDb.identity.findUniqueOrThrow({
      where: { id: identity.id }
    });
    expect(reconciled.needsReconciliation).toBe(false);

    return { delegated: delegated!, identity: reconciled };
  });

export let inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

export let createProviderDeployment = async (
  org: BootstrappedOrganization,
  providerId: string
) => {
  let deployment = expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('deployment')
    })
  );
  return deployment.id as string;
};

export let useRemoteProvider = (org: BootstrappedOrganization, server: McpTestServer) =>
  useFixture(async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    let deploymentId = await createProviderDeployment(org, providerId);

    return { providerId, deploymentId };
  });

export let pageAll = async <T extends { id: string }>(paginator: {
  run: (input: {
    limit: number;
    after?: string;
  }) => Promise<{ items: T[]; pagination: { hasNextPage: boolean } }>;
}) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page++) {
    let list = await paginator.run({ limit: 1, ...(after ? { after } : {}) });
    items.push(...list.items);

    if (!list.pagination.hasNextPage || !list.items.length) return items;
    after = list.items.at(-1)!.id;
  }

  throw new Error('Paginator still had more pages after 50 pages');
};
