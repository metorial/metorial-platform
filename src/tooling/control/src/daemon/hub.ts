import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../files';
import { detect } from '../root';
import * as workspace from '../workspace';
import { paths } from './home';
import { LogStore } from './logs';
import { WorkspaceRuntime } from './runtime';
import type { Runtime } from './runtime-types';
import { StackRuntime } from './stack-runtime';
import { parseStackMode, stackHostname, stackRunId, validRunName } from '../stack/plan';
import type { StackInfo, WorkspaceInfo } from './types';

export interface StackRegistration {
  root: string;
  identifier: string;
  mode: StackInfo['mode'];
  name: string;
}

export class Hub {
  private runtimes = new Map<string, Runtime>();
  private listeners = new Set<(info: WorkspaceInfo) => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly startedAt = Date.now();

  async load() {
    let read = <T>(file: string): T[] =>
      existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T[]) : [];
    let roots = read<string>(paths().registry);
    let stacks = read<StackRegistration>(paths().stacks);

    for (let root of roots) await this.register(root).catch(() => {});
    for (let item of stacks) await this.registerStack(item).catch(() => {});
  }

  private persist() {
    atomicWrite(
      paths().registry,
      JSON.stringify(
        [...this.runtimes.values()]
          .filter(item => !(item instanceof StackRuntime))
          .map(item => item.project.root),
        null,
        2
      )
    );
    atomicWrite(
      paths().stacks,
      JSON.stringify(
        [...this.runtimes.values()]
          .filter((item): item is StackRuntime => item instanceof StackRuntime)
          .map(item => ({
            root: item.project.root,
            identifier: item.spec.identifier,
            mode: item.spec.mode,
            name: item.spec.name
          })),
        null,
        2
      )
    );
  }

  async registerStack(registration: StackRegistration) {
    let project = detect(registration.root);
    let mode = parseStackMode(registration.mode);
    let name = registration.name;
    if (!validRunName(name)) throw new Error(`invalid stack name ${JSON.stringify(name)}`);

    let id = stackRunId(name);
    let existing = this.runtimes.get(id);
    if (existing) {
      if (!(existing instanceof StackRuntime) || existing.project.root !== project.root)
        throw new Error(
          `${JSON.stringify(id)} is already registered for another workspace or stack`
        );
      if (existing.spec.identifier !== registration.identifier || existing.spec.mode !== mode)
        throw new Error(
          `stack run ${name} already exists as ${existing.spec.identifier} (${existing.spec.mode}); stop and remove it first`
        );

      return existing;
    }

    let hostname = stackHostname(name);
    let runtime: StackRuntime = new StackRuntime(
      project,
      { identifier: registration.identifier, mode, name, id, hostname },
      new LogStore(join(paths().logs, id)),
      () => this.notify(runtime),
      {
        id,
        branch: `${registration.identifier}/${mode === 'development' ? 'dev' : 'prod'}`,
        hostname,
        source_root: project.root,
        runtime: 'docker',
        endpoint_ports: {}
      }
    );
    this.runtimes.set(id, runtime);
    this.persist();

    return runtime;
  }

  async remove(id: string) {
    let runtime = this.get(id);
    if (!(runtime instanceof StackRuntime)) throw new Error(`${id} is not a stack run`);
    if (!runtime.startable) throw new Error(`stack ${id} is ${runtime.phase}; stop it first`);

    this.runtimes.delete(id);
    this.persist();
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

  private notify(runtime: Runtime) {
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
