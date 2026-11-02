import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../files';
import { detect } from '../root';
import * as workspace from '../workspace';
import { paths } from './home';
import { LogStore } from './logs';
import { WorkspaceRuntime } from './runtime';
import type { WorkspaceInfo } from './types';

export class Hub {
  private runtimes = new Map<string, WorkspaceRuntime>();
  private listeners = new Set<(info: WorkspaceInfo) => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly startedAt = Date.now();

  async load() {
    let file = paths().registry;
    if (!existsSync(file)) return;

    for (let root of JSON.parse(readFileSync(file, 'utf8')) as string[])
      await this.register(root).catch(() => {});
  }

  private persist() {
    atomicWrite(
      paths().registry,
      JSON.stringify(
        [...this.runtimes.values()].map(item => item.project.root),
        null,
        2
      )
    );
  }

  async register(root: string) {
    let project = detect(root);
    let data = await workspace.metadata(project);
    let existing = this.runtimes.get(data.id);

    if (existing) {
      if (existing.project.root !== project.root)
        throw new Error(
          `workspace id ${JSON.stringify(data.id)} is already registered for ${existing.project.root}`
        );

      return existing;
    }

    let logs = new LogStore(join(paths().logs, data.id));
    let runtime: WorkspaceRuntime = new WorkspaceRuntime(project, data, logs, () =>
      this.notify(runtime)
    );
    this.runtimes.set(data.id, runtime);
    this.persist();

    return runtime;
  }

  private notify(runtime: WorkspaceRuntime) {
    if (this.timers.has(runtime.id)) return;

    this.timers.set(
      runtime.id,
      setTimeout(() => {
        this.timers.delete(runtime.id);
        let info = runtime.info();
        for (let listener of this.listeners) listener(info);
      }, 50)
    );
  }

  get(id: string) {
    let runtime = this.runtimes.get(id);
    if (!runtime) throw new Error(`unknown workspace ${JSON.stringify(id)}`);

    return runtime;
  }

  list() {
    return [...this.runtimes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  subscribe(listener: (info: WorkspaceInfo) => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async shutdown() {
    await Promise.allSettled(this.list().map(runtime => runtime.shutdown()));
  }
}
