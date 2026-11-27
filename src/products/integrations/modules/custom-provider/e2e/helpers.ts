import { eventually, type McpTestServer, uniqueId } from '@metorial/e2e';
import { subspaceDb, type loadOrganizationFixture } from '@metorial/e2e/db';
import type { CustomProviderCommitType } from '@metorial-subspace/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { afterAll, beforeAll, expect } from 'vitest';
import { customProviderService } from '../src';

export type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;
export type RemoteProtocol = 'sse' | 'streamable_http' | 'stateless';

export let refusedUrl = 'http://127.0.0.1:1/mcp';

export let scopeOf = (fixture: Fixture) =>
  resolveMetorialFacing({ instance: fixture.instance });

export let createRemoteCustomProvider = (
  fixture: Fixture,
  input: { url: string; protocol?: RemoteProtocol; name?: string }
) =>
  customProviderService.createCustomProvider({
    instance: fixture.instance,
    organizationActor: fixture.actor,
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('remote-provider'),
      description: 'E2E remote provider',
      from: {
        type: 'remote',
        remoteUrl: input.url,
        protocol: input.protocol ?? 'streamable_http'
      }
    }
  });

export let waitForVersionDeployment = (customProviderId: string, versionIndex: number) =>
  eventually(
    async () => {
      let version = await subspaceDb.customProviderVersion.findFirstOrThrow({
        where: { versionIndex, customProvider: { id: customProviderId } },
        include: { deployment: true }
      });

      let settled =
        version.deployment.status === 'succeeded' ||
        (version.deployment.status === 'failed' && version.status === 'deployment_failed');
      if (!settled) {
        throw new Error(
          `Deployment of version ${versionIndex} of ${customProviderId} is ${version.deployment.status}`
        );
      }

      return version;
    },
    { timeoutMs: 90_000, intervalMs: 500 }
  );

export let expectVersionDeployed = async (customProviderId: string, versionIndex: number) => {
  let version = await waitForVersionDeployment(customProviderId, versionIndex);
  expect(version.deployment.status).toBe('succeeded');

  return version;
};

export let expectVersionFailed = async (customProviderId: string, versionIndex: number) => {
  let version = await waitForVersionDeployment(customProviderId, versionIndex);
  expect(version.deployment.status).toBe('failed');

  return version;
};

export let waitForCommit = (where: {
  id?: string;
  targetCustomProviderVersionOid?: bigint;
  type?: CustomProviderCommitType;
}) =>
  eventually(
    async () => {
      let commit = await subspaceDb.customProviderCommit.findFirstOrThrow({
        where,
        orderBy: { oid: 'desc' }
      });
      if (commit.status === 'pending') throw new Error(`Commit ${commit.id} is still pending`);

      return commit;
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

export let createDeployedCustomProvider = async (
  fixture: Fixture,
  input: { url: string; protocol?: RemoteProtocol; name?: string }
) => {
  let created = await createRemoteCustomProvider(fixture, input);

  let version = await expectVersionDeployed(created.id, 1);
  let commit = await waitForCommit({
    targetCustomProviderVersionOid: version.oid,
    type: 'create_version'
  });
  expect(commit.status).toBe('applied');

  let customProvider = await customProviderService.getCustomProviderById({
    instance: fixture.instance,
    customProviderId: created.id
  });

  return { customProvider, version, commit };
};

export let useFlakyServer = (upstream: McpTestServer) => {
  let server: ReturnType<typeof Bun.serve> | undefined;
  let view = { url: '', hits: 0, failing: true };

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      hostname: '0.0.0.0',
      fetch: async request => {
        view.hits++;
        if (view.failing) {
          return Response.json({ error: 'upstream unavailable' }, { status: 500 });
        }

        let hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        return fetch(upstream.url, {
          method: request.method,
          headers: request.headers,
          body: hasBody ? await request.arrayBuffer() : undefined
        });
      }
    });
    view.url = `http://127.0.0.1:${server.port}/mcp`;
  });

  afterAll(async () => {
    await server?.stop(true);
  });

  return view;
};
