import { detect } from '../root';
import * as client from './client';
import {
  duration,
  logLine,
  paint,
  stateColor,
  stateGlyph,
  table,
  workspaceState
} from './format';
import { openUrl } from './open';
import { connect } from 'node:net';
import { delay } from '../process';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { paths, uiPort } from './home';
import { jobKinds, type JobKind, type UnitInfo, type WorkspaceInfo } from './types';
import { logFileName, replayLines, type LogLine } from './logs';
import { definitions, hostAlias, parseStackMode, planStack, stackRunId } from '../stack/plan';
import { discover } from '../manifest';

export interface DaemonArgs {
  root: string;
  workspace?: string;
  positional: string[];
  flags: Set<string>;
  values: Record<string, string>;
}

let interactive = () => !!(process.stdin.isTTY && process.stdout.isTTY);
let colored = (args: DaemonArgs) => !!process.stdout.isTTY && !args.flags.has('no-color');

let workspaceId = async (args: DaemonArgs) => {
  if (args.workspace) return args.workspace;

  try {
    return (await client.registerWorkspace(detect(args.root).root)).id;
  } catch (error) {
    let all = await client.api<WorkspaceInfo[]>('/workspaces');
    if (all.length === 1) return all[0]!.id;
    throw error;
  }
};

let path = (id: string, rest = '') => `/workspaces/${encodeURIComponent(id)}${rest}`;

let waitFor = async (id: string, done: (info: WorkspaceInfo) => boolean) => {
  let controller = new AbortController();

  for await (let info of client.stream<WorkspaceInfo>('/events', controller.signal))
    if (info.id === id && done(info)) {
      controller.abort();

      return info;
    }

  throw new Error('lost connection to the daemon');
};

let verbose = (args: DaemonArgs) => args.flags.has('verbose') || !!process.stdout.isTTY;

