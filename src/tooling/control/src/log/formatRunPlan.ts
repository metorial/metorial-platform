import type { ControlService } from '../types';

export let formatRunPlan = (opts: {
  mode: 'e2e' | 'unit' | 'build';
  controlRoot: string;
  services: ControlService[];
  title?: string;
}): string => {
  let lines: string[] = [];
  lines.push(opts.title ?? 'Control test run');
  lines.push(`  Mode:         ${opts.mode}`);
  lines.push(`  Control root: ${opts.controlRoot}`);
  lines.push(`  Services:     ${opts.services.length}`);
  lines.push('');
  lines.push('Execution order:');

  opts.services.forEach((service, i) => {
    lines.push(`  ${String(i + 1).padStart(2)}. ${service.name.padEnd(24)} ${service.relPath}`);
  });

  return lines.join('\n');
};

export let formatServiceHeader = (opts: {
  index: number;
  total: number;
  service: ControlService;
  mode: 'e2e' | 'unit' | 'build';
  projectName?: string;
}): string => {
  let lines: string[] = [];
  lines.push(`[${opts.index}/${opts.total}] ${opts.service.name} (${opts.mode})`);
  lines.push(`  Path:  ${opts.service.relPath}`);
  if (opts.projectName) lines.push(`  Stack: ${opts.projectName}`);
  return lines.join('\n');
};

export let formatBatchSummary = (opts: {
  results: {
    name: string;
    relPath: string;
    status: 'passed' | 'failed';
    durationMs: number;
    phase?: string;
    errorMessage?: string;
  }[];
  totalDurationMs: number;
  mode: 'e2e' | 'unit' | 'build';
}): string => {
  let passed = opts.results.filter(r => r.status === 'passed');
  let failed = opts.results.filter(r => r.status === 'failed');
  let lines: string[] = [];

  let totalLabel = `${opts.results.length} service${opts.results.length === 1 ? '' : 's'}`;
  lines.push(`Results (${totalLabel}, ${formatDurationLabel(opts.totalDurationMs)})`);
  lines.push('');

  for (let result of opts.results) {
    let status = result.status === 'passed' ? 'PASS' : 'FAIL';
    let duration = formatDurationShort(result.durationMs);
    let phase = result.phase ? `  during: ${result.phase}` : '';
    lines.push(`  ${status}  ${result.name.padEnd(26)} (${duration})${phase}`);
    if (result.errorMessage) {
      lines.push(`        ${result.errorMessage}`);
    }
  }

  lines.push('');
  lines.push(`${passed.length} passed, ${failed.length} failed`);

  if (failed.length > 0) {
    lines.push('');
    lines.push('hint: Re-run failed services with:');
    let filters = failed.map(f => `--filter ${f.name}`).join(' ');
    lines.push(`  control ${opts.mode} ${filters}`);
  }

  return lines.join('\n');
};

let formatDurationLabel = (ms: number): string => {
  let totalSec = Math.round(ms / 1000);
  let min = Math.floor(totalSec / 60);
  let sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
};

let formatDurationShort = (ms: number): string => {
  let totalSec = Math.round(ms / 1000);
  let min = Math.floor(totalSec / 60);
  let sec = totalSec % 60;
  if (min > 0) return `${min}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
};
