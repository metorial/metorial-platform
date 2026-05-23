import type {
  PrismaClient,
  SlateSpecificationChange,
  Slate,
  SlateVersion,
  SlateSpecification
} from '../../../prisma/generated/client';
import { SlateSpecificationChangeType, SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { SlateFixtures } from './slateFixtures';
import { SlateVersionFixtures } from './slateVersionFixtures';

export const SlateSpecificationChangeFixtures = (db: PrismaClient) => {
  const defaultChange = async (data: {
    slateOid: bigint;
    fromVersionOid: bigint;
    toVersionOid: bigint;
    fromSpecificationOid: bigint;
    toSpecificationOid: bigint;
    type?: SlateSpecificationChangeType;
    overrides?: Partial<SlateSpecificationChange>;
  }): Promise<SlateSpecificationChange> => {
    const { oid, id } = getId('slateSpecificationChange');

    const factory = defineFactory<SlateSpecificationChange>(
      {
        oid,
        id,
        type: data.type ?? SlateSpecificationChangeType.between_versions,
        slateOid: data.slateOid,
        fromVersionOid: data.fromVersionOid,
        toVersionOid: data.toVersionOid,
        fromSpecificationOid: data.fromSpecificationOid,
        toSpecificationOid: data.toSpecificationOid,
        ...data.overrides
      } as SlateSpecificationChange,
      {
        persist: value => db.slateSpecificationChange.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withVersions = async (data?: {
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    type?: SlateSpecificationChangeType;
    changeOverrides?: Partial<SlateSpecificationChange>;
  }): Promise<{
    change: SlateSpecificationChange;
    slate: Slate;
    fromVersion: SlateVersion & { specification: SlateSpecification };
    toVersion: SlateVersion & { specification: SlateSpecification };
  }> => {
    const slateFixtures = SlateFixtures(db);
    const slate = await slateFixtures.complete({
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus ?? SlateStatus.active
    });

    const versionFixtures = SlateVersionFixtures(db);
    const { version: toVersion } = await versionFixtures.withSpecification({
      slateOid: slate.oid,
      registryOid: slate.registryOid,
      versionOverrides: { version: '2.0.0' }
    });

    const toVersionWithSpec = await db.slateVersion.findUniqueOrThrow({
      where: { oid: toVersion.oid },
      include: { specification: true }
    });

    const fromVersionWithSpec = await db.slateVersion.findUniqueOrThrow({
      where: { oid: slate.currentVersion.oid },
      include: { specification: true }
    });

    const change = await defaultChange({
      slateOid: slate.oid,
      fromVersionOid: slate.currentVersion.oid,
      toVersionOid: toVersion.oid,
      fromSpecificationOid: fromVersionWithSpec.specification!.oid,
      toSpecificationOid: toVersionWithSpec.specification!.oid,
      type: data?.type,
      overrides: data?.changeOverrides
    });

    return {
      change,
      slate,
      fromVersion: fromVersionWithSpec as SlateVersion & { specification: SlateSpecification },
      toVersion: toVersionWithSpec as SlateVersion & { specification: SlateSpecification }
    };
  };

  return {
    default: defaultChange,
    withVersions
  };
};
