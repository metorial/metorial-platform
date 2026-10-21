import { uniqueId } from '@lowerdeck/testing-tools';
import { db as subspaceDb } from '@metorial-subspace/db';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { testContext } from './context';
import { assertE2EEnvironment } from './env';

export { db, subspaceDb };

/**
 * Loads the rows that module services take as inputs for an organization created by
 * `bootstrapOrganization()`.
 */
export let loadOrganizationFixture = async (ids: {
  organizationId: string;
  instanceId?: string;
  userId?: string;
}) => {
  let organization = await db.organization.findUniqueOrThrow({
    where: { id: ids.organizationId }
  });
  let member = await db.organizationMember.findFirstOrThrow({
    where: {
      organizationOid: organization.oid,
      status: 'active',
      ...(ids.userId ? { user: { id: ids.userId } } : {})
    },
    include: { actor: true, user: true },
    orderBy: { oid: 'asc' }
  });
  let instance = await db.instance.findFirstOrThrow({
    where: {
      organizationOid: organization.oid,
      ...(ids.instanceId ? { id: ids.instanceId } : {})
    },
    include: { organization: true, project: true },
    orderBy: { oid: 'asc' }
  });

  let context = testContext();

  return {
    organization,
    member,
    actor: member.actor,
    user: member.user,
    instance,
    project: instance.project,
    context,
    auditScope: createOrganizationActorAuditScope({
      organization,
      instance,
      organizationActor: member.actor,
      context
    })
  };
};

export type OrganizationFixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

type CountableModel = {
  [K in keyof typeof db]: (typeof db)[K] extends { count: (...args: any[]) => any }
    ? K
    : never;
}[keyof typeof db];

export let countRows = async <M extends CountableModel>(
  model: M,
  where: Record<string, unknown> = {}
): Promise<number> => (db[model] as any).count({ where });

/**
 * Creates an empty Postgres database next to the one in `envKey` and optionally pushes a Prisma
 * schema into it (`push.cwd` is the schema package, `push.args` overrides `prisma db push`).
 */
export let createScratchDatabase = async (
  input: {
    envKey?: string;
    push?: { cwd: string; args?: string[] };
  } = {}
) => {
  assertE2EEnvironment();
  let envKey = input.envKey ?? 'DATABASE_URL';
  let source = process.env[envKey];
  if (!source) throw new Error(`${envKey} is not set`);

  let name = uniqueId('e2e_scratch').replace(/-/g, '_');
  let admin = new URL(source);
  admin.pathname = '/postgres';
  let url = new URL(source);
  url.pathname = `/${name}`;

  let sql = new Bun.SQL(admin.toString());
  await sql.unsafe(`CREATE DATABASE "${name}"`);
  await sql.close();

  if (input.push) {
    let command = input.push.args ?? ['bun', 'prisma', 'db', 'push', '--accept-data-loss'];
    let child = Bun.spawn(command, {
      cwd: input.push.cwd,
      env: { ...process.env, [envKey]: url.toString() },
      stdout: 'inherit',
      stderr: 'inherit'
    });
    let code = await child.exited;
    if (code !== 0) throw new Error(`Schema push for ${name} failed with exit code ${code}`);
  }

  return {
    name,
    url: url.toString(),
    drop: async () => {
      let sql = new Bun.SQL(admin.toString());
      await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await sql.close();
    }
  };
};
