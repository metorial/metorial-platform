import { check, probes, type CheckDefinition } from '@lowerdeck/doctor';
import { readFile } from 'node:fs/promises';
import { attempt } from '../resolutions';

let probeDatabase = 'metorial_doctor';
let probeCollection = 'transaction_probe';

export interface MongoClientLike {
  db: (name: string) => {
    command: (command: Record<string, unknown>) => Promise<any>;
    collection: (name: string) => {
      updateOne: (filter: any, update: any, options?: any) => Promise<unknown>;
    };
  };
  startSession: () => {
    withTransaction: (run: () => Promise<void>) => Promise<unknown>;
    endSession: () => Promise<void>;
  };
}

let parseVersion = (version: string) => version.split('.').map(part => Number(part) || 0);

export let mongoChecks = (options: {
  client: MongoClientLike | (() => Promise<MongoClientLike>);
  documentDb?: boolean;
  tlsCaFile?: string;
}): CheckDefinition[] => {
  let resolveClient = async () =>
    typeof options.client == 'function' ? options.client() : options.client;
  let target = 'mongodb/default';
  let base = { category: 'database' as const, target, dependsOn: ['mongodb.connect'] };
  let admin = async () => (await resolveClient()).db('admin');
  let connect = probes.mongo({ ping: async () => (await admin()).command({ ping: 1 }) });

  return [
    check({
      id: 'mongodb.connect',
      title: 'MongoDB is reachable',
      category: 'database',
      severity: 'critical',
      target,
      run: ctx => attempt(ctx, 'mongodb', () => connect(ctx))
    }),

    check({
      ...base,
      id: 'mongodb.topology',
      title: 'MongoDB is a replica set',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'mongodb', async () => {
          let hello = await (await admin()).command({ hello: 1 });
          if (hello.setName) return ctx.pass(`Replica set ${hello.setName}.`);
          if (hello.msg == 'isdbgrid') return ctx.pass('Sharded cluster.');

          return ctx.fail({
            message:
              'MongoDB is a standalone server, which rejects the transactions Metorial uses.',
            resolution: {
              summary: 'Convert the server to a (single-member) replica set.',
              steps: [
                'Start mongod with --replSet rs0 and run rs.initiate().',
                'Add replicaSet=rs0 to the MongoDB URL.'
              ],
              docs: 'datacenter/operations/doctor#mongodb'
            }
          });
        })
    }),

    check({
      ...base,
      id: 'mongodb.version',
      title: 'MongoDB runs a supported version',
      severity: 'critical',
      run: ctx =>
        attempt(ctx, 'mongodb', async () => {
          let info = await (await admin()).command({ buildInfo: 1 });
          let version = String(info.version ?? '');
          let [major = 0] = parseVersion(version);
          let minimum = options.documentDb ? 5 : 7;

          if (major < minimum) {
            return ctx.fail({
              message: `${options.documentDb ? 'DocumentDB' : 'MongoDB'} ${version} is too old.`,
              resolution: {
                summary: 'Metorial needs MongoDB 7.0+ or Amazon DocumentDB 5.0+.'
              },
              details: { version }
            });
          }

          return ctx.pass(`Version ${version}.`, { version });
        })
    }),

    check({
      ...base,
      id: 'mongodb.permissions',
      title: 'The MongoDB user can write',
      severity: 'warning',
      run: ctx =>
        attempt(ctx, 'mongodb', async () => {
          let status = await (await admin()).command({ connectionStatus: 1 });
          let roles: { role: string }[] = status?.authInfo?.authenticatedUserRoles ?? [];
          if (!roles.length) return ctx.skip('The server did not report any roles.');

          let writers = [
            'readWrite',
            'readWriteAnyDatabase',
            'dbOwner',
            'root',
            'dbAdminAnyDatabase',
            'userAdminAnyDatabase'
          ];
          if (roles.some(item => writers.includes(item.role))) {
            return ctx.pass('The user can read and write.');
          }

          return ctx.warn({
            message: `The MongoDB user only has the roles ${roles.map(item => item.role).join(', ')}.`,
            resolution: {
              summary: 'Grant readWrite on the metorial_* databases.',
              docs: 'datacenter/operations/doctor#mongodb'
            },
            details: { roles: roles.map(item => item.role) }
          });
        })
    }),

    check({
      id: 'mongodb.tls-ca',
      title: 'The MongoDB CA bundle is readable',
      category: 'security',
      severity: 'warning',
      target,
      run: async ctx => {
        if (!options.tlsCaFile) return ctx.skip('No CA bundle is configured.');

        try {
          let pem = await readFile(options.tlsCaFile, 'utf8');
          if (!pem.includes('BEGIN CERTIFICATE')) throw new Error('it contains no certificate');
          return ctx.pass('The CA bundle is readable.');
        } catch (error: any) {
          return ctx.warn({
            message: `The CA bundle ${options.tlsCaFile} can't be used: ${error?.message ?? error}`,
            resolution: {
              summary: 'Mount a PEM bundle at METORIAL_MONGODB_TLS_CA_FILE.',
              docs: 'datacenter/operations/doctor#mongodb'
            }
          });
        }
      }
    }),

    check({
      ...base,
      id: 'mongodb.transactions',
      title: 'MongoDB transactions work',
      severity: 'critical',
      dependsOn: ['mongodb.connect', 'mongodb.topology'],
      minIntervalMs: 5 * 60_000,
      run: ctx =>
        attempt(ctx, 'mongodb', async () => {
          let client = await resolveClient();
          let collection = client.db(probeDatabase).collection(probeCollection);
          await collection.updateOne(
            { _id: 'probe' },
            { $set: { at: new Date() } },
            { upsert: true }
          );

          let session = client.startSession();
          try {
            await session.withTransaction(async () => {
              await collection.updateOne(
                { _id: 'probe' },
                { $set: { at: new Date() } },
                { session }
              );
            });
          } finally {
            await session.endSession();
          }

          return ctx.pass('A write transaction committed.');
        })
    })
  ];
};
