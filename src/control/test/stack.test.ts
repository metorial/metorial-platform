import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import * as manifest from '../src/manifest';
import { renderStackCompose } from '../src/stack/compose';
import { parseStackMode, planStack } from '../src/stack/plan';
import { checkout, packageFixture, writeManifest } from './helpers';

let service = (name: string, extra = '', ports = 4000) =>
  `name='${name}'\n[endpoints.http]\nport=${ports}\nhealth='/ping'\n[dev]\nrun=['dev:start']\n[[ci.images]]\nname='${name}'\ndockerfile='Dockerfile'\n${extra}`;

let fixture = (
  definitions: string,
  packages: Record<string, string>,
  kind: 'oss' | 'enterprise' = 'oss'
) => {
  let project = checkout(kind);
  writeManifest(project.root, definitions);
  for (let [name, toml] of Object.entries(packages))
    packageFixture(project.root, join('src', name), name, toml, {
      'dev:start': 'true',
      'control:db:generate': 'true',
      'control:db:push': 'true'
    });

  return project;
};

let cloud = "[[stack_definitions]]\nid='cloud'\nlabel='Cloud'\n";

describe('stack manifests', () => {
  test('plans development stacks as bun processes and production stacks as containers', () => {
    let project = fixture(`${cloud}[[stack_definitions]]\nid='on-prem'\n`, {
      api: service('api', '[stacks.cloud]\n[stacks.on-prem]\n'),
      worker: service('worker', '[stacks.cloud]\n', 4001)
    });
    let manifests = manifest.discover(project.root);

    let development = planStack(project, manifests, 'cloud', parseStackMode('dev'));
    expect(development.units.map(unit => unit.name)).toEqual(['api', 'worker']);
    expect(development.units.every(unit => unit.process && !unit.container)).toBe(true);

    let production = planStack(project, manifests, 'cloud', parseStackMode('production'));
    expect(production.units.every(unit => unit.container && !unit.process)).toBe(true);
    expect(production.units[0]!.container!.build?.dockerfile).toContain('src/api');

    let onPrem = planStack(project, manifests, 'on-prem', 'development');
    expect(onPrem.units.map(unit => unit.name)).toEqual(['api']);
  });

  test('names runs and rejects unknown stacks', () => {
    let project = fixture(cloud, { api: service('api', '[stacks.cloud]\n') });
    let manifests = manifest.discover(project.root);

    let plan = planStack(project, manifests, 'cloud', 'development', { name: 'second' });
    expect(plan.id).toBe('stack-second');
    expect(plan.composeProject).toBe('control-stack-second');
    expect(() => planStack(project, manifests, 'nope', 'development')).toThrow(
      'unknown stack'
    );
    expect(() =>
      planStack(project, manifests, 'cloud', 'development', { name: 'Bad Name' })
    ).toThrow('invalid stack name');
    expect(() => parseStackMode('staging')).toThrow('invalid stack environment');
  });

  test('ignores membership in stacks the checkout does not declare', () => {
    let project = fixture(cloud, { api: service('api', '[stacks.elsewhere]\n') });

    expect(() => manifest.discover(project.root)).not.toThrow();
  });

  test('requires a production source unless production is disabled', () => {
    let bare = `name='api'\n[endpoints.http]\nport=4000\n[dev]\nrun=['dev:start']\n[stacks.cloud]\n`;

    expect(() => manifest.discover(fixture(cloud, { api: bare }).root)).toThrow(
      'no production image'
    );
    expect(() =>
      manifest.discover(
        fixture(cloud, {
          api: bare.replace('[stacks.cloud]', '[stacks.cloud.production]\ndisabled=true')
        }).root
      )
    ).not.toThrow();
  });

  test('rejects duplicate definitions and endpoint port clashes', () => {
    expect(() =>
      manifest.discover(
        fixture(cloud, {
          api: service('api', "[[stack_definitions]]\nid='cloud'\n[stacks.cloud]\n")
        }).root
      )
    ).toThrow();

    expect(() =>
      manifest.discover(
        fixture(cloud, {
          api: service('api', '[stacks.cloud]\n'),
          worker: service('worker', '[stacks.cloud]\n')
        }).root
      )
    ).toThrow('port 4000 is used by both');
  });

  test('requires stack members to bring along the services they start', () => {
    let project = fixture(cloud, {
      api: service(
        'api',
        "[stacks.cloud]\n[[dependencies]]\nidentifier='worker'\nstart=true\n"
      ),
      worker: service('worker', '', 4001)
    });

    expect(() => manifest.discover(project.root)).toThrow('not a member of stack');
  });
});

describe('stack compose', () => {
  let render = (mode: 'development' | 'production') => {
    let project = fixture(cloud, {
      api: service(
        'api',
        "[stacks.cloud]\n[postgres.main]\npackage='api'\ndatabase='api'\nuser='postgres'\npassword='pw'\nhost='localhost'\nport=35432\n"
      ),
      worker: service('worker', '[stacks.cloud]\n', 4001)
    });
    let plan = planStack(project, manifest.discover(project.root), 'cloud', mode);

    return {
      plan,
      compose: renderStackCompose(plan, {
        runnerImage: 'runner:test',
        planDirectory: '/tmp/stack',
        sourceRoot: project.root
      })
    };
  };

  test('runs every development member inside one app container', () => {
    let { plan, compose } = render('development');

    expect(compose.name).toBe(plan.composeProject);
    expect(Object.keys(compose.services).sort()).toEqual(['app', 'gateway', 'postgres-db2']);
    expect((compose.services.app as any).network_mode).toBe('service:gateway');
    expect((compose.services.gateway as any).networks.stack.aliases).toEqual([
      plan.hostname,
      'api',
      'worker'
    ]);
    expect(compose.networks['control-proxy']).toEqual({
      name: 'control_proxy',
      external: true
    });
  });

  test('runs every production member in its own container beside the gateway', () => {
    let { compose } = render('production');

    expect(Object.keys(compose.services).sort()).toEqual([
      'api',
      'gateway',
      'postgres-db2',
      'worker'
    ]);
    expect((compose.services.api as any).network_mode).toBe('service:gateway');
    expect((compose.services.api as any).build.dockerfile).toContain('Dockerfile');
    expect(compose.services.app).toBeUndefined();
  });
});

