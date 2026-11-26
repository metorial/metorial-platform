import { describe, expect, it } from 'vitest';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import { finishSessionContext } from '../../src/context/record';
import { rootHash } from '../../src/context/roots';
import { principalFixture } from '../principal';

let organizationKey = createOrganizationKeyDeriver('unit-test-secret').forOrganization(
  principalFixture({ suffix: 'unit' }).organization
);

let workspaceKey = 'a1b2c3d4'.repeat(6);

let finish = (data: Record<string, unknown>, rootScope = 'aten_device_1') =>
  finishSessionContext({
    organizationKey,
    rootScope,
    sessionKey: 'sk_1',
    content: undefined,
    data: { source: 'probe', ...data }
  });

describe('finishSessionContext with a workspace key', () => {
  it('hashes the key like a root, scoped to the device', () => {
    let { data } = finish({ workspace_key: workspaceKey });

    expect(data.workspace).toEqual({
      root_hash: rootHash(organizationKey, 'aten_device_1', `key:${workspaceKey}`)
    });
  });

  it('gives the same key the same hash on one device and a different one elsewhere', () => {
    let first = finish({ workspace_key: workspaceKey });
    let again = finish({ workspace_key: workspaceKey.toUpperCase() });
    let otherDevice = finish({ workspace_key: workspaceKey }, 'aten_device_2');

    expect(again.data.workspace).toEqual(first.data.workspace);
    expect(again.factKey).toBe(first.factKey);
    expect(otherDevice.data.workspace?.root_hash).not.toBe(first.data.workspace?.root_hash);
  });

  it('labels the workspace with the repository name', () => {
    let { data } = finish({
      workspace_key: workspaceKey,
      repo: { provider: 'github.com', owner: 'acme', name: 'api' }
    });

    expect(data.workspace?.label).toBe('api');
  });

  it('never stores the key', () => {
    let result = finish({ workspace_key: workspaceKey, branch: 'main' });

    expect(result.data).not.toHaveProperty('workspace_key');
    expect(JSON.stringify(result)).not.toContain(workspaceKey);
  });

  it.each(['abc', 'g'.repeat(32), 'a'.repeat(65), 42])('ignores the invalid key %j', key => {
    let result = finish({ workspace_key: key, branch: 'main' });

    expect(result.data).toEqual({ source: 'probe', branch: 'main' });
  });

  it('prefers a path root over a key', () => {
    let result = finishSessionContext({
      organizationKey,
      rootScope: 'aten_device_1',
      sessionKey: 'sk_1',
      content: [{ role: 'path', value: '/Users/dev/api' }],
      data: { source: 'hook', workspace_key: workspaceKey }
    });

    expect(result.data.workspace?.root_hash).toBe(
      rootHash(organizationKey, 'aten_device_1', '/Users/dev/api')
    );
  });
});
