import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  DeploymentProvider,
  SlateDeployment
} from '../../../prisma/generated/client';
import { SlateDeploymentStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@mtsrc/testing-tools';

export const DeploymentProviderFixtures = (db: PrismaClient) => {
  const defaultProvider = async (
    overrides: Partial<DeploymentProvider> = {}
  ): Promise<DeploymentProvider> => {
    const { oid, id } = getId('deploymentProvider');
    const identifier =
      overrides.identifier ?? `provider-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<DeploymentProvider>(
      {
        oid,
        id,
        name: overrides.name ?? `Test Provider ${identifier}`,
        identifier
      } as DeploymentProvider,
      {
        persist: value => db.deploymentProvider.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  const functionBay = async (
    overrides: Partial<DeploymentProvider> = {}
  ): Promise<DeploymentProvider> =>
    defaultProvider({
      name: 'Function Bay',
      identifier: 'function-bay',
      ...overrides
    });

  return {
    default: defaultProvider,
    functionBay
  };
};

export const SlateDeploymentFixtures = (db: PrismaClient) => {
  const defaultDeployment = async (data: {
    slateVersionOid: bigint;
    slateOid: bigint;
    providerOid: bigint;
    status?: SlateDeploymentStatus;
    overrides?: Partial<SlateDeployment>;
  }): Promise<SlateDeployment> => {
    const { oid, id } = getId('slateDeployment');

    const factory = defineFactory<SlateDeployment>(
      {
        oid,
        id,
        status: data.status || SlateDeploymentStatus.pending,
        slateVersionOid: data.slateVersionOid,
        slateOid: data.slateOid,
        providerOid: data.providerOid,
        providerDeploymentInfo: null,
        ...data.overrides
      } as SlateDeployment,
      {
        persist: value => db.slateDeployment.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const succeeded = async (data: {
    slateVersionOid: bigint;
    slateOid: bigint;
    providerOid: bigint;
    functionId?: string;
    overrides?: Partial<SlateDeployment>;
  }): Promise<SlateDeployment> => {
    const functionId = data.functionId || `fn_${randomBytes(4).toString('hex')}`;
    const functionDeploymentId = `dep_${randomBytes(4).toString('hex')}`;
    const providerDeploymentInfo = { functionId, functionDeploymentId };

    const deployment = await defaultDeployment({
      slateVersionOid: data.slateVersionOid,
      slateOid: data.slateOid,
      providerOid: data.providerOid,
      status: SlateDeploymentStatus.succeeded,
      overrides: {
        providerDeploymentInfo,
        ...data.overrides
      }
    });

    await db.slateVersion.update({
      where: { oid: data.slateVersionOid },
      data: {
        activeDeploymentOid: deployment.oid,
        providerDeploymentInfo,
        status: 'active'
      }
    });

    return deployment;
  };

  return {
    default: defaultDeployment,
    succeeded
  };
};