let probe = (port: number) =>
  new Promise<boolean>(resolve => {
    let socket = connect({ port, host: '127.0.0.1' });
    let done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

let waitReady = async (id: string, args: DaemonArgs) => {
  let timeout = Number(args.values.timeout ?? 300) * 1000;
  let deadline = Date.now() + timeout;
  let announced = '';

  while (true) {
    let info = await client.api<WorkspaceInfo>(path(id));
    if (info.phase === 'failed') throw new Error(info.error ?? 'workspace failed');

    let waiting: string[] = [];
    for (let unit of info.units.filter(item => item.kind === 'service')) {
      let alive = unit.state === 'running' && Date.now() - (unit.startedAt ?? 0) > 2000;
      let listening = alive && (await Promise.all(unit.ports.map(probe))).every(Boolean);
      if (!listening) waiting.push(`${unit.name} (${unit.state})`);
    }

    if (!waiting.length) return info;

    let crashing = info.units.filter(unit => unit.state === 'crashed' && unit.restarts >= 3);
    if (crashing.length)
      throw new Error(
        `${crashing.map(unit => unit.name).join(', ')} keep crashing; see \`control logs <unit> --errors\``
      );

    if (Date.now() > deadline)
      throw new Error(
        `not ready after ${timeout / 1000}s, still waiting for: ${waiting.join(', ')}`
      );

    let summary = `waiting for ${waiting.length} service${waiting.length === 1 ? '' : 's'}: ${waiting.slice(0, 6).join(', ')}${waiting.length > 6 ? ', ...' : ''}`;
    if (summary !== announced && !process.stdout.isTTY) console.log(summary);
    announced = summary;
    await delay(1000);
  }
};

let followProgress = async (
  id: string,
  args: DaemonArgs,
  done: (info: WorkspaceInfo) => boolean
) => {
  let color = colored(args);
  let controller = new AbortController();
  let width = 8;
  let printing = (async () => {
    try {
      for await (let line of client.followLogs(
        id,
        verbose(args) ? ['control', 'infra', 'prepare', 'jobs'] : ['control'],
        0,
        undefined,
        controller.signal
      ))
        console.log(logLine(line as LogLine, width, color));
    } catch {}
  })();

  try {
    return await waitFor(id, done);
  } finally {
    controller.abort();
    await printing;
  }
};

let up = async (args: DaemonArgs, wait = true) => {
  let root = detect(args.root).root;
  await client.ensureDaemon();
  let info = await client.registerWorkspace(root);
  let selectors = args.positional;

  if (!['idle', 'stopped', 'failed'].includes(info.phase)) {
    console.log(`workspace ${info.id} is already ${info.phase}`);

    if (wait && ['infra', 'preparing', 'starting', 'running'].includes(info.phase)) {
      if (info.phase !== 'running')
        await followProgress(info.id, args, item =>
          ['running', 'failed'].includes(item.phase)
        );
      await waitReady(info.id, args);
      console.log(`${info.id} is ready`);
    }
  } else {
    await client.api(path(info.id, '/start'), 'POST', {
      selectors,
      noDocker: args.flags.has('no-docker'),
      noPrepare: args.flags.has('no-prepare'),
      noProxy: args.flags.has('no-proxy')
    });
    if (args.flags.has('detach')) {
      console.log(`starting ${info.id} in the background`);

      return info.id;
    }

    let final = await followProgress(info.id, args, item =>
      ['running', 'failed'].includes(item.phase)
    );
    if (final.phase === 'failed') throw new Error(final.error ?? 'workspace failed to start');
    if (wait) final = await waitReady(final.id, args);
    console.log(`\n${final.id} is ready`);
    for (let link of final.links) console.log(`  ${link.label.padEnd(14)} ${link.url}`);
    console.log(`  ${'Control UI'.padEnd(14)} ${client.uiUrl()}`);
  }

  return info.id;
};

let down = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let ids = args.flags.has('all')
    ? (await client.api<WorkspaceInfo[]>('/workspaces'))
        .filter(item => item.phase !== 'stopped' && item.phase !== 'idle')
        .map(item => item.id)
    : [await workspaceId(args)];

  for (let id of ids) {
    await client.api(path(id, '/stop'), 'POST', { keepInfra: args.flags.has('keep-infra') });
    await waitFor(id, info => ['stopped', 'idle'].includes(info.phase));
    console.log(`stopped ${id}`);
  }
};

let ls = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let all = await client.api<WorkspaceInfo[]>('/workspaces');
  if (args.flags.has('json')) return console.log(JSON.stringify(all, null, 2));
  if (!all.length)
    return console.log('no workspaces registered; run `control up` in a checkout');
  let color = colored(args);

  console.log(
    table([
      ['WORKSPACE', 'KIND', 'BRANCH', 'STATE', 'SERVICES', 'DASHBOARD', 'UP'],
      ...all.map(info => {
        let state = workspaceState(info);
        let link = info.links.find(item => item.group === 'app');

        return [
          info.id,
          info.kind === 'stack'
            ? `stack (${info.stack?.mode === 'production' ? 'prod' : 'dev'})`
            : 'workspace',
          info.branch,
          paint(
            info.phase === 'running'
              ? state.crashed
                ? 31
                : 32
              : info.phase === 'failed'
                ? 31
                : 90,
            info.phase,
            color
          ),
          state.total ? `${state.up}/${state.total}` : '–',
          info.phase === 'running' && link ? link.url : '–',
          info.phase === 'running' ? duration(info.startedAt) : '–'
        ];
      })
    ])
  );
};

let isFailing = (unit: UnitInfo) =>
  ['crashed', 'restarting', 'stopped'].includes(unit.state) || unit.restarts > 0;

let status = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let info = await client.api<WorkspaceInfo>(path(await workspaceId(args)));
  if (args.flags.has('json')) return console.log(JSON.stringify(info, null, 2));
  if (args.flags.has('failing')) info = { ...info, units: info.units.filter(isFailing) };
  let color = colored(args);
  console.log(
    `${info.kind === 'stack' ? 'stack' : 'workspace'} ${info.id} (${info.branch})  ${paint(info.phase === 'running' ? 32 : 33, info.phase, color)}${info.error ? `  ${info.error}` : ''}`
  );
  for (let link of info.links) console.log(`  ${link.label.padEnd(14)} ${link.url}`);
  console.log(`  ${'Control UI'.padEnd(14)} ${client.uiUrl()}`);
  if (info.units.length) console.log(`\n${table(unitRows(info, color))}`);

  if (info.jobs.length) {
    console.log('');
    for (let job of info.jobs.slice(0, 5))
      console.log(
        `job #${job.id} ${job.kind} ${job.state}${job.endedAt ? ` (${((job.endedAt - job.startedAt) / 1000).toFixed(1)}s)` : ''}${job.error ? ` ${job.error}` : ''}`
      );
  }
};