describe('edition stacks', () => {
  let onPrem = `[[stack_definitions]]\nid='on-prem'\nedition='on-prem'\n`;
  let member = (name: string, ports: number, extra: string) =>
    `stack_only=true\n${service(name, extra, ports)}`;

  test('keeps stack-only manifests out of the normal discovery', () => {
    let project = fixture(onPrem, {
      api: service('api', '[stacks.on-prem]\n'),
      edition: member('@ee/api', 4001, '[stacks.on-prem]\n')
    });

    let names = (stackOnly: boolean) =>
      manifest
        .discover(project.root, { stackOnly })
        .flatMap(item => (item.manifest.package ? [item.manifest.package.name] : []))
        .sort();

    expect(names(false)).toEqual(['api']);
    expect(names(true)).toEqual(['@ee/api', 'api']);
  });

  test('exports the edition to units and prepare steps', () => {
    let project = fixture(onPrem, { api: service('api', '[stacks.on-prem]\n') });
    let manifests = manifest.discover(project.root);

    for (let mode of ['development', 'production'] as const) {
      let plan = planStack(project, manifests, 'on-prem', mode);

      expect(plan.units[0]!.env.METORIAL_EDITION).toBe('on-prem');
    }

    let plan = planStack(project, manifests, 'on-prem', 'development');
    expect(plan.prepare.every(step => step.env.METORIAL_EDITION === 'on-prem')).toBe(true);
  });

  test('leaves the edition unset for stacks that do not declare one', () => {
    let project = fixture(cloud, { api: service('api', '[stacks.cloud]\n') });
    let plan = planStack(project, manifest.discover(project.root), 'cloud', 'development');

    expect(plan.units[0]!.env.METORIAL_EDITION).toBeUndefined();
  });

  test('restricts members to one checkout kind', () => {
    let project = fixture(
      onPrem,
      {
        api: service('api', "[stacks.on-prem]\nmode='oss'\n"),
        other: service('other', "[stacks.on-prem]\nmode='enterprise'\n", 4001)
      },
      'enterprise'
    );
    let plan = planStack(project, manifest.discover(project.root), 'on-prem', 'development');

    expect(plan.units.map(unit => unit.name)).toEqual(['other']);
  });

  test('runs init members as a prepare step in development and a one-shot container in production', () => {
    let project = fixture(onPrem, {
      api: service('api', '[stacks.on-prem]\n'),
      boot: member(
        'boot',
        4001,
        "[stacks.on-prem]\ninit=true\n[stacks.on-prem.development]\nrun=['start']\n"
      )
    });
    let manifests = manifest.discover(project.root, { stackOnly: true });

    let development = planStack(project, manifests, 'on-prem', 'development');
    expect(development.units.map(unit => unit.name)).toEqual(['api']);
    expect(development.prepare.at(-1)).toMatchObject({
      label: 'Initializing boot',
      cwd: 'src/boot',
      command: ['bun', 'run', 'start']
    });
    expect(development.hosts).toEqual(['api', 'boot']);

    let production = planStack(project, manifests, 'on-prem', 'production');
    expect(production.units.map(unit => unit.name)).toEqual(['api']);
    expect(production.init.map(unit => unit.name)).toEqual(['boot']);

    let compose = renderStackCompose(production, {
      runnerImage: 'runner:test',
      planDirectory: '/tmp/stack',
      sourceRoot: project.root
    });
    expect((compose.services.boot as any).restart).toBe('no');
    expect((compose.services.api as any).restart).toBe('unless-stopped');
  });

  test('orders process units after the members they depend on', () => {
    let project = fixture(onPrem, {
      api: service(
        'api',
        "[stacks.on-prem]\n[[dependencies]]\nidentifier='worker'\nstart=false\n"
      ),
      worker: service('worker', '[stacks.on-prem]\n', 4001)
    });
    let plan = planStack(project, manifest.discover(project.root), 'on-prem', 'development');

    expect(plan.units.find(unit => unit.name === 'api')!.process!.dependsOn).toEqual([
      'worker'
    ]);
  });

  test('mounts declared member volumes in the container', () => {
    let project = fixture(onPrem, {
      api: service(
        'api',
        "[stacks.on-prem]\n[stacks.on-prem.development]\ncontainer=true\n[stacks.on-prem.volumes]\ndata='/app/data'\n"
      )
    });
    let plan = planStack(project, manifest.discover(project.root), 'on-prem', 'development');
    let compose = renderStackCompose(plan, {
      runnerImage: 'runner:test',
      planDirectory: '/tmp/stack',
      sourceRoot: project.root
    });

    expect((compose.services.api as any).volumes).toEqual([
      { type: 'volume', source: 'api-data', target: '/app/data' }
    ]);
    expect(compose.volumes?.['api-data']).toEqual({});
  });

  test('runs a development member as a container when asked to', () => {
    let project = fixture(onPrem, {
      api: service('api', '[stacks.on-prem]\n[stacks.on-prem.development]\ncontainer=true\n')
    });
    let plan = planStack(project, manifest.discover(project.root), 'on-prem', 'development');

    expect(plan.units[0]!.container).toBeDefined();
    expect(plan.units[0]!.process).toBeUndefined();
  });
});
