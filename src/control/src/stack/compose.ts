import { escapeCompose } from '../e2e';
import { sortedEntries } from '../files';
import * as infrastructure from '../infrastructure';
import { mailProxyAlias } from '../proxy';
import type { StackPlan, StackUnit } from './plan';

export let runnerPort = 47474;

export interface ComposeOptions {
  runnerImage: string;
  planDirectory: string;
  sourceRoot: string;
  syncSeconds?: number;
}

let environmentOf = (unit: StackUnit) =>
  Object.fromEntries(
    sortedEntries(unit.env).map(([key, value]) => [key, escapeCompose(value)])
  );

export let containerUnits = (plan: StackPlan) => plan.units.filter(unit => unit.container);

export let initUnits = (plan: StackPlan) => plan.init.filter(unit => unit.container);

export let processUnits = (plan: StackPlan) => plan.units.filter(unit => unit.process);

let reserved = (plan: StackPlan, services: Record<string, unknown>) => {
  for (let unit of [...plan.units, ...plan.init])
    if (unit.container && Object.hasOwn(services, unit.name))
      throw new Error(
        `stack unit ${unit.name} collides with the ${unit.name} compose service`
      );
};

export let renderStackCompose = (plan: StackPlan, options: ComposeOptions) => {
  let services: Record<string, Record<string, unknown>> = infrastructure.serviceDefinitions(
    plan.requirements,
    {
      network: 'stack',
      mail_proxy_alias: mailProxyAlias(plan.data),
      restart: true
    }
  );
  let infra = Object.keys(services);
  reserved(plan, { ...services, gateway: true, app: true });

  services.gateway = {
    image: options.runnerImage,
    command: ['gateway'],
    init: true,
    restart: 'unless-stopped',
    networks: {
      stack: { aliases: [plan.hostname, ...plan.hosts] },
      'control-proxy': { aliases: [`metorial-ws-${plan.id}`] }
    },
    sysctls: { 'net.ipv4.ip_local_port_range': '61000 65535' },
    extra_hosts: ['host.docker.internal:host-gateway'],
    ...(processUnits(plan).length ? { ports: [`127.0.0.1::${runnerPort}`] } : {}),
    ...(infra.length
      ? {
          depends_on: Object.fromEntries(
            infra.map(name => [name, { condition: 'service_healthy' }])
          )
        }
      : {}),
    healthcheck: {
      test: ['CMD-SHELL', 'test -f /tmp/control-e2e-gateway-ready'],
      interval: '1s',
      timeout: '3s',
      retries: 60
    },
    labels: { 'com.metorial.control.role': 'gateway' }
  };

  for (let unit of [...containerUnits(plan), ...initUnits(plan)]) {
    let container = unit.container!;
    let once = plan.init.includes(unit);
    services[unit.name] = {
      image: container.image,
      ...(container.build
        ? {
            build: {
              context: escapeCompose(container.build.context),
              dockerfile: escapeCompose(container.build.dockerfile),
              ...(container.build.target ? { target: container.build.target } : {}),
              ...(Object.keys(container.build.args).length
                ? { args: container.build.args }
                : {})
            }
          }
        : {}),
      ...(container.command
        ? { command: ['sh', '-c', escapeCompose(container.command)] }
        : {}),
      platform: 'linux/amd64',
      network_mode: 'service:gateway',
      init: true,
      restart: once ? 'no' : 'unless-stopped',
      depends_on: { gateway: { condition: 'service_healthy' } },
      environment: environmentOf(unit),
      ...(Object.keys(container.volumes ?? {}).length
        ? {
            volumes: sortedEntries(container.volumes!).map(([name, target]) => ({
              type: 'volume',
              source: `${unit.name}-${name}`,
              target
            }))
          }
        : {}),
      labels: {
        'com.metorial.control.role': once ? 'init' : 'unit',
        'com.metorial.control.unit': unit.name
      }
    };
  }

  let volumes: Record<string, unknown> = Object.fromEntries(
    infrastructure.volumeNames(plan.requirements).map(name => [name, {}])
  );

  for (let unit of containerUnits(plan))
    for (let name of Object.keys(unit.container!.volumes ?? {}))
      volumes[`${unit.name}-${name}`] = {};

  if (processUnits(plan).length) {
    volumes.workspace = {};
    services.app = {
      image: options.runnerImage,
      command: ['bun', '/stack/runner.ts', '/stack/plan.json'],
      network_mode: 'service:gateway',
      init: true,
      restart: 'unless-stopped',
      working_dir: '/workspace',
      depends_on: { gateway: { condition: 'service_healthy' } },
      volumes: [
        { type: 'bind', source: escapeCompose(options.planDirectory), target: '/stack' },
        {
          type: 'bind',
          source: escapeCompose(options.sourceRoot),
          target: '/source',
          read_only: true
        },
        { type: 'volume', source: 'workspace', target: '/workspace' }
      ],
      environment: {
        CONTROL_STACK_SYNC_SECONDS: String(options.syncSeconds ?? 3),
        CONTROL_STACK_PORT: String(runnerPort)
      },
      labels: { 'com.metorial.control.role': 'runner' }
    };
  }

  return {
    name: plan.composeProject,
    services,
    networks: {
      stack: {},
      'control-proxy': { name: 'control_proxy', external: true }
    },
    ...(Object.keys(volumes).length ? { volumes } : {})
  };
};
