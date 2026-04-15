import { randomBytes } from 'crypto';
import type { PrismaClient, FunctionBundle } from '../../../prisma/generated/client';
import { FunctionBundleStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const FunctionBundleFixtures = (db: PrismaClient) => {
  const defaultBundle = async (data: {
    functionOid: bigint;
    overrides?: Partial<FunctionBundle>;
  }): Promise<FunctionBundle> => {
    const { oid, id } = getId('functionBundle');
    const storageKey = data.overrides?.storageKey ?? `bundles/${randomBytes(8).toString('hex')}.zip`;

    const factory = defineFactory<FunctionBundle>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionBundleStatus.available,
        functionOid: data.functionOid,
        storageKey,
        bucket: data.overrides?.bucket ?? 'test-bundles'
      } as FunctionBundle,
      {
        persist: value => db.functionBundle.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const available = async (data: {
    functionOid: bigint;
    overrides?: Partial<FunctionBundle>;
  }): Promise<FunctionBundle> =>
    defaultBundle({
      functionOid: data.functionOid,
      overrides: {
        status: FunctionBundleStatus.available,
        ...data.overrides
      }
    });

  const uploading = async (data: {
    functionOid: bigint;
    overrides?: Partial<FunctionBundle>;
  }): Promise<FunctionBundle> =>
    defaultBundle({
      functionOid: data.functionOid,
      overrides: {
        status: FunctionBundleStatus.uploading,
        storageKey: null,
        bucket: null,
        ...data.overrides
      }
    });

  return {
    default: defaultBundle,
    available,
    uploading
  };
};