let unitRows = (info: WorkspaceInfo, color: boolean) => {
  let rows = [['UNIT', 'KIND', 'STATE', 'PID', 'RESTARTS', 'PORTS']];

  for (let unit of [...info.units].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  ))
    rows.push([
      unit.name,
      unit.kind,
      paint(stateColor(unit.state), `${stateGlyph(unit.state)} ${unit.state}`, color),
      String(unit.pid ?? '–'),
      String(unit.restarts),
      unit.ports.map(port => `:${port}`).join(' ')
    ]);

  return rows;
};

let restart = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let id = await workspaceId(args);

  if (!args.positional.length) {
    await client.api(path(id, '/restart'), 'POST', { infra: args.flags.has('infra') });
    await waitFor(id, info => info.phase === 'stopping');
    let info = await followProgress(id, args, item =>
      ['running', 'failed'].includes(item.phase)
    );
    if (info.phase === 'running') await waitReady(id, args);
    console.log(
      info.phase === 'running' ? `${id} restarted and ready` : `${id} failed: ${info.error}`
    );

    return;
  }

  for (let unit of args.positional) {
    await client.api(path(id, `/units/${encodeURIComponent(unit)}/restart`), 'POST');
    console.log(`restarted ${unit}`);
  }
};

let logs = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let id = await workspaceId(args);

  if (
    !args.positional.length &&
    interactive() &&
    !args.flags.has('list') &&
    !args.flags.has('follow') &&
    !args.values.tail
  )
    return (await import('./tui')).runTui(id);

  if (args.flags.has('tui')) return (await import('./tui')).runTui(id, args.positional);

  if (args.flags.has('path')) {
    let directory = join(paths().logs, id);
    let units = args.positional.length ? args.positional : undefined;

    if (!units) return console.log(directory);
    for (let unit of units) {
      let file = join(directory, logFileName(unit));
      console.log(existsSync(file) ? file : `${file} (no output yet)`);
    }

    return;
  }

  let color = colored(args);
  let tail = Number(args.values.tail ?? 100);
  let width = 8;
  let matcher = args.values.grep ? new RegExp(args.values.grep, 'i') : undefined;
  let since = args.values.since ? Date.now() - parseDuration(args.values.since) : undefined;
  let filtered = !!(matcher || since !== undefined || args.flags.has('errors'));
  let keep = (line: LogLine) =>
    (since === undefined || line.ts >= since) &&
    (!matcher || matcher.test(line.text)) &&
    (!args.flags.has('errors') || line.stream === 'err' || errorPattern.test(line.text));
  let print = (line: LogLine) =>
    console.log(args.flags.has('json') ? JSON.stringify(line) : logLine(line, width, color));

  if (args.flags.has('follow')) {
    for await (let line of client.followLogs(
      id,
      args.positional,
      filtered ? replayLines : tail
    ))
      if (keep(line)) print(line);

    return;
  }

  let lines = await client.api<LogLine[]>(
    path(id, `/logs?units=${args.positional.join(',')}&tail=${filtered ? replayLines : tail}`)
  );
  for (let line of lines.filter(keep).slice(-tail)) print(line);
};

let errorPattern = /\b(error|exception|fatal|panic|unhandled|traceback)\b/i;

let parseDuration = (text: string) => {
  let match = /^(\d+(?:\.\d+)?)(s|m|h|d)?$/.exec(text.trim());
  if (!match)
    throw new Error(`invalid duration ${JSON.stringify(text)}; use e.g. 30s, 5m, 2h`);

  return (
    Number(match[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] ?? 's']!
  );
};

let tui = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  await (await import('./tui')).runTui(await workspaceId(args), args.positional);
};

