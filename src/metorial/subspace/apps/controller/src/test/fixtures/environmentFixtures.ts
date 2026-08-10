import { randomBytes } from 'crypto';
import { defineFactory } from '@lowerdeck/testing-tools';
import {
  getId,
  type Environment,
  type EnvironmentType,
  type PrismaClient,
  type Tenant
} from '@metorial-subspace/db';
import { TenantFixtures } from './tenantFixtures';

export const EnvironmentFixtures = (db: PrismaClient) => {
  const defaultEnvironment = async (opts?: {
    tenant?: Tenant;
    type?: EnvironmentType;
    overrides?: Partial<Environment>;
  }): Promise<Environment> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = opts?.tenant ?? (await tenantFixtures.default());
    const { oid, id } = getId('environment');
    const identifier =
      opts?.overrides?.identifier ??
      `${tenant.identifier}-${randomBytes(3).toString('hex')}`;

    const factory = defineFactory<Environment>(
      {
        oid,
        id,
        tenantOid: tenant.oid,
        type: opts?.type ?? 'development',
        identifier,
        name: opts?.overrides?.name ?? `Environment ${identifier}`
      } as Environment,
      {
        persist: value => db.environment.create({ data: value })
      }
    );

    return factory.create(opts?.overrides ?? {});
  };

  return {
    default: defaultEnvironment
  };
};
