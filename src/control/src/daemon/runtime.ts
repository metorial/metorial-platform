import type { ChildProcess } from 'node:child_process';
import { relative } from 'node:path';

import * as commands from '../process';
import * as dev from '../dev';
import * as docker from '../docker';
import * as environment from '../environment';
import * as proxy from '../proxy';
import * as turbo from '../turbo';
import * as workspace from '../workspace';
import { clearServicePorts } from '../ports';
import type { Environment, LoadedManifest, ProjectRoot, WorkspaceMetadata } from '../types';
import { LogStore } from './logs';
import * as reload from './reload';
import type {
  JobInfo,
  JobKind,
  LinkInfo,
  Phase,
  StartOptions,
  UnitInfo,
  WorkspaceInfo
} from './types';

let maxBackoff = 30_000;
let healthyAfter = 60_000;
let maxJobs = 20;

interface Unit extends UnitInfo {
  stopping: boolean;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
  compose?: string;
  package?: turbo.TurboPackage;
  launching?: Promise<void>;
}

export class WorkspaceRuntime {
  phase: Phase = 'idle';
  error?: string;
  startedAt?: number;
  jobs: JobInfo[] = [];
  links: LinkInfo[] = [];
  devLogin?: string;

  private units = new Map<string, Unit>();
  private children = new Map<string, ChildProcess>();
  private selected: LoadedManifest[] = [];
  private env: Environment = {};
  private projects: docker.ComposeProject[] = [];
  private unregister?: () => Promise<void>;
  private lastStart: StartOptions = {};
  private stopWatching?: () => void;
  private routes = '';
  private infrastructure = '';
  private jobCounter = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private startup?: AbortController;

  constructor(
    readonly project: ProjectRoot,
    public data: WorkspaceMetadata,
    readonly logs: LogStore,
    private changed: () => void
  ) {}

  get id() {
    return this.data.id;
  }

  info(): WorkspaceInfo {
    return {
      id: this.data.id,
      kind: 'workspace',
      root: this.project.root,
      branch: this.data.branch,
      hostname: this.data.hostname,
      phase: this.phase,
      error: this.error,
      startedAt: this.startedAt,
      units: [...this.units.values()].map(
        ({ stopping, attempts, timer, compose, package: pkg, launching, ...unit }) => unit
      ),
      jobs: this.jobs,
      links: this.links,
      devLogin: this.devLogin
    };
  }

  private set(phase: Phase, error?: string) {
    this.phase = phase;
    this.error = error;
    this.logs.system('control', `workspace ${phase}${error ? `: ${error}` : ''}`);
    this.changed();
  }

  private sink(unit: string): commands.OutputSink {
    return (text, stream) => this.logs.append(unit, text, stream);
  }

  private within<T>(unit: string, work: () => Promise<T>) {
    return commands.outputSink.run(this.sink(unit), work);
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    let result = this.queue.then(work, work);
    this.queue = result.catch(() => {});

    return result;
  }

  get startable() {
    return ['idle', 'stopped', 'failed'].includes(this.phase);
  }

  async start(options: StartOptions = {}) {
    if (!this.startable) throw new Error(`workspace ${this.id} is ${this.phase}`);
    this.lastStart = options;

    let startup = new AbortController();
    this.startup = startup;
    this.set('preparing');

    return this.serialized(async () => {
      try {
        await commands.cancellation.run(startup.signal, () => this.doStart(options));
      } finally {
        if (this.startup === startup) this.startup = undefined;
      }
    });
  }