let job = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let [kind, ...selectors] = args.positional;
  if (!jobKinds.includes(kind as JobKind))
    throw new Error(`job kind must be one of ${jobKinds.join(', ')}`);

  let id = await workspaceId(args);
  let created = await client.api<{ id: number }>(path(id, '/jobs'), 'POST', {
    kind,
    selectors
  });
  let controller = new AbortController();
  let color = colored(args);
  let printing = (async () => {
    try {
      for await (let line of client.followLogs(id, ['jobs'], 0, undefined, controller.signal))
        console.log(logLine(line, 4, color));
    } catch {}
  })();

  let final = await waitFor(id, info =>
    info.jobs.some(item => item.id === created.id && item.state !== 'running')
  );
  controller.abort();
  await printing;
  let result = final.jobs.find(item => item.id === created.id)!;
  if (result.state === 'failed') throw new Error(result.error ?? `${kind} failed`);
};

let open = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let target = args.positional[0] ?? 'dashboard';
  if (target === 'ui') return openUrl(client.uiUrl());

  let info = await client.api<WorkspaceInfo>(path(await workspaceId(args)));
  let wanted = target.toLowerCase();
  let link =
    info.links.find(item => item.label.toLowerCase() === wanted) ??
    (wanted === 'dashboard' ? info.links.find(item => item.group === 'app') : undefined) ??
    (wanted === 'mail' ? info.links.find(item => item.label === 'Mailpit') : undefined);
  if (!link)
    throw new Error(
      `no link ${JSON.stringify(target)}; try: ${info.links.map(item => item.label).join(', ')}, ui`
    );

  openUrl(link.url);
  console.log(link.url);
};

let startable = ['idle', 'stopped', 'failed', 'stopping'];

let declaresDevLogin = (info: WorkspaceInfo) =>
  discover(info.root, { stackOnly: info.kind === 'stack' }).some(
    loaded =>
      (!info.stack || info.stack.identifier in loaded.manifest.stacks) &&
      Object.values(loaded.manifest.endpoints).some(endpoint => endpoint.dev_login)
  );

let instanceInfo = async (id: string, args: DaemonArgs) => {
  try {
    return await client.api<WorkspaceInfo>(path(id));
  } catch (error) {
    let identifier = args.values.stack;
    if (!identifier) throw error;

    let project = detect(args.root);
    let known = definitions(discover(project.root, { stackOnly: true }), project.kind).map(
      item => item.id
    );
    if (!known.includes(identifier))
      throw new Error(
        `unknown stack ${JSON.stringify(identifier)}${known.length ? `; available: ${known.join(', ')}` : ''}`
      );

    return client.api<WorkspaceInfo>('/stacks', 'POST', {
      root: project.root,
      identifier,
      mode: 'development',
      name: identifier
    });
  }
};

let startInstance = async (info: WorkspaceInfo) => {
  if (info.phase === 'stopping')
    await waitFor(info.id, item => ['idle', 'stopped', 'failed'].includes(item.phase));

  let current = await client.api<WorkspaceInfo>(path(info.id));
  if (!startable.includes(current.phase)) return;

  console.error(`starting ${current.kind} ${current.id}`);
  await client.api(
    path(current.id, '/start'),
    'POST',
    current.kind === 'stack' ? {} : { selectors: [] }
  );
};

let devLoginServing = async (base: string) => {
  let response = await fetch(`${base.replace(/\/$/, '')}/login/redeem`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(2000)
  }).catch(() => undefined);

  return response?.status === 400;
};

let awaitDevLogin = async (id: string, args: DaemonArgs) => {
  let timeout = Number(args.values.timeout ?? 600) * 1000;
  let deadline = Date.now() + timeout;
  let phase: string | undefined;

  while (true) {
    let info = await client.api<WorkspaceInfo>(path(id));
    if (info.phase === 'failed') throw new Error(info.error ?? `${id} failed`);

    if (info.devLogin) {
      if (await devLoginServing(info.devLogin))
        return info as WorkspaceInfo & { devLogin: string };

      let port = Number(new URL(info.devLogin).port);
      let owner = info.units.find(unit => unit.ports.includes(port));
      if (owner?.state === 'crashed' && owner.restarts >= 3)
        throw new Error(
          `${owner.name} keeps crashing; see \`control logs ${owner.name} --errors\``
        );
    }

    if (Date.now() > deadline)
      throw new Error(
        `${id} does not serve the dev login endpoint after ${timeout / 1000}s; it only exists when the service runs from source with NODE_ENV=development`
      );

    if (info.phase != phase)
      console.error(`waiting for the dev login endpoint of ${id} (${info.phase})`);
    phase = info.phase;
    await delay(1000);
  }
};

