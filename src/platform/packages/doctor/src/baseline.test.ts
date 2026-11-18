import { createDoctor } from '@lowerdeck/doctor';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baselineChecks, readMemoryLimit } from './baseline';

describe('baselineChecks', () => {
  it('passes with a valid public URL and no memory limit', async () => {
    let report = await createDoctor({
      component: 'test',
      checks: baselineChecks({ publicUrl: 'https://metorial.example.com', readMemoryLimit: async () => null })
    }).run();
    let checks = Object.fromEntries(report.checks.map(item => [item.id, item]));

    expect(checks['config.settings']!.status).toBe('pass');
    expect(checks['config.public-url']!.status).toBe('pass');
    expect(checks['runtime.memory']!.status).toBe('pass');
    expect(checks['runtime.event-loop']!.status).toBe('pass');
    expect(checks['runtime.tmp']!.status).toBe('pass');
  });

  it('fails an invalid public URL and warns near the memory limit', async () => {
    let report = await createDoctor({
      component: 'test',
      checks: baselineChecks({ publicUrl: 'metorial.example.com', readMemoryLimit: async () => 1024 })
    }).run();
    let checks = Object.fromEntries(report.checks.map(item => [item.id, item]));

    expect(checks['config.public-url']!.status).toBe('fail');
    expect(checks['runtime.memory']!.status).toBe('warn');
  });
});

describe('readMemoryLimit', () => {
  it('reads cgroup v2 limits and treats "max" as unlimited', async () => {
    let directory = await mkdtemp(join(tmpdir(), 'doctor-cgroup-'));
    let limited = join(directory, 'limited');
    let unlimited = join(directory, 'unlimited');
    await writeFile(limited, '536870912\n');
    await writeFile(unlimited, 'max\n');

    expect(await readMemoryLimit([limited])).toBe(536870912);
    expect(await readMemoryLimit([unlimited])).toBeNull();
    expect(await readMemoryLimit([join(directory, 'missing')])).toBeNull();
  });
});
