import type {
  PrismaClient,
  SlateSession,
  Slate,
  SlateInstance,
  SlateVersion,
  SlateSpecification,
  Tenant
} from '../../../prisma/generated/client';
import { SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { SlateFixtures } from './slateFixtures';
import { SlateInstanceFixtures } from './instanceFixtures';
import { TenantFixtures } from './tenantFixtures';

export const SlateSessionFixtures = (db: PrismaClient) => {
  const defaultSession = async (data: {
    slateOid: bigint;
    tenantOid: bigint;
    instanceOid: bigint;
    versionOid: bigint;
    overrides?: Partial<SlateSession>;
  }): Promise<SlateSession> => {
    const { oid, id } = getId('slateSession');

    const factory = defineFactory<SlateSession>(
      {
        oid,
        id,
        slateOid: data.slateOid,
        tenantOid: data.tenantOid,
        slateInstanceOid: data.instanceOid,
        slateVersionOid: data.versionOid,
        ...data.overrides
      } as SlateSession,
      {
        persist: value => db.slateSession.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const complete = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    sessionOverrides?: Partial<SlateSession>;
  }): Promise<{
    session: SlateSession;
    slate: Slate & { currentVersion: SlateVersion & { specification: SlateSpecification } };
    instance: SlateInstance;
    version: SlateVersion & { specification: SlateSpecification };
    tenant: Tenant;
  }> => {
    const tenantFixtures = TenantFixtures(db);
    const tenant = await tenantFixtures.default();

    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const instanceFixtures = SlateInstanceFixtures(db);
    const instance = await instanceFixtures.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const session = await defaultSession({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      instanceOid: instance.oid,
      versionOid: slate.currentVersion.oid,
      overrides: data?.sessionOverrides
    });

    return {
      session,
      slate,
      instance,
      version: slate.currentVersion,
      tenant
    };
  };

  return {
    default: defaultSession,
    complete
  };
};