  private async doStart(options: StartOptions) {
    this.startedAt = Date.now();
    this.units.clear();

    try {
      let { manifests, selected, env } = await dev.selection(
        this.project,
        options.selectors ?? []
      );
      if (!selected.length) throw new Error('no control manifests were selected');

      commands.checkInterrupted();
      this.selected = selected;
      this.env = env;
      let packages = turbo.plan(selected, this.project.root, env);
      if (!packages.length) throw new Error('selected manifests contain no run commands');

      this.data = await workspace.metadata(this.project);
      commands.checkInterrupted();
      let ports = servicePorts(selected);

      for (let pkg of packages)
        this.units.set(pkg.name, {
          name: pkg.name,
          kind: 'service',
          state: 'stopped',
          restarts: 0,
          ports: ports.get(pkg.name) ?? [],
          stopping: false,
          attempts: 0,
          package: pkg
        });
      this.links = linksFor(this.data, selected);
      this.devLogin = devLoginFor(this.data, selected);

      if (!options.noDocker) {
        this.set('infra');
        this.projects = await this.within('infra', () =>
          docker.start(this.project.root, selected, env)
        );

        commands.checkInterrupted();
        for (let [compose, services] of this.projects)
          for (let service of services)
            this.units.set(service, {
              name: service,
              kind: 'infra',
              state: 'healthy',
              restarts: 0,
              ports: [],
              stopping: false,
              attempts: 0,
              compose
            });
        this.changed();
      }

      this.set('preparing');
      await this.within('prepare', () =>
        dev.prepareSelected(this.project, selected, env, !!options.noPrepare)
      );

      commands.checkInterrupted();
      if (!options.noProxy) {
        await this.within('control', () =>
          proxy.ensure(this.project, this.data, proxy.publicPorts(manifests, this.project))
        );
        this.unregister = await proxy.register(this.project, this.data, selected);
      }

      commands.checkInterrupted();
      this.set('starting');
      await this.startServices(packages);
      commands.checkInterrupted();
      this.routes = reload.routeKey(selected);
      this.infrastructure = reload.infrastructureKey(selected);
      this.stopWatching?.();
      this.stopWatching = reload.watchDefinitions(manifests, file => {
        this.logs.system(
          'control',
          `definition changed: ${relative(this.project.root, file)}`
        );
        void this.reloadDefinitions();
      });
      this.set('running');
    } catch (error) {
      this.stopWatching?.();
      this.stopWatching = undefined;
      await commands.cancellation.run(undefined, async () => {
        await this.killServices();
        await this.unregister?.().catch(() => {});
      });
      this.unregister = undefined;
      if (error instanceof commands.Interrupted) return;
      this.set('failed', error instanceof Error ? error.message : String(error));
      this.logs.system('control', `start failed: ${this.error}`);
    }
  }

  private async startServices(packages: turbo.TurboPackage[]) {
    let names = new Set(packages.map(item => item.name));
    let started = new Set<string>();
    let pending = [...packages];

    while (pending.length) {
      commands.checkInterrupted();
      let ready = pending.filter(item =>
        item.dependencies.every(name => started.has(name) || !names.has(name))
      );
      if (!ready.length) ready = [...pending];

      for (let item of ready) {
        let unit = this.units.get(item.name)!;
        if (!unit.stopping && !this.children.has(item.name)) await this.launchUnit(unit);
        started.add(item.name);
      }
      pending = pending.filter(item => !started.has(item.name));
      if (pending.length) await commands.delay(500);
    }
  }

  private async launchUnit(unit: Unit) {
    if (unit.launching) return unit.launching;
    unit.stopping = false;
    unit.state = 'starting';
    unit.exitCode = undefined;
    unit.startedAt = undefined;
    this.changed();

    let launching = (async () => {
      await clearServicePorts(
        unit.ports,
        unit.package!.cwd,
        message => this.logs.system(unit.name, message),
        () => [...this.children.values()].flatMap(child => (child.pid ? [child.pid] : []))
      );
      commands.checkInterrupted();
      if (!unit.stopping) this.spawnUnit(unit);
    })();
    unit.launching = launching;

    try {
      await launching;
    } catch (error) {
      unit.state = unit.stopping ? 'stopped' : 'crashed';
      this.logs.system(unit.name, `could not start service: ${error}`);
      this.changed();

      throw error;
    } finally {
      if (unit.launching === launching) unit.launching = undefined;
    }
  }

  private scheduleRestart(unit: Unit) {
    if (unit.stopping) return;
    if (unit.startedAt && Date.now() - unit.startedAt > healthyAfter) unit.attempts = 0;
    let wait = Math.min(maxBackoff, 1000 * 2 ** unit.attempts++);
    unit.state = 'crashed';
    unit.restarts++;
    this.logs.system(unit.name, `restarting in ${Math.round(wait / 1000)}s`);

    unit.timer = setTimeout(() => {
      unit.timer = undefined;
      if (!unit.stopping && ['running', 'starting'].includes(this.phase))
        void this.launchUnit(unit).catch(() => this.scheduleRestart(unit));
    }, wait);
    this.changed();
  }

