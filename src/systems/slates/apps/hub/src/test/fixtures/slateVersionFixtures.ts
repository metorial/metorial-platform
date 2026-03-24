import type { PrismaClient, SlateVersion, SlateSpecification } from '../../../prisma/generated/client';
import { SlateVersionStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { SlateSpecificationFixtures } from './slateSpecificationFixtures';

export const SlateVersionFixtures = (db: PrismaClient) => {
  const defaultVersion = async (data: {
    slateOid: bigint;
    registryOid: bigint;
    version?: string;
    overrides?: Partial<SlateVersion>;
  }): Promise<SlateVersion> => {
    const { oid, id } = getId('slateVersion');
    const version = data.version || '1.0.0';

    const factory = defineFactory<SlateVersion>(
      {
        oid,
        id,
        status: SlateVersionStatus.active,
        isCurrent: true,
        willBeCurrent: false,
        version,
        versionIdOnRegistry: `ver_${Date.now()}`,
        versionIdentifierOnRegistry: version,
        manifest: { name: 'test-slate', version },
        providerDeploymentInfo: null,
        slateOid: data.slateOid,
        registryOid: data.registryOid,
        specificationOid: null,
        ...data.overrides
      } as SlateVersion,
      {
        persist: value => db.slateVersion.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withSpecification = async (data: {
    slateOid: bigint;
    registryOid: bigint;
    version?: string;
    versionOverrides?: Partial<SlateVersion>;
    specificationOverrides?: Partial<SlateSpecification>;
  }): Promise<{
    version: SlateVersion & { specification: SlateSpecification };
    specification: SlateSpecification;
  }> => {
    const version = await defaultVersion({
      slateOid: data.slateOid,
      registryOid: data.registryOid,
      version: data.version,
      overrides: data.versionOverrides
    });

    const specFixtures = SlateSpecificationFixtures(db);
    const specification = await specFixtures.default({
      slateOid: data.slateOid,
      versionOid: version.oid,
      overrides: data.specificationOverrides
    });

    await db.slateVersion.update({
      where: { oid: version.oid },
      data: { specificationOid: specification.oid }
    });

    const versionWithSpec = await db.slateVersion.findUniqueOrThrow({
      where: { oid: version.oid },
      include: { specification: true }
    });

    return {
      version: versionWithSpec as SlateVersion & {
        specification: SlateSpecification;
      },
      specification
    };
  };

  return {
    default: defaultVersion,
    withSpecification
  };
};
