import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface LogLine {
  seq: number;
  ts: number;
  unit: string;
  stream: 'out' | 'err' | 'sys';
  text: string;
}

export let replayLines = 1000;
export let logFileName = (unit: string) => `${unit.replace(/[^a-zA-Z0-9_.-]/g, '_')}.log`;

let maxFileBytes = 20 * 1024 * 1024;

export class LogStore {
  private seq = 0;
  private rings = new Map<string, LogLine[]>();
  private pending = new Map<string, string>();
  private listeners = new Set<(line: LogLine) => void>();
  private files = new Set<string>();

  constructor(private directory?: string) {
    if (directory) mkdirSync(directory, { recursive: true });
  }

  append(unit: string, text: string, stream: LogLine['stream'] = 'out') {
    let key = `${unit}\0${stream}`;
    let buffered = (this.pending.get(key) ?? '') + text.replaceAll('\r\n', '\n');
    let parts = buffered.split('\n');
    this.pending.set(key, parts.pop() ?? '');

    for (let part of parts) this.push(unit, part, stream);
  }

  system(unit: string, text: string) {
    this.push(unit, text, 'sys');
  }

  flush(unit: string) {
    for (let stream of ['out', 'err'] as const) {
      let key = `${unit}\0${stream}`;
      let rest = this.pending.get(key);
      if (rest) this.push(unit, rest, stream);
      this.pending.delete(key);
    }
  }

  private push(unit: string, text: string, stream: LogLine['stream']) {
    let line: LogLine = { seq: ++this.seq, ts: Date.now(), unit, stream, text };
    let ring = this.rings.get(unit);
    if (!ring) this.rings.set(unit, (ring = []));
    ring.push(line);
    if (ring.length > replayLines * 2) ring.splice(0, ring.length - replayLines);
    this.write(line);

    for (let listener of this.listeners) listener(line);
  }

  private write(line: LogLine) {
    if (!this.directory) return;
    let file = join(this.directory, logFileName(line.unit));

    try {
      if (!this.files.has(file)) {
        this.files.add(file);
        try {
          if (statSync(file).size > maxFileBytes) renameSync(file, `${file}.1`);
        } catch {}
      }
      appendFileSync(file, `${new Date(line.ts).toISOString()} ${line.stream} ${line.text}\n`);
    } catch {}
  }

  query(options: { units?: string[]; tail?: number; since?: number } = {}) {
    let selected: LogLine[] = [];

    for (let [unit, ring] of this.rings) {
      if (options.units?.length && !options.units.includes(unit)) continue;

      let lines =
        options.since === undefined ? ring : ring.filter(line => line.seq > options.since!);
      selected.push(...(options.tail === undefined ? lines : lines.slice(-options.tail)));
    }

    return selected.sort((a, b) => a.seq - b.seq);
  }

  units() {
    return [...this.rings.keys()];
  }

  subscribe(listener: (line: LogLine) => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(unit: string) {
    this.rings.delete(unit);
  }
}
