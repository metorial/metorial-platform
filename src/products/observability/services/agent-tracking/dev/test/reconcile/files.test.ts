import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareOutputDirectory, writeReport } from '../../src/reconcile/files';

let insideCheckout = join(import.meta.dirname, 'never-written-here');

describe('prepareOutputDirectory', () => {
  let scratch = '';

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'reconcile-out-'));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('creates a folder outside any checkout', () => {
    let target = prepareOutputDirectory(join(scratch, 'report', 'nested'));

    expect(existsSync(target)).toBe(true);
  });

  it('refuses a folder inside the checkout', () => {
    expect(() => prepareOutputDirectory(insideCheckout)).toThrow(/outside any git checkout/);
    expect(existsSync(insideCheckout)).toBe(false);
  });

  it('refuses a symlink, or a path through one, that leads into the checkout', () => {
    let link = join(scratch, 'link');
    symlinkSync(import.meta.dirname, link);

    expect(() => prepareOutputDirectory(link)).toThrow(/outside any git checkout/);
    expect(() => prepareOutputDirectory(join(link, 'deeper'))).toThrow(
      /outside any git checkout/
    );
    expect(existsSync(join(import.meta.dirname, 'deeper'))).toBe(false);
  });

  it('refuses a broken symlink', () => {
    let link = join(scratch, 'broken');
    symlinkSync(join(scratch, 'missing'), link);

    expect(() => prepareOutputDirectory(join(link, 'report'))).toThrow(/broken symlink/);
  });

  it('refuses to write a report through a symlinked report file', () => {
    let out = join(scratch, 'out');
    mkdirSync(out);
    symlinkSync(join(import.meta.dirname, 'stolen.txt'), join(out, 'reconcile-live.txt'));

    expect(() => writeReport(out, 'reconcile-live', { text: 'x', json: {} })).toThrow(
      /symlink/
    );
    expect(existsSync(join(import.meta.dirname, 'stolen.txt'))).toBe(false);
  });
});
