import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  Slate,
  Registry,
  SlateVersion,
  SlateSpecification
} from '../../../prisma/generated/client';
import { SlateStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';
import { RegistryFixtures } from './registryFixtures';
import { SlateVersionFixtures } from './slateVersionFixtures';

export const SlateFixtures = (db: PrismaClient) => {
  const defaultSlate = async (data: {
    registryOid: bigint;
    identifier?: string;
    status?: SlateStatus;
    overrides?: Partial<Slate>;
  }): Promise<Slate> => {
    const { oid, id } = getId('slate');
    const identifier = data.identifier || `test-slate-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Slate>(
      {
        oid,
        id,
        status: data.status || SlateStatus.active,
        identifier,
        name: `Test Slate ${identifier}`,
        description: 'A test slate',
        registryOid: data.registryOid,
        slateScopeIdentifierOnRegistry: 'test-scope',
        slateScopeIdOnRegistry: 'scope_123',
        slateFullIdentifierOnRegistry: `test-scope/${identifier}`,
        slateIdentifierOnRegistry: identifier,
        slateIdOnRegistry: `slate_${identifier}`,
        ...data.overrides
      } as Slate,
      {
        persist: value => db.slate.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withRegistry = async (data?: {
    registryOverrides?: Partial<Registry>;
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    slateOverrides?: Partial<Slate>;
  }): Promise<Slate & { registry: Registry }> => {
    const registryFixtures = RegistryFixtures(db);
    const registry = await registryFixtures.default(data?.registryOverrides);

    const slate = await defaultSlate({
      registryOid: registry.oid,
      identifier: data?.slateIdentifier,
      status: data?.slateStatus,
      overrides: data?.slateOverrides
    });

    return db.slate.findUniqueOrThrow({
      where: { id: slate.id },
      include: { registry: true }
    }) as Promise<Slate & { registry: Registry }>;
  };

  const complete = async (data?: {
    registryOverrides?: Partial<Registry>;
    slateIdentifier?: string;
    slateStatus?: SlateStatus;
    slateOverrides?: Partial<Slate>;
    versionOverrides?: Partial<SlateVersion>;
    specificationOverrides?: Partial<SlateSpecification>;
  }): Promise<
    Slate & {
      registry: Registry;
      currentVersion: SlateVersion & { specification: SlateSpecification };
    }
  > => {
    const slateWithRegistry = await withRegistry({
      registryOverrides: data?.registryOverrides,
      slateIdentifier: data?.slateIdentifier,
      slateStatus: data?.slateStatus,
      slateOverrides: data?.slateOverrides
    });

    const versionFixtures = SlateVersionFixtures(db);
    const { version } = await versionFixtures.withSpecification({
      slateOid: slateWithRegistry.oid,
      registryOid: slateWithRegistry.registryOid,
      versionOverrides: data?.versionOverrides,
      specificationOverrides: data?.specificationOverrides
    });

    await db.slate.update({
      where: { oid: slateWithRegistry.oid },
      data: { currentVersionOid: version.oid }
    });

    return db.slate.findUniqueOrThrow({
      where: { id: slateWithRegistry.id },
      include: {
        registry: true,
        currentVersion: {
          include: { specification: true }
        }
      }
    }) as Promise<
      Slate & {
        registry: Registry;
        currentVersion: SlateVersion & { specification: SlateSpecification };
      }
    >;
  };

  const withoutVersion = async (data?: {
    registryOverrides?: Partial<Registry>;
    slateIdentifier?: string;
    slateOverrides?: Partial<Slate>;
  }): Promise<Slate & { registry: Registry; currentVersion: null }> => {
    const slate = await withRegistry({
      registryOverrides: data?.registryOverrides,
      slateIdentifier: data?.slateIdentifier,
      slateOverrides: data?.slateOverrides
    });

    return db.slate.findUniqueOrThrow({
      where: { id: slate.id },
      include: {
        registry: true,
        currentVersion: true
      }
    }) as Promise<Slate & { registry: Registry; currentVersion: null }>;
  };

  return {
    default: defaultSlate,
    withRegistry,
    complete,
    withoutVersion
  };
};
