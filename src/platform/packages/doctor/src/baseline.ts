import { check, type CheckDefinition } from '@lowerdeck/doctor';
import { getEdition } from '@metorial/editions';
import { listSettingIssues } from '@metorial/settings';
import { readFile, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';

let memoryWarnRatio = 0.9;
let eventLoopWarnMs = 500;
let tmpWarnFreeRatio = 0.1;

let cgroupMemoryFiles = ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes'];

// cgroup v1 reports "no limit" as a huge number close to the 64-bit maximum.
let unlimitedThreshold = 2 ** 60;

let audienceHints: Record<string, string> = {
  customer: 'Set the value in your Helm values or compose environment.',
  deployment: 'The deployment renders this value; re-apply the chart or check per-component env overrides.',
  derived: 'Metorial derives this value from other settings; fix the settings it is derived from.'
};

export let readMemoryLimit = async (files = cgroupMemoryFiles) => {
  for (let file of files) {
    try {
      let value = (await readFile(file, 'utf8')).trim();
      if (value == 'max') return null;

      let bytes = Number(value);
      if (Number.isFinite(bytes) && bytes > 0 && bytes < unlimitedThreshold) return bytes;
      return null;
    } catch {}
  }

  return null;
};

let eventLoop: IntervalHistogram | undefined;

let eventLoopHistogram = () => {
  if (!eventLoop) {
    eventLoop = monitorEventLoopDelay({ resolution: 20 });
    eventLoop.enable();
  }

  return eventLoop;
};

let settingsCheck = (): CheckDefinition =>
  check({
    id: 'config.settings',
    title: 'Configuration is valid',
    category: 'configuration',
    severity: 'critical',
    run: ctx => {
      let issues = listSettingIssues();
      if (!issues.length) return ctx.pass('All settings are valid.');

      let byAudience: Record<string, { env: string; message: string }[]> = {};
      for (let issue of issues) {
        (byAudience[issue.audience] ??= []).push({ env: issue.env, message: issue.message });
      }

      return ctx.fail({
        message: `${issues.length} setting${issues.length == 1 ? ' is' : 's are'} invalid: ${issues
          .map(issue => issue.env)
          .join(', ')}.`,
        resolution: {
          summary: 'Fix the listed settings and restart the component.',
          steps: Object.keys(byAudience).map(
            audience => `${audienceHints[audience] ?? ''} (${byAudience[audience]!.map(item => item.env).join(', ')})`
          ),
          docs: 'datacenter/operations/doctor#configuration'
        },
        details: { issues: byAudience }
      });
    }
  });

let publicUrlCheck = (publicUrl: string | undefined): CheckDefinition =>
  check({
    id: 'config.public-url',
    title: 'Public URL is configured',
    category: 'configuration',
    severity: 'critical',
    run: ctx => {
      if (!publicUrl) {
        if (getEdition() != 'on-prem') return ctx.skip('METORIAL_PUBLIC_URL is not used here.');

        return ctx.fail({
          message: 'METORIAL_PUBLIC_URL is not set.',
          resolution: {
            summary: 'Set publicUrl in your Helm values (or METORIAL_PUBLIC_URL).',
            docs: 'datacenter/operations/doctor#configuration'
          }
        });
      }

      let parsed: URL;
      try {
        parsed = new URL(publicUrl);
      } catch {
        return ctx.fail({
          message: `METORIAL_PUBLIC_URL is not a valid URL: ${publicUrl}`,
          resolution: { summary: 'Use a full URL such as https://metorial.example.com.' }
        });
      }

      if (parsed.protocol != 'http:' && parsed.protocol != 'https:') {
        return ctx.fail(`METORIAL_PUBLIC_URL must use http or https, not ${parsed.protocol}`);
      }

      return ctx.pass(`The public URL is ${parsed.origin}.`, { publicUrl: parsed.origin });
    }
  });

let memoryCheck = (readLimit: () => Promise<number | null>): CheckDefinition =>
  check({
    id: 'runtime.memory',
    title: 'Memory usage is below the limit',
    category: 'runtime',
    severity: 'warning',
    run: async ctx => {
      let rss = process.memoryUsage().rss;
      let limit = await readLimit();
      let rssMb = Math.round(rss / 1024 / 1024);

      if (!limit) return ctx.pass(`Using ${rssMb} MiB; no memory limit is set.`, { rssMb });

      let ratio = rss / limit;
      let details = { rssMb, limitMb: Math.round(limit / 1024 / 1024), ratio: Number(ratio.toFixed(3)) };

      if (ratio > memoryWarnRatio) {
        return ctx.warn({
          message: `Using ${Math.round(ratio * 100)}% of the memory limit.`,
          resolution: {
            summary: 'Raise the memory limit of this component, or add replicas.',
            steps: ['Set components.<name>.resources.limits.memory in your Helm values.']
          },
          details
        });
      }

      return ctx.pass(`Using ${Math.round(ratio * 100)}% of the memory limit.`, details);
    }
  });

let eventLoopCheck = (): CheckDefinition =>
  check({
    id: 'runtime.event-loop',
    title: 'Event loop is responsive',
    category: 'runtime',
    severity: 'warning',
    run: ctx => {
      let histogram = eventLoopHistogram();
      let p99Ms = Math.round(histogram.percentile(99) / 1e6);
      histogram.reset();

      if (p99Ms > eventLoopWarnMs) {
        return ctx.warn({
          message: `The event loop was blocked for up to ${p99Ms}ms (p99).`,
          resolution: { summary: 'The component is overloaded. Raise its CPU limit or add replicas.' },
          details: { p99Ms }
        });
      }

      return ctx.pass(`Event loop delay p99 is ${p99Ms}ms.`, { p99Ms });
    }
  });

let tmpCheck = (directory: string): CheckDefinition =>
  check({
    id: 'runtime.tmp',
    title: 'Temporary directory is writable',
    category: 'runtime',
    severity: 'warning',
    run: async ctx => {
      let file = join(directory, `.metorial-doctor-${process.pid}`);

      try {
        await writeFile(file, 'ok');
        await rm(file, { force: true });
      } catch (error) {
        return ctx.warn({
          message: `${directory} is not writable: ${(error as Error).message}`,
          resolution: { summary: 'Mount a writable emptyDir at /tmp.' }
        });
      }

      let stats = await statfs(directory).catch(() => null);
      if (!stats || !stats.blocks) return ctx.pass(`${directory} is writable.`);

      let freeRatio = stats.bavail / stats.blocks;
      let details = { directory, freeMb: Math.round((stats.bavail * stats.bsize) / 1024 / 1024) };

      if (freeRatio < tmpWarnFreeRatio) {
        return ctx.warn({
          message: `${directory} has only ${Math.round(freeRatio * 100)}% free space.`,
          resolution: { summary: 'Raise the size limit of the /tmp volume.' },
          details
        });
      }

      return ctx.pass(`${directory} is writable with ${Math.round(freeRatio * 100)}% free.`, details);
    }
  });

export let baselineChecks = (
  options: {
    publicUrl?: string;
    readMemoryLimit?: () => Promise<number | null>;
    tmpDirectory?: string;
  } = {}
): CheckDefinition[] => [
  settingsCheck(),
  publicUrlCheck(options.publicUrl ?? process.env.METORIAL_PUBLIC_URL),
  memoryCheck(options.readMemoryLimit ?? (() => readMemoryLimit())),
  eventLoopCheck(),
  tmpCheck(options.tmpDirectory ?? tmpdir())
];