let devInstance = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let info = await instanceInfo(await workspaceId(args), args);

  if (info.stack?.mode === 'production')
    throw new Error(
      `stack ${info.id} runs in production mode; dev login only exists in development stacks`
    );

  if (!declaresDevLogin(info))
    throw new Error(
      `${info.kind} ${info.id} has no service that declares a dev login endpoint`
    );

  if (startable.includes(info.phase)) {
    if (args.flags.has('no-start'))
      throw new Error(
        `${info.kind} ${info.id} is ${info.phase}; start it with \`control up\``
      );

    await startInstance(info);
  }

  let ready = await awaitDevLogin(info.id, args);

  return { url: ready.devLogin, root: ready.root };
};

let userRows = (users: { items: DevUserRow[] }) =>
  table([
    ['ID', 'EMAIL', 'NAME', 'STATUS', 'CREATED', 'LAST LOGIN'],
    ...users.items.map(user => [
      user.id,
      user.email,
      user.name,
      user.status,
      shortDate(user.created_at),
      user.last_login_at ? shortDate(user.last_login_at) : '-'
    ])
  ]);

interface DevUserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  last_login_at?: string;
}

let shortDate = (value: string) => value.slice(0, 16).replace('T', ' ');

let auth = async (args: DaemonArgs) => {
  let instance = await devInstance(args);
  let devLogin = await import('../dev-login');
  let result = await devLogin.login(instance.url, instance.root, {
    email: args.positional[0]!,
    create: args.flags.has('create'),
    redirect: args.values.redirect
  });

  console.log(result.url);
};

let users = async (args: DaemonArgs, subcommand: string) => {
  let instance = await devInstance(args);
  let devLogin = await import('../dev-login');

  if (subcommand === 'list') {
    let result = await devLogin.listUsers(instance.url, instance.root, {
      search: args.values.search,
      limit: args.values.limit
    });
    if (args.flags.has('json')) return console.log(JSON.stringify(result, null, 2));

    if (!result.items.length) return console.log('no users');

    console.log(userRows(result));
    if (result.total > result.items.length)
      console.log(
        `\nshowing ${result.items.length} of ${result.total} users; narrow with --search or raise --limit`
      );

    return;
  }

  let user = await devLogin.getUser(instance.url, instance.root, args.positional[0]!);
  if (args.flags.has('json')) return console.log(JSON.stringify(user, null, 2));

  console.log(
    table([
      ['ID', user.id],
      ['Email', user.email],
      ['Name', user.name],
      ['Status', user.status],
      ['Created', shortDate(user.created_at)],
      ['Last login', user.last_login_at ? shortDate(user.last_login_at) : '-'],
      ['Last active', user.last_active_at ? shortDate(user.last_active_at) : '-'],
      ...user.emails.map((email, index) => [
        index === 0 ? 'Emails' : '',
        `${email.email}${email.primary ? ' (primary)' : ''}${email.verified ? '' : ' (unverified)'}`
      ])
    ])
  );
};

let shell = async (args: DaemonArgs) => {
  await client.ensureDaemon();
  let id = await workspaceId(args);
  let url = new URL(`ws://localhost:${uiPort()}/ws/terminal`);
  url.searchParams.set('workspace', id);
  if (args.positional[0]) url.searchParams.set('unit', args.positional[0]);

  let socket = new WebSocket(url.toString(), {
    headers: { host: `localhost:${uiPort()}` }
  } as any);
  socket.binaryType = 'arraybuffer';
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('could not open a terminal'));
  });

  let send = (value: unknown) => socket.send(JSON.stringify(value));
  let resize = () =>
    send({ type: 'resize', cols: process.stdout.columns, rows: process.stdout.rows });
  process.stdin.setRawMode?.(true);
  process.stdin.on('data', data => send({ type: 'input', data: data.toString() }));
  process.stdout.on('resize', resize);
  resize();
  socket.onmessage = event =>
    process.stdout.write(
      typeof event.data === 'string' ? event.data : Buffer.from(event.data as ArrayBuffer)
    );
  await new Promise<void>(resolve => (socket.onclose = () => resolve()));
  process.stdin.setRawMode?.(false);
  process.stdin.pause();
};