  private spawnUnit(unit: Unit) {
    let pkg = unit.package!;
    let [program, args] = commands.shellInvocation(pkg.command);

    let child = commands.spawn(program, args, pkg.cwd, pkg.environment, false, true);
    child.stdin?.end();
    this.children.set(unit.name, child);
    child.stdout?.on('data', chunk => this.logs.append(unit.name, chunk.toString(), 'out'));
    child.stderr?.on('data', chunk => this.logs.append(unit.name, chunk.toString(), 'err'));

    child.once('spawn', () => {
      unit.pid = child.pid;
      unit.state = 'running';
      unit.startedAt = Date.now();
      this.logs.system(unit.name, `started (pid ${child.pid})`);
      this.changed();
    });
    child.once('error', error => {
      this.logs.system(unit.name, `could not launch: ${error.message}`);
    });
    child.once('close', (code, signal) => {
      this.logs.flush(unit.name);
      if (this.children.get(unit.name) !== child) return;
      this.children.delete(unit.name);
      unit.pid = undefined;
      unit.exitCode = code;

      if (unit.stopping) {
        unit.state = 'stopped';
        this.logs.system(unit.name, 'stopped');
      } else {
        this.logs.system(unit.name, `exited with ${signal ?? `code ${code}`}`);
        this.scheduleRestart(unit);
      }
      this.changed();
    });
    this.changed();
  }

  private async stopUnit(unit: Unit) {
    unit.stopping = true;
    if (unit.timer) clearTimeout(unit.timer);
    unit.timer = undefined;
    await unit.launching?.catch(() => {});
    let child = this.children.get(unit.name);
    if (!child) {
      unit.state = 'stopped';

      return;
    }

    if (this.startup || unit.state === 'starting') commands.signalTree(child, 'SIGKILL');
    else await commands.terminateTree(child);
    for (let waited = 0; this.children.get(unit.name) === child && waited < 50; waited++)
      await commands.delay(100);
  }

  private async killServices() {
    await Promise.all(
      [...this.units.values()]
        .filter(unit => unit.kind === 'service')
        .map(u => this.stopUnit(u))
    );
  }

  async stop(options: { keepInfra?: boolean } = {}) {
    if (['idle', 'stopped', 'stopping'].includes(this.phase)) return;
    this.startup?.abort();
    this.set('stopping');

    await this.serialized(async () => {
      this.set('stopping');
      this.stopWatching?.();
      this.stopWatching = undefined;
      await this.killServices();

      try {
        await this.unregister?.();
      } catch {}
      this.unregister = undefined;

      await this.within('control', async () => {
        try {
          await dev.cleanupCommands(this.selected, this.env);
        } catch (error) {
          commands.warn(`cleanup failed: ${error}`);
        }

        if (!options.keepInfra) {
          await docker.stop(this.project.root, this.projects, this.env);
          for (let unit of this.units.values())
            if (unit.kind === 'infra') unit.state = 'stopped';
        }
      });
      this.startedAt = undefined;
      this.set('stopped');
    });
  }

  async restartWorkspace(options: { infra?: boolean } = {}) {
    let previous = this.lastStart;
    await this.stop({ keepInfra: !options.infra });
    await this.start(previous);
  }

  async clean() {
    await this.stop();

    await this.serialized(async () => {
      this.set('stopping');

      try {
        let { selected, env } = await dev.selection(
          this.project,
          this.lastStart.selectors ?? [],
          false
        );
        let projects = docker.composeProjects(this.project.root, selected);

        await this.within('control', () =>
          docker.reset(this.project.root, projects, env, false)
        );
        this.set('stopped');
      } catch (error) {
        this.set('failed', error instanceof Error ? error.message : String(error));

        throw error;
      }
    });
  }

