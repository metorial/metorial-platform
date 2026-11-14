import { describe, expect, test } from 'bun:test';
import { renderOverlay } from './overlay';

let keys = {
  functions: { kid: 'fn0000000000000a', publicKey: 'function-public' },
  build: { kid: 'bd0000000000000b', publicKey: 'build-public' }
};

let render = () =>
  JSON.parse(
    renderOverlay({
      base: '../../deploy/dev-real',
      keys,
      objectStorageUrl: 'http://host.docker.internal:30826'
    })
  ) as { resources: string[]; patches: { patch: string }[] };

let patches = () => render().patches.map(item => JSON.parse(item.patch));

describe('renderOverlay', () => {
  test('layers on dev-real', () => {
    expect(render().resources).toEqual(['../../deploy/dev-real']);
  });

  test('publishes the function key to runtime-trust and both keys to egress-trust', () => {
    let trust = Object.fromEntries(
      patches()
        .filter(patch => patch.kind === 'ConfigMap')
        .map(patch => [patch.metadata.name, JSON.parse(patch.data['keys.json'])])
    );

    expect(trust['runtime-trust']).toEqual({ keys: { fn0000000000000a: 'function-public' } });
    expect(trust['egress-trust']).toEqual({
      keys: { fn0000000000000a: 'function-public', bd0000000000000b: 'build-public' }
    });
  });

  test('points the cluster-manager at the host object storage and drops the in-cluster one', () => {
    let all = patches();
    let deployment = all.find(patch => patch.metadata.name === 'runtime-cluster-manager');

    expect(deployment.spec.template.spec.containers[0].env).toEqual([
      { name: 'OBJECT_STORAGE_URL', value: 'http://host.docker.internal:30826' }
    ]);
    expect(
      all
        .filter(patch => patch.$patch === 'delete')
        .map(patch => `${patch.kind}/${patch.metadata.name}`)
    ).toEqual(['Deployment/object-storage', 'Service/object-storage']);
  });
});
