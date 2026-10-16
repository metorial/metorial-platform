import { expect, test } from 'bun:test';
import { restoreNestedResolutions } from './lockfile';

test('restores nested package resolutions omitted by Turbo pruning without restoring unrelated resolutions', () => {
  let pruned = {
    workspaces: {
      '': {},
      'apps/service': { name: '@example/service', devDependencies: { vitest: '^4' } }
    },
    packages: {
      '@example/service': ['@example/service@workspace:apps/service'],
      '@example/service/vitest': [
        'vitest@4',
        '',
        { dependencies: { vite: '^7' } },
        'vitest-integrity'
      ],
      vite: ['vite@5', '', {}, 'vite5-integrity']
    }
  };
  let source = {
    ...pruned,
    packages: {
      ...pruned.packages,
      '@example/service/vitest/vite': [
        'vite@7',
        '',
        { dependencies: { esbuild: '^0.25' } },
        'vite7-integrity'
      ],
      esbuild: ['esbuild@0.25', '', {}, 'esbuild-integrity'],
      unrelated: ['unused@1', '', {}, 'unused-integrity']
    }
  };
  let result = restoreNestedResolutions(source, pruned);
  expect(result.packages['@example/service/vitest/vite']).toEqual(
    source.packages['@example/service/vitest/vite']
  );
  expect(result.packages.esbuild).toEqual(source.packages.esbuild);
  expect(result.packages.unrelated).toBeUndefined();
  expect(pruned.packages['@example/service/vitest/vite']).toBeUndefined();
});

test('preserves workspace identities and nested published versions when Turbo rehoists a registry package over a workspace', () => {
  let source = {
    workspaces: {
      '': {},
      'apps/service': { name: '@example/service', dependencies: { generated: '1' } },
      'clients/mapper': { name: '@example/mapper' }
    },
    packages: {
      '@example/service': ['@example/service@workspace:apps/service'],
      '@example/mapper': ['@example/mapper@workspace:clients/mapper'],
      generated: [
        'generated@1',
        '',
        { dependencies: { '@example/mapper': '1' } },
        'generated-integrity'
      ],
      'generated/@example/mapper': ['@example/mapper@1', '', {}, 'mapper-integrity']
    }
  };
  let pruned = {
    ...source,
    packages: {
      generated: source.packages.generated,
      '@example/mapper': source.packages['generated/@example/mapper']
    }
  };
  let result = restoreNestedResolutions(source, pruned);
  expect(result.packages['@example/mapper']).toEqual(source.packages['@example/mapper']);
  expect(result.packages['generated/@example/mapper']).toEqual(
    source.packages['generated/@example/mapper']
  );
  expect(result.packages.generated).toEqual(source.packages.generated);
});