let stackIdentifier = (args: DaemonArgs) => {
  let identifier = args.positional[0];
  if (!identifier) throw new Error('missing stack identifier');

  return identifier;
};

let stackName = (args: DaemonArgs) => args.values.name ?? stackIdentifier(args);

let stackRegistration = (args: DaemonArgs) => ({
  root: detect(args.root).root,
  identifier: stackIdentifier(args),
  mode: parseStackMode(args.values.env ?? 'development'),
  name: stackName(args)
});

let stack = async (args: DaemonArgs, subcommand: string) => {
  switch (subcommand) {
    case 'ls': {
      await client.ensureDaemon();
      let project = detect(args.root);
      let found = await client.api<
        { id: string; label: string; mode: string; description?: string; running: string[] }[]
      >(`/stacks/definitions?root=${encodeURIComponent(project.root)}`);
      if (args.flags.has('json')) return console.log(JSON.stringify(found, null, 2));
      if (!found.length) return console.log('no stacks are defined in this checkout');

      console.log(
        table([
          ['STACK', 'LABEL', 'RUNNING'],
          ...found.map(item => [item.id, item.label, item.running.join(', ') || '–'])
        ])
      );

      return;
    }
    case 'plan': {
      let project = detect(args.root);
      let plan = planStack(
        project,
        discover(project.root, { stackOnly: true }),
        stackIdentifier(args),
        parseStackMode(args.values.env ?? 'development'),
        { name: args.values.name }
      );
      if (args.flags.has('json'))
        return console.log(
          JSON.stringify(
            { ...plan, selected: plan.selected.map(item => item.manifest.package?.name) },
            null,
            2
          )
        );

      console.log(
        `stack ${plan.definition.id} (${plan.mode}) as ${plan.id}  ${plan.hostname}`
      );
      console.log(
        table([
          ['UNIT', 'PACKAGE', 'RUNS AS', 'PORTS'],
          ...plan.units.map(unit => [
            unit.name,
            unit.package,
            unit.container ? `container ${unit.container.image}` : 'bun process',
            unit.ports.map(port => `:${port}`).join(' ')
          ])
        ])
      );

      return;
    }
    case 'images': {
      let project = detect(args.root);
      let plan = planStack(
        project,
        discover(project.root, { stackOnly: true }),
        stackIdentifier(args),
        'production',
        { name: args.values.name }
      );
      let images = [...plan.init, ...plan.units].flatMap(unit =>
        unit.container?.build
          ? [
              {
                name: hostAlias(unit.package),
                package: unit.package,
                image: unit.container.image,
                context: relative(project.root, unit.container.build.context) || '.',
                dockerfile: relative(project.root, unit.container.build.dockerfile),
                target: unit.container.build.target ?? '',
                args: unit.container.build.args ?? {}
              }
            ]
          : []
      );
      images.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

      if (args.flags.has('json')) return console.log(JSON.stringify(images, null, 2));

      console.log(
        table([
          ['IMAGE', 'PACKAGE', 'DOCKERFILE'],
          ...images.map(item => [item.name, item.package, item.dockerfile])
        ])
      );

      return;
    }
    case 'start': {
      await client.ensureDaemon();
      let info = await client.api<WorkspaceInfo>('/stacks', 'POST', stackRegistration(args));

      if (!['idle', 'stopped', 'failed'].includes(info.phase)) {
        console.log(`stack ${info.id} is already ${info.phase}`);

        return;
      }

      await client.api(path(info.id, '/start'), 'POST', {
        noPrepare: args.flags.has('no-prepare')
      });
      if (args.flags.has('detach'))
        return console.log(`starting ${info.id} in the background`);

      let final = await followStack(info.id, args, item =>
        ['running', 'failed'].includes(item.phase)
      );
      if (final.phase === 'failed') throw new Error(final.error ?? 'stack failed to start');

      console.log(`\n${final.id} is ready`);
      for (let link of final.links) console.log(`  ${link.label.padEnd(14)} ${link.url}`);
      console.log(`  ${'Control UI'.padEnd(14)} ${client.uiUrl()}`);

      return;
    }
    case 'stop': {
      await client.ensureDaemon();
      let id = stackRunId(stackName(args));
      await client.api(path(id, '/stop'), 'POST', { volumes: args.flags.has('volumes') });
      await waitFor(id, info => ['stopped', 'idle'].includes(info.phase));
      console.log(`stopped ${id}`);

      return;
    }
    case 'clean': {
      await client.ensureDaemon();
      let id = stackRunId(stackName(args));
      await client.api(path(id, '/clean'), 'POST', {});
      console.log(`cleaned ${id}`);

      return;
    }
    case 'rm': {
      await client.ensureDaemon();
      let id = stackRunId(stackName(args));
      await client.api(path(id), 'DELETE');
      console.log(`removed ${id}`);

      return;
    }
    case 'restart': {
      await client.ensureDaemon();
      let id = stackRunId(stackName(args));
      await client.api(path(id, '/restart'), 'POST', {});
      await waitFor(id, info => info.phase === 'stopping');
      let info = await followStack(id, args, item =>
        ['running', 'failed'].includes(item.phase)
      );
      console.log(
        info.phase === 'running' ? `${id} restarted and ready` : `${id} failed: ${info.error}`
      );

      return;
    }
  }

  throw new Error(`unknown stack command ${JSON.stringify(subcommand)}`);
};

