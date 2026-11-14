import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { discover } from '../src/manifest';
import { allocatePortValues } from '../src/workspace';
import { defaultPorts, portKey } from '../src/environment';
import * as docker from '../src/docker';
import * as commands from '../src/process';
import { packageFixture, temporary } from './helpers';

test.skipIf(process.env.CONTROL_DOCKER_TESTS !== '1')(
  'provisions every infrastructure service and databases through real Docker Compose',
  async () => {
    let root = temporary();
    packageFixture(
      root,
      '',
      'db',
      "name='db'\n[dev.db.postgres]\nname='control_parity'\nengine='postgres'\nenv='PG_URL'\npackage='db'\n[dev.db.mongo]\nname='control_parity'\nengine='mongodb'\nenv='MONGO_URL'\npackage='db'\n[[resources]]\ntype='redis'\n[[resources]]\ntype='nats'\n[[resources]]\ntype='etcd'",
      { 'control:db:generate': 'true', 'control:db:push': 'true' }
    );

    let allocated = await allocatePortValues(new Set(Object.values(defaultPorts)), 6);
    let env = Object.fromEntries(
      Object.keys(defaultPorts).map((name, index) => [portKey(name), String(allocated[index])])
    );
    let compose = join(root, '.control/dev/services.docker-compose.yml');

    try {
      await docker.start(root, discover(root), env);

      for (let port of allocated.filter((_, index) => index !== 5))
        expect(await docker.portReachable(port)).toBe(true);

      let pg = await commands.output(
        'docker',
        [
          ...docker.composePrefix(compose),
          'exec',
          '-T',
          'postgres-db2',
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-At',
          '-c',
          "SELECT datname FROM pg_database WHERE datname='control_parity'"
        ],
        root
      );

      expect(pg).toBe('control_parity');

      let mongo = await commands.output(
        'docker',
        [
          ...docker.composePrefix(compose),
          'exec',
          '-T',
          'mongodb',
          'mongosh',
          'mongodb://mongo:mongo@127.0.0.1:27017/control_parity?authSource=admin',
          '--quiet',
          '--eval',
          "db.getCollectionNames().includes('__control')"
        ],
        root
      );

      expect(mongo).toBe('true');

      await docker.start(root, discover(root), env);
    } finally {
      await commands.runQuiet(
        'docker',
        [...docker.composePrefix(compose), 'down', '--volumes', '--remove-orphans'],
        root
      );
    }
  },
  120000
);
