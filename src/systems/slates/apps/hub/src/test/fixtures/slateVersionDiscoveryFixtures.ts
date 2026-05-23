import type {
  PrismaClient,
  SlateVersionDiscovery,
  Slate,
  SlateVersion,
  SlateSpecification
} from '../../../prisma/generated/client';
import { SlateVersionDiscoveryStatus, SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { SlateFixtures } from './slateFixtures';

export const SlateVersionDiscoveryFixtures = (db: PrismaClient) => {
  const defaultDiscovery = async (data: {
    slateVersionOid: bigint;
    specificationOid?: bigint;
    status?: SlateVersionDiscoveryStatus;
    overrides?: Partial<SlateVersionDiscovery>;
  }): Promise<SlateVersionDiscovery> => {
    const { oid, id } = getId('slateVersionDiscovery');

    const factory = defineFactory<SlateVersionDiscovery>(
      {
        oid,
        id,
        status: data.status ?? SlateVersionDiscoveryStatus.succeeded,
        slateVersionOid: data.slateVersionOid,
        specificationOid: data.specificationOid,
        ...data.overrides
      } as SlateVersionDiscovery,
      {
        persist: value => db.slateVersionDiscovery.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSlate = async (data?: {
    status?: SlateVersionDiscoveryStatus;
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    discoveryOverrides?: Partial<SlateVersionDiscovery>;
  }): Promise<{
    discovery: SlateVersionDiscovery;
    slate: Slate & { currentVersion: SlateVersion & { specification: SlateSpecification } };
  }> => {
    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const discovery = await defaultDiscovery({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      status: data?.status,
      overrides: data?.discoveryOverrides
    });

    return { discovery, slate };
  };

  const failed = async (data: {
    slateVersionOid: bigint;
    errorMessage?: string;
    errorCode?: string;
    overrides?: Partial<SlateVersionDiscovery>;
  }): Promise<SlateVersionDiscovery> =>
    defaultDiscovery({
      slateVersionOid: data.slateVersionOid,
      status: SlateVersionDiscoveryStatus.failed,
      overrides: {
        errorMessage: data.errorMessage ?? 'Discovery failed',
        ...(data.errorCode ? { errorCode: data.errorCode } : {}),
        ...data.overrides
      }
    });

  return {
    default: defaultDiscovery,
    withSlate,
    failed
  };
};
