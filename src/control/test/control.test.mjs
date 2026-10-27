import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { findControlManifest } from '../bin-files/control.mjs';

let withTemporaryDirectory = callback => {
  let directory = mkdtempSync(join(tmpdir(), 'total-control-'));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

let writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));

test('finds the enterprise Control instance from an OSS subdirectory', () => {
  withTemporaryDirectory(root => {
    mkdirSync(join(root, '.git'));
    mkdirSync(join(root, 'oss/src/control/src'), { recursive: true });
    mkdirSync(join(root, 'oss/src/deep/package'), { recursive: true });
    writeJson(join(root, 'package.json'), { name: '@metorial/enterprise' });
    writeJson(join(root, 'oss/package.json'), { name: '@metorial/oss' });
    writeFileSync(join(root, 'oss/src/control/src/main.ts'), '');

    assert.equal(
      findControlManifest(join(root, 'oss/src/deep/package')),
      join(root, 'oss/src/control/src/main.ts')
    );
  });
});

test('finds the standalone OSS Control instance from a subdirectory', () => {
  withTemporaryDirectory(root => {
    mkdirSync(join(root, '.git'));
    mkdirSync(join(root, 'src/control/src'), { recursive: true });
    mkdirSync(join(root, 'src/deep/package'), { recursive: true });
    writeJson(join(root, 'package.json'), { name: '@metorial/oss' });
    writeFileSync(join(root, 'src/control/src/main.ts'), '');

    assert.equal(
      findControlManifest(join(root, 'src/deep/package')),
      join(root, 'src/control/src/main.ts')
    );
  });
});

test('does not select an unrelated directory', () => {
  withTemporaryDirectory(root => {
    assert.equal(findControlManifest(root), undefined);
  });
});