  async reloadDefinitions() {
    await this.serialized(async () => {
      if (this.phase !== 'running') return;

      let started = Date.now();
      let next: Awaited<ReturnType<typeof dev.selection>>;
      let packages: turbo.TurboPackage[];

      try {
        next = await dev.selection(this.project, this.lastStart.selectors ?? [], false);
        for (let path of dev.syncDockerfiles(this.project, next.manifests))
          this.logs.system('control', `regenerated ${relative(this.project.root, path)}`);
        if (!next.selected.length) throw new Error('no control manifests were selected');
        packages = turbo.plan(next.selected, this.project.root, next.env);
        if (!packages.length) throw new Error('selected manifests contain no run commands');
      } catch (error) {
        this.logs.system(
          'control',
          `definition reload failed, keeping the running configuration: ${error instanceof Error ? error.message : error}`
        );

        return;
      }

      let current = new Map(
        [...this.units.values()]
          .filter(unit => unit.kind === 'service' && unit.package)
          .map(unit => [unit.name, unit.package!])
      );
      let changes = reload.diffPackages(current, packages);
      let routes = reload.routeKey(next.selected);
      let infrastructure = reload.infrastructureKey(next.selected);
      let routesChanged = routes !== this.routes;
      let ports = servicePorts(next.selected);

      if (
        !changes.added.length &&
        !changes.changed.length &&
        !changes.removed.length &&
        !routesChanged &&
        infrastructure === this.infrastructure
      ) {
        this.logs.system('control', 'definitions reloaded, no material changes');

        return;
      }

      this.selected = next.selected;
      this.env = next.env;

      if (routesChanged && this.unregister) {
        try {
          await this.unregister();
          await proxy.ensure(
            this.project,
            this.data,
            proxy.publicPorts(next.manifests, this.project)
          );
          this.unregister = await proxy.register(this.project, this.data, next.selected);
        } catch (error) {
          this.unregister = undefined;
          this.logs.system(
            'control',
            `could not update proxy routes: ${error instanceof Error ? error.message : error}`
          );
        }
      }
      this.routes = routes;
      this.links = linksFor(this.data, next.selected);
      this.devLogin = devLoginFor(this.data, next.selected);

      if (infrastructure !== this.infrastructure) {
        this.logs.system(
          'control',
          'infrastructure, database or prepare definitions changed; restart the workspace to apply them'
        );
        this.infrastructure = infrastructure;
      }

      for (let name of changes.removed) {
        let unit = this.units.get(name)!;
        await this.stopUnit(unit);
        this.units.delete(name);
      }

      for (let pkg of changes.changed) {
        let unit = this.units.get(pkg.name)!;
        let active = this.children.has(unit.name) || unit.timer !== undefined;
        unit.package = pkg;
        unit.ports = ports.get(pkg.name) ?? [];
        unit.attempts = 0;
        this.logs.system(unit.name, 'definition changed');

        if (!active) continue;
        unit.state = 'restarting';
        this.changed();
        await this.stopUnit(unit);
        await this.launchUnit(unit).catch(() => this.scheduleRestart(unit));
      }

      for (let pkg of changes.added) {
        let unit: Unit = {
          name: pkg.name,
          kind: 'service',
          state: 'stopped',
          restarts: 0,
          ports: ports.get(pkg.name) ?? [],
          stopping: false,
          attempts: 0,
          package: pkg
        };
        this.units.set(pkg.name, unit);
        await this.launchUnit(unit).catch(() => this.scheduleRestart(unit));
      }

      for (let unit of this.units.values())
        if (unit.kind === 'service') unit.ports = ports.get(unit.name) ?? unit.ports;

      let names = (items: { name: string }[]) => items.map(item => item.name).join(', ');
      let summary = [
        changes.changed.length && `restarted ${names(changes.changed)}`,
        changes.added.length && `started ${names(changes.added)}`,
        changes.removed.length && `stopped ${changes.removed.join(', ')}`
      ].filter(Boolean);
      this.logs.system(
        'control',
        `definitions reloaded in ${Date.now() - started}ms${summary.length ? `: ${summary.join('; ')}` : ''}`
      );
      this.changed();
    });
  }

  async restartUnit(name: string) {
    let unit = this.units.get(name);
    if (!unit) throw new Error(`unknown unit ${JSON.stringify(name)}`);
    if (
      !['preparing', 'infra', 'starting', 'running', 'stopped', 'failed'].includes(this.phase)
    )
      throw new Error(`workspace ${this.id} is ${this.phase}`);

    let restart = async () => {
      this.logs.system(name, 'restart requested');

      if (unit.kind === 'service') {
        unit.state = 'restarting';
        this.changed();
        await this.stopUnit(unit);
        unit.attempts = 0;
        await this.launchUnit(unit);

        return;
      }

      unit.state = 'restarting';
      this.changed();
      await this.within(name, () =>
        commands.run(
          'docker',
          [...docker.composePrefix(unit.compose!), 'restart', name],
          this.project.root,
          this.env
        )
      );
      unit.restarts++;
      unit.state = 'healthy';
      this.changed();
    };

    if (this.startup && unit.kind === 'service') await restart();
    else await this.serialized(restart);
  }

