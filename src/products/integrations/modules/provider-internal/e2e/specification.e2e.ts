import {
  createRemoteProvider,
  eventually,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import type { ProviderSpecification } from '@metorial-subspace/db';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  providerSpecificationInternalService,
  providerVersionSpecificationMergeService
} from '../src';
import { listSessionTools, loadCurrentVersion, toolKeys } from './_fixtures';

type SpecificationValue = ProviderSpecification['value'];
type SpecificationTool = SpecificationValue['tools'][number];

let uniqueKey = (prefix: string) => `tool_${prefix}_${randomBytes(4).toString('hex')}`;

let partsOf = (value: SpecificationValue, tools: SpecificationTool[] = value.tools) => ({
  specification: value.specification,
  authMethods: value.authMethods,
  features: value.features,
  tools,
  triggers: value.triggers ?? [],
  triggerGroups: value.triggerGroups ?? []
});

describe('module-provider-internal specifications and version merges', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );
  let base = useFixture(async () => {
    await listSessionTools(org, remote.providerId);

    let version = await eventually(
      async () => {
        let version = await loadCurrentVersion(remote.providerId);
        expect(version.specification?.type).toBe('full');
        expect(toolKeys(version.specification)).toContain('tool_add');
        return version;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );
    let provider = await subspaceDb.provider.findUniqueOrThrow({
      where: { oid: version.providerOid }
    });

    return { provider, version, specification: version.specification! };
  });

  let toolWithKey = (key: string): SpecificationTool => ({
    ...base.specification.value.tools.find(tool => tool.key === 'tool_add')!,
    key,
    name: key,
    specId: key,
    specUniqueIdentifier: key,
    callableId: key
  });

  let ensure = (tools: SpecificationTool[]) =>
    providerSpecificationInternalService.ensureProviderSpecification({
      provider: base.provider,
      providerVersion: base.version,
      type: 'full',
      ...partsOf(base.specification.value, tools)
    });

  let merge = async (tools: SpecificationTool[]) => {
    let version = await loadCurrentVersion(remote.providerId);

    return await providerVersionSpecificationMergeService.mergeIntoProviderVersionSpecification(
      {
        provider: base.provider,
        providerVersion: version,
        discovered: partsOf(base.specification.value, tools)
      }
    );
  };

  it('creates one specification for the same content, ensured concurrently and again later', async () => {
    let key = uniqueKey('concurrent');
    let tools = [...base.specification.value.tools, toolWithKey(key)];

    let results = await Promise.all([ensure(tools), ensure(tools), ensure(tools)]);
    let [created] = results;

    expect(new Set(results.map(result => result.oid)).size).toBe(1);
    expect(created!.oid).not.toBe(base.specification.oid);
    expect(created!.type).toBe('full');
    expect(
      await subspaceDb.providerSpecification.count({
        where: { providerOid: base.provider.oid, hash: created!.hash }
      })
    ).toBe(1);

    let again = await ensure(tools);
    expect(again.oid).toBe(created!.oid);

    let rows = await subspaceDb.providerTool.findMany({
      where: { specificationOid: created!.oid }
    });
    expect(rows.map(row => row.key).sort()).toEqual(tools.map(tool => tool.key).sort());

    let tool = rows.find(row => row.key === key)!;
    await eventually(async () => {
      let global = await subspaceDb.providerToolGlobal.findUniqueOrThrow({
        where: { oid: tool.globalOid }
      });
      expect(global).toMatchObject({ key, providerOid: base.provider.oid });
      expect(global.currentInstanceOid).toBe(tool.oid);
    });
  });

  it('keeps one tool per key when the discovered tools repeat a key', async () => {
    let key = uniqueKey('duplicate');
    let duplicate = toolWithKey(key);

    let created = await ensure([
      ...base.specification.value.tools,
      duplicate,
      { ...duplicate, description: 'A second definition with the same key' }
    ]);

    expect(created.value.tools.filter(tool => tool.key === key)).toHaveLength(1);
    expect(
      await subspaceDb.providerTool.count({ where: { specificationOid: created.oid, key } })
    ).toBe(1);
  });

  it('rejects a tool that references an adapter the provider does not have', async () => {
    let key = uniqueKey('adapter');

    await expect(
      ensure([
        ...base.specification.value.tools,
        { ...toolWithKey(key), adapterIdentifier: 'e2e-missing-adapter' }
      ])
    ).rejects.toThrow(
      'Provider adapter not found for specification action: e2e-missing-adapter'
    );

    expect(
      await subspaceDb.providerToolGlobal.findFirst({
        where: { providerOid: base.provider.oid, key }
      })
    ).toBeNull();
  });

  it('merges only new tool keys into the version specification and records the change', async () => {
    let version = await loadCurrentVersion(remote.providerId);
    let currentKeys = toolKeys(version.specification);

    let unchanged = await merge(version.specification!.value.tools.slice(0, 1));
    expect(unchanged.addedKeys).toEqual([]);
    expect(unchanged.specification.oid).toBe(version.specificationOid);

    let key = uniqueKey('merged');
    let merged = await merge([toolWithKey(key)]);
    expect(merged.addedKeys).toEqual([key]);
    expect(toolKeys(merged.specification)).toEqual([...currentKeys, key].sort());

    let repointed = await loadCurrentVersion(remote.providerId);
    expect(repointed).toMatchObject({
      specificationOid: merged.specification.oid,
      specificationDiscoveryStatus: 'discovered'
    });

    let change = await subspaceDb.providerVersionSpecificationChange.findFirstOrThrow({
      where: {
        fromVersionOid: version.oid,
        toVersionOid: version.oid,
        fromSpecificationOid: version.specificationOid!,
        toSpecificationOid: merged.specification.oid
      },
      include: { providerSpecificationChangeNotifications: true }
    });
    expect(change.providerSpecificationChangeNotifications).toEqual([
      expect.objectContaining({ target: 'version', versionOid: version.oid })
    ]);

    let again = await merge([toolWithKey(key)]);
    expect(again.addedKeys).toEqual([]);
    expect(again.specification.oid).toBe(merged.specification.oid);
  });

  it('keeps the tools of concurrent merges into the same version', async () => {
    let first = uniqueKey('first');
    let second = uniqueKey('second');

    await Promise.all([merge([toolWithKey(first)]), merge([toolWithKey(second)])]);

    let version = await loadCurrentVersion(remote.providerId);
    expect(toolKeys(version.specification)).toEqual(expect.arrayContaining([first, second]));
  });
});
