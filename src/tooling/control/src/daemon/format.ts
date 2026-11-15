import type { LogLine } from './logs';
import type { UnitInfo, WorkspaceInfo } from './types';

export let stripAnsi = (text: string) =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g, '');

let palette = [36, 35, 33, 32, 34, 96, 95, 93, 92, 94];

export let unitColor = (name: string) => {
  let hash = 0;
  for (let char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  return palette[hash % palette.length]!;
};

export let paint = (code: number | string, text: string, enabled: boolean) =>
  enabled ? `\u001b[${code}m${text}\u001b[0m` : text;

export let stateGlyph = (state: UnitInfo['state']) =>
  ({
    running: '●',
    healthy: '●',
    starting: '◌',
    restarting: '◌',
    crashed: '✖',
    stopped: '○'
  })[state];

export let stateColor = (state: UnitInfo['state']) =>
  ({ running: 32, healthy: 32, starting: 33, restarting: 33, crashed: 31, stopped: 90 })[
    state
  ];

export let clock = (ts: number) => new Date(ts).toTimeString().slice(0, 8);

export let duration = (from?: number, to = Date.now()) => {
  if (!from) return '–';
  let seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export let logLine = (line: LogLine, width: number, color: boolean) => {
  let prefix = line.unit.padEnd(width);
  let text = line.stream === 'err' ? paint(31, line.text, color) : line.text;
  if (line.stream === 'sys') text = paint(90, line.text, color);

  return `${paint(90, clock(line.ts), color)} ${paint(unitColor(line.unit), prefix, color)} │ ${text}`;
};

export let table = (rows: string[][], gap = 2) => {
  let widths = rows[0]!.map((_, column) =>
    Math.max(...rows.map(row => stripAnsi(row[column] ?? '').length))
  );

  return rows
    .map(row =>
      row
        .map((cell, column) =>
          column === row.length - 1
            ? cell
            : cell + ' '.repeat(widths[column]! - stripAnsi(cell).length + gap)
        )
        .join('')
        .trimEnd()
    )
    .join('\n');
};

export let workspaceState = (info: WorkspaceInfo) => {
  let services = info.units.filter(unit => unit.kind === 'service');
  let up = services.filter(unit => unit.state === 'running').length;

  return {
    up,
    total: services.length,
    crashed: services.some(unit => unit.state === 'crashed')
  };
};