  async stopServiceUnit(name: string) {
    let unit = this.units.get(name);
    if (!unit || unit.kind !== 'service') throw new Error(`unknown service ${name}`);
    await this.stopUnit(unit);
    this.changed();
  }

  async startServiceUnit(name: string) {
    let unit = this.units.get(name);
    if (!unit || unit.kind !== 'service') throw new Error(`unknown service ${name}`);
    if (this.children.has(name)) throw new Error(`${name} is already running`);
    await this.launchUnit(unit);
  }

  runJob(kind: JobKind, selectors: string[] = []) {
    let job: JobInfo = {
      id: ++this.jobCounter,
      kind,
      state: 'running',
      startedAt: Date.now()
    };
    this.jobs = [job, ...this.jobs].slice(0, maxJobs);
    this.changed();
    this.logs.system('jobs', `▸ ${kind} started`);

    let work = async () => {
      let selection = selectors.length ? selectors : (this.lastStart.selectors ?? []);
      if (kind === 'prepare') {
        let { selected, env } = await dev.selection(this.project, selection);
        await dev.prepareSelected(this.project, selected, env, false);
      } else await dev.runDatabaseTask(this.project, selection, kind.slice(3) as 'push');
    };

    this.serialized(() => this.within('jobs', work)).then(
      () => {
        job.state = 'done';
        job.endedAt = Date.now();
        this.logs.system('jobs', `✓ ${kind} done in ${seconds(job)}s`);
        this.changed();
      },
      error => {
        job.state = 'failed';
        job.endedAt = Date.now();
        job.error = error instanceof Error ? error.message : String(error);
        this.logs.system('jobs', `✖ ${kind} failed: ${job.error}`);
        this.changed();
      }
    );

    return job;
  }

  shellContext(unitName?: string) {
    let unit = unitName ? this.units.get(unitName) : undefined;
    if (unit?.package) return { cwd: unit.package.cwd, env: unit.package.environment };

    return { cwd: this.project.root, env: environment.rootEnvironment(this.project) };
  }

  async shutdown() {
    if (!['idle', 'stopped', 'failed'].includes(this.phase)) await this.stop();
  }
}

let seconds = (job: JobInfo) =>
  (((job.endedAt ?? Date.now()) - job.startedAt) / 1000).toFixed(1);

export let servicePorts = (selected: LoadedManifest[]) => {
  let result = new Map<string, number[]>();

  for (let loaded of selected) {
    let packageName = loaded.manifest.package?.name ?? 'root';
    let ports = [
      ...new Set(
        Object.values(loaded.manifest.endpoints).map(
          endpoint => endpoint.bind_port ?? endpoint.port
        )
      )
    ];

    for (let run of Object.keys(loaded.manifest.run))
      result.set(turbo.turboPackageName(packageName, run), ports);
  }

  return result;
};

export let linksFor = (data: WorkspaceMetadata, selected: LoadedManifest[]): LinkInfo[] => {
  let links: LinkInfo[] = [];

  for (let loaded of selected)
    for (let endpoint of Object.values(loaded.manifest.endpoints))
      if (endpoint.link)
        links.push({
          label: endpoint.link.label,
          group: endpoint.link.group ?? 'app',
          menu: endpoint.link.menu,
          url: `http://${data.hostname}:${endpoint.port}${endpoint.link.path ?? ''}`
        });

  if (
    selected.some(item => item.manifest.resources.some(resource => resource.type === 'mail'))
  )
    links.push({
      label: 'Mailpit',
      group: 'tool',
      url: `http://${data.hostname}:${proxy.mailPort}`
    });

  return links;
};

export let devLoginFor = (data: WorkspaceMetadata, selected: LoadedManifest[]) => {
  for (let loaded of selected)
    for (let endpoint of Object.values(loaded.manifest.endpoints))
      if (endpoint.dev_login)
        return `http://${data.hostname}:${endpoint.port}${endpoint.dev_login.path}`;
};