let followStack = async (
  id: string,
  args: DaemonArgs,
  done: (info: WorkspaceInfo) => boolean
) => {
  let color = colored(args);
  let controller = new AbortController();
  let printing = (async () => {
    try {
      for await (let line of client.followLogs(
        id,
        verbose(args) ? ['control', 'infra', 'build', 'runner'] : ['control'],
        0,
        undefined,
        controller.signal
      ))
        console.log(logLine(line as LogLine, 8, color));
    } catch {}
  })();

  try {
    return await waitFor(id, done);
  } finally {
    controller.abort();
    await printing;
  }
};

let daemon = async (args: DaemonArgs, subcommand: string) => {
  switch (subcommand) {
    case 'run':
      return (await import('./server')).startServer();
    case 'start': {
      let info = await client.ping();
      if (info) return console.log(`daemon already running (pid ${info.pid})`);
      await client.startDaemon();
      console.log(`daemon started: ${client.uiUrl()}`);

      return;
    }
    case 'stop':
      console.log((await client.stopDaemon()) ? 'daemon stopped' : 'daemon is not running');

      return;
    case 'restart':
      await client.stopDaemon();
      await client.startDaemon();
      console.log(`daemon restarted: ${client.uiUrl()}`);

      return;
    case 'status': {
      let info = await client.ping();
      if (!info) return console.log('daemon is not running');
      console.log(
        `daemon running  pid ${info.pid}  up ${duration(info.startedAt)}  ui ${client.uiUrl()}  home ${paths().root}`
      );

      return;
    }
    case 'logs':
      console.log(client.daemonLogPath());

      return;
  }
};

export let dispatch = async (
  command: string,
  subcommand: string | undefined,
  args: DaemonArgs
) => {
  switch (command) {
    case 'up':
      return void (await up(args));
    case 'down':
      return down(args);
    case 'ls':
      return ls(args);
    case 'status':
      return status(args);
    case 'restart':
      return restart(args);
    case 'logs':
      return logs(args);
    case 'tui':
      return tui(args);
    case 'job':
      return job(args);
    case 'open':
      return open(args);
    case 'auth':
      return auth(args);
    case 'user':
      return users(args, subcommand!);
    case 'email': {
      await client.ensureDaemon();
      let info = await client.api<WorkspaceInfo>(path(await workspaceId(args)));
      let mail = info.links.find(link => link.label === 'Mailpit');
      if (!mail) throw new Error(`workspace ${info.id} has no Mailpit inbox`);

      let email = await import('../email');
      return subcommand === 'list'
        ? email.list(mail.url, args.values)
        : email.open(mail.url, args.positional[0]!, args.flags.has('html'));
    }
    case 'sh':
      return shell(args);
    case 'daemon':
      return daemon(args, subcommand!);
    case 'stack':
      return stack(args, subcommand!);
  }
};

export let attach = async (args: DaemonArgs) => {
  let id = await up({ ...args, flags: new Set([...args.flags]) }, false);
  if (interactive()) await (await import('./tui')).runTui(id);
  else console.log(`attached logs: control logs --follow`);
};
