import { spawn as spawnChild, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import * as commands from '../process';
import * as docker from '../docker';
import * as environment from '../environment';
import * as manifest from '../manifest';
import * as proxy from '../proxy';
import { Compose, ensureRunnerImage } from '../e2e';
import { writeJson } from '../files';
import {
  containerUnits,
  initUnits,
  processUnits,
  renderStackCompose,
  runnerPort
} from '../stack/compose';
import { composeProjectName, planStack, type StackMode, type StackPlan } from '../stack/plan';
import type { Environment, ProjectRoot, WorkspaceMetadata } from '../types';
import { containerCacheEnvironment } from './cache';
import { LogStore } from './logs';
import { devLoginFor, linksFor } from './runtime';
import type { Runtime } from './runtime-types';
import type {
  JobInfo,
  LinkInfo,
  Phase,
  StackInfo,
  StartOptions,
  UnitInfo,
  UnitState,
  WorkspaceInfo
} from './types';

interface RunnerState {
  phase: 'preparing' | 'starting' | 'ready' | 'failed';
  failure?: string;
  units: {
    name: string;
    status: 'pending' | 'starting' | 'running' | 'stopped' | 'crashed';
    pid?: number;
    restarts: number;
    exit_code?: number | null;
  }[];
}

interface ComposeContainer {
  Service: string;
  State: string;
  Health?: string;
  ExitCode?: number;
}

let pollInterval = 2_000;
let runnerTimeout = 15_000;
let runnerFailureLimit = 5;
let prepareTimeout = 30 * 60_000;
let containerTimeout = 3 * 60_000;

export let stackAssets = (project: ProjectRoot) => join(project.oss, 'scripts/dev-tools');

export class StackRuntime implements Runtime {
  phase: Phase = 'idle';
  error?: string;
  startedAt?: number;

  private plan?: StackPlan;
  private compose?: Compose;
  private infra: string[] = [];
  private runnerUrl?: string;
  private runner?: RunnerState;
  private runnerFailures = 0;
  private containers: ComposeContainer[] = [];
  private stoppedUnits = new Set<string>();
  private links: LinkInfo[] = [];
  private devLogin?: string;
  private unregister?: () => Promise<void>;
  private follower?: ChildProcess;
  private poller?: ReturnType<typeof setInterval>;
  private polling = false;
  private lastStart: StartOptions = {};
  private queue: Promise<unknown> = Promise.resolve();
  private startup?: AbortController;

  constructor(
    readonly project: ProjectRoot,
    readonly spec: StackInfo & { id: string; hostname: string },
    readonly logs: LogStore,
    private changed: () => void,
    public data: WorkspaceMetadata
  ) {}

  get id() {
    return this.spec.id;
  }

  get startable() {
    return ['idle', 'stopped', 'failed'].includes(this.phase);
  }

  info(): WorkspaceInfo {
    return {
      id: this.id,
      kind: 'stack',
      stack: { identifier: this.spec.identifier, mode: this.spec.mode, name: this.spec.name },
      root: this.project.root,
      branch: this.data.branch,
      hostname: this.data.hostname,
      phase: this.phase,
      error: this.error,
      startedAt: this.startedAt,
      units: this.units(),
      jobs: [],
      links: this.links,
      devLogin: this.devLogin
    };
  }

  private units(): UnitInfo[] {
    if (!this.plan) return [];

    let result: UnitInfo[] = this.infra.map(name => ({
      name,
      kind: 'infra',
      state: this.containerState(name) ?? 'stopped',
      restarts: 0,
      ports: []
    }));

    for (let unit of this.plan.units) {
      let process = this.runner?.units.find(item => item.name === unit.name);
      let container = this.containers.find(item => item.Service === unit.name);

      result.push({
        name: unit.name,
        kind: 'service',
        state: unit.process
          ? process
            ? runnerUnitState(process.status)
            : 'stopped'
          : (this.containerState(unit.name) ?? 'stopped'),
        pid: process?.pid,
        restarts: process?.restarts ?? 0,
        exitCode: process ? process.exit_code : container?.ExitCode,
        startedAt: this.startedAt,
        ports: unit.ports
      });
    }

    return result;
  }

  private containerState(name: string): UnitState | undefined {
    let container = this.containers.find(item => item.Service === name);
    if (!container) return undefined;

    if (container.State === 'running')
      return container.Health === 'unhealthy'
        ? 'crashed'
        : container.Health === 'starting'
          ? 'starting'
          : 'healthy';
    if (container.State === 'restarting') return 'restarting';
    if (container.State === 'exited' || container.State === 'dead')
      return container.ExitCode ? 'crashed' : 'stopped';

    return 'starting';
  }

  private set(phase: Phase, error?: string) {
    this.phase = phase;
    this.error = error;
    this.logs.system('control', `stack ${phase}${error ? `: ${error}` : ''}`);
    this.changed();
  }

  private within<T>(unit: string, work: () => Promise<T>) {
    return commands.outputSink.run(
      (text, stream) => this.logs.append(unit, text, stream),
      work
    );
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    let result = this.queue.then(work, work);
    this.queue = result.catch(() => {});

    return result;
  }

  async start(options: StartOptions = {}) {
    if (!this.startable) throw new Error(`stack ${this.id} is ${this.phase}`);
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

  private directory() {
    return join(this.project.root, '.control/stacks', this.spec.name);
  }

  private async doStart(options: StartOptions) {
    this.startedAt = Date.now();
    this.runner = undefined;
    this.containers = [];
    this.stoppedUnits.clear();

    try {
      this.set('preparing');
      let manifests = manifest.discover(this.project.root, { stackOnly: true });
      let plan = planStack(
        this.project,
        manifests,
        this.spec.identifier,
        this.spec.mode as StackMode,
        {
          name: this.spec.name,
          noPrepare: options.noPrepare,
          environment: containerCacheEnvironment()
        }
      );
      this.plan = plan;
      this.data = plan.data;
      this.links = linksFor(plan.data, plan.selected);
      this.devLogin =
        plan.mode === 'development' ? devLoginFor(plan.data, plan.selected) : undefined;

      let assets = join(stackAssets(this.project), 'e2e');
      let directory = this.directory();
      mkdirSync(directory, { recursive: true });
      copyFileSync(
        join(stackAssets(this.project), 'stack/runner.ts'),
        join(directory, 'runner.ts')
      );
      writeJson(join(directory, 'plan.json'), {
        units: processUnits(plan).map(unit => ({
          name: unit.name,
          cwd: unit.process!.cwd,
          command: unit.process!.command,
          dependsOn: unit.process!.dependsOn,
          env: unit.env,
          health: unit.health
        })),
        files: plan.files,
        prepare: plan.prepare.map(step => ({ ...step, cwd: step.cwd })),
        healthTimeoutSeconds: 300
      });

      let image = await this.within('control', () =>
        ensureRunnerImage(this.project.root, assets)
      );
      commands.checkInterrupted();
      let rendered = renderStackCompose(plan, {
        runnerImage: image,
        planDirectory: directory,
        sourceRoot: this.project.root
      });
      this.compose = new Compose(this.project.root, join(directory, 'compose.json'));
      writeJson(this.compose.file, rendered);
      this.infra = Object.keys(rendered.services).filter(
        name =>
          name !== 'gateway' &&
          name !== 'app' &&
          ![...plan.units, ...plan.init].some(u => u.name === name)
      );

      let builds = [...containerUnits(plan), ...initUnits(plan)]
        .filter(unit => unit.container!.build)
        .map(unit => unit.name);
      if (builds.length) {
        this.set('preparing');
        await this.within('build', () => this.compose!.run(['build', ...builds]));
      }

      this.set('infra');
      await this.within('infra', () =>
        this.compose!.run([
          'up',
          '--detach',
          '--wait',
          '--wait-timeout',
          '180',
          ...this.infra,
          'gateway'
        ])
      );
      await this.within('infra', () => this.createDatabases(plan));

      await this.within('control', async () => {
        await proxy.ensure(
          this.project,
          plan.data,
          proxy.publicPorts(plan.selected, this.project)
        );
        this.unregister = await proxy.register(this.project, plan.data, plan.selected);
      });

      for (let unit of initUnits(plan))
        await this.within(unit.name, () =>
          this.compose!.run(['run', '--rm', '-T', '--no-deps', unit.name])
        );

      commands.checkInterrupted();
      this.follow();
      this.set('starting');
      let services = [
        ...containerUnits(plan).map(unit => unit.name),
        ...(processUnits(plan).length ? ['app'] : [])
      ];
      await this.within('control', () =>
        this.compose!.run(['up', '--detach', '--no-deps', ...services])
      );

      for (let unit of containerUnits(plan))
        if (this.stoppedUnits.has(unit.name))
          await this.compose.run(['stop', '--timeout', '0', unit.name]);

      this.runnerUrl = processUnits(plan).length ? await this.runnerAddress() : undefined;
      this.startPolling();
      await this.waitReady(plan);
      commands.checkInterrupted();
      this.set('running');
    } catch (error) {
      if (error instanceof commands.Interrupted) return;
      let message = error instanceof Error ? error.message : String(error);
      this.logs.system('control', `start failed: ${message}`);
      await this.teardown(false).catch(() => {});
      this.set('failed', message);
    }
  }

  private async createDatabases(plan: StackPlan) {
    let compose = this.compose!;

    for (let db of plan.postgres) {
      let configured = { ...db, compose: compose.file, service: 'postgres-db2' };
      await docker.waitPostgres(compose.root, compose.root, configured, {});
      await docker.createPostgres(compose.root, compose.root, configured, {});
    }

    for (let db of plan.mongo) {
      let configured = { ...db, compose: compose.file, service: 'mongodb' };
      await docker.retry('MongoDB', () =>
        docker.mongoExec(
          compose.root,
          compose.root,
          configured,
          'db.runCommand({ ping: 1 })',
          {}
        )
      );
      await docker.mongoExec(
        compose.root,
        compose.root,
        configured,
        "if (db.getCollectionNames().length === 0) db.createCollection('__control')",
        {}
      );
    }
  }

  private async runnerAddress() {
    let output = await commands.output(
      'docker',
      [...this.compose!.args(['port', 'gateway', String(runnerPort)])],
      this.project.root
    );
    let port = output.split(':').pop()!.trim();

    return `http://127.0.0.1:${port}`;
  }

  private follow() {
    this.follower?.kill();
    let compose = this.compose!;
    let child = spawnChild(
      'docker',
      compose.args(['logs', '--follow', '--no-color', '--since', '0s']),
      { cwd: this.project.root, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    this.follower = child;

    let pending = '';
    let stream = (chunk: Buffer, kind: 'out' | 'err') => {
      let lines = (pending + chunk.toString()).split('\n');
      pending = lines.pop() ?? '';
      for (let line of lines) this.route(line, kind);
    };
    child.stdout?.on('data', chunk => stream(chunk, 'out'));
    child.stderr?.on('data', chunk => stream(chunk, 'err'));
    child.on('error', () => {});
  }

  private route(line: string, stream: 'out' | 'err') {
    let routed = routeComposeLine(line);
    if (routed) this.logs.append(routed.unit, routed.text + '\n', stream);
  }

  private startPolling() {
    if (this.poller) clearInterval(this.poller);
    this.poller = setInterval(() => void this.refresh(), pollInterval);
    void this.refresh();
  }

  private async refresh() {
    if (this.polling || !this.compose) return;
    this.polling = true;

    try {
      let output = await commands.output(
        'docker',
        this.compose.args(['ps', '--all', '--format', 'json']),
        this.project.root
      );
      this.containers = output
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as ComposeContainer);
    } catch {}

    if (this.runnerUrl) {
      try {
        this.runner = (await fetch(`${this.runnerUrl}/state`, {
          signal: AbortSignal.any([
            AbortSignal.timeout(runnerTimeout),
            ...(this.startup ? [this.startup.signal] : [])
          ])
        }).then(response => response.json())) as RunnerState;
        this.runnerFailures = 0;
      } catch {
        this.runnerFailures++;
        if (this.runnerFailures >= runnerFailureLimit) this.runner = undefined;
      }
    }

    this.polling = false;
    this.changed();
  }

  private async waitReady(plan: StackPlan) {
    let deadline =
      Date.now() + (processUnits(plan).length ? prepareTimeout : containerTimeout);

    while (true) {
      await commands.delay(pollInterval);
      await this.refresh();

      let failed = this.units().find(
        unit =>
          unit.state === 'crashed' &&
          unit.kind === 'service' &&
          !this.stoppedUnits.has(unit.name)
      );
      if (this.runner?.phase === 'failed')
        throw new Error(this.runner.failure ?? 'the dev runner failed');
      if (failed && !this.runner) throw new Error(`${failed.name} exited`);

      let containers = containerUnits(plan).every(
        unit =>
          this.stoppedUnits.has(unit.name) ||
          ['healthy', 'running'].includes(this.containerState(unit.name) ?? '')
      );
      let processes = !processUnits(plan).length || this.runner?.phase === 'ready';
      if (containers && processes) return;

      if (Date.now() >= deadline) throw new Error('the stack did not become ready in time');
    }
  }

  private async teardown(removeVolumes: boolean, force = false) {
    if (this.poller) clearInterval(this.poller);
    this.poller = undefined;

    await this.unregister?.().catch(() => {});
    this.unregister = undefined;

    if (this.compose)
      await this.within('control', () =>
        this.compose!.run([
          'down',
          '--remove-orphans',
          '--timeout',
          force ? '0' : '10',
          ...(removeVolumes ? ['--volumes'] : [])
        ])
      ).catch(() => {});

    this.follower?.kill();
    this.follower = undefined;
    this.runner = undefined;
    this.runnerUrl = undefined;
    this.containers = [];
  }

  async stop(options: { keepInfra?: boolean; volumes?: boolean } = {}) {
    if (['idle', 'stopped', 'stopping'].includes(this.phase)) return;
    let force = !!this.startup;
    this.startup?.abort();
    this.set('stopping');

    await this.serialized(async () => {
      this.set('stopping');
      await this.teardown(!!options.volumes, force);
      this.startedAt = undefined;
      this.set('stopped');
      if (options.volumes) rmSync(this.directory(), { recursive: true, force: true });
    });
  }

  async clean() {
    await this.stop();

    await this.serialized(async () => {
      let project = composeProjectName(this.spec.name);
      let volumes = (
        await commands.output(
          'docker',
          [
            'volume',
            'ls',
            '--quiet',
            '--filter',
            `label=com.docker.compose.project=${project}`
          ],
          this.project.root
        )
      )
        .split('\n')
        .filter(name => name && name !== `${project}_workspace`);

      if (volumes.length)
        await commands.runQuiet('docker', ['volume', 'rm', ...volumes], this.project.root);
    });
  }

  async restartWorkspace() {
    let previous = this.lastStart;
    await this.stop();
    await this.start(previous);
  }

  private find(name: string) {
    let unit = this.units().find(item => item.name === name);
    if (!unit) throw new Error(`unknown unit ${JSON.stringify(name)}`);

    return unit;
  }

  private async control(name: string, action: 'start' | 'stop' | 'restart') {
    let unit = this.find(name);
    let process = this.plan?.units.find(item => item.name === name)?.process;

    if (process && !this.runnerUrl) throw new Error(`the dev runner is not available yet`);

    if (process && this.runnerUrl) {
      this.logs.system(name, `${action} requested`);
      let response = await fetch(
        `${this.runnerUrl}/units/${encodeURIComponent(name)}/${action}`,
        {
          method: 'POST'
        }
      );
      if (!response.ok) throw new Error(`runner refused to ${action} ${name}`);
    } else {
      this.logs.system(unit.name, `${action} requested`);
      let timeout = action !== 'start' && this.phase === 'starting' ? ['--timeout', '0'] : [];
      await this.within(name, () => this.compose!.run([action, ...timeout, name]));
    }

    if (action === 'stop') this.stoppedUnits.add(name);
    else this.stoppedUnits.delete(name);

    await this.refresh();
  }

  async restartUnit(name: string) {
    if (!['starting', 'running', 'failed'].includes(this.phase))
      throw new Error(`stack ${this.id} is ${this.phase}`);
    await this.control(name, 'restart');
  }

  async stopServiceUnit(name: string) {
    await this.control(name, 'stop');
  }

  async startServiceUnit(name: string) {
    await this.control(name, 'start');
  }

  runJob(): JobInfo {
    throw new Error('database jobs are not available for stacks');
  }

  shellContext(): { cwd: string; env: Environment } {
    return { cwd: this.project.root, env: environment.rootEnvironment(this.project) };
  }

  async shutdown() {
    if (!['idle', 'stopped', 'failed'].includes(this.phase)) await this.stop();
  }
}

export let routeComposeLine = (line: string): { unit: string; text: string } | undefined => {
  let match = line.match(/^(\S+?)\s+\| (.*)$/);
  if (!match) return;

  let [, container, text] = match as unknown as [string, string, string];
  let service = container.replace(/-\d+$/, '');
  if (service !== 'app') return { unit: service, text };

  let prefix = text.match(/^\[([^\]]+)\] (.*)$/);
  if (!prefix) return { unit: 'runner', text };

  return { unit: prefix[1] === 'stack' ? 'runner' : prefix[1]!, text: prefix[2]! };
};

let runnerUnitState = (status: RunnerState['units'][number]['status']): UnitState => {
  switch (status) {
    case 'running':
      return 'running';
    case 'starting':
      return 'starting';
    case 'crashed':
      return 'crashed';
    default:
      return 'stopped';
  }
};
