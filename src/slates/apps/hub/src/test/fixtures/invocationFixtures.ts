import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateInvocationStorageBucket,
  SlateInvocation
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { storage } from '../../storage';
import { env } from '../../env';
import { getStoredInvocationStorageKey } from '../../lib/invocation/store';
import type { StoredSlateInvocation } from '../../lib/invocation/types';
import { defineFactory } from '@lowerdeck/testing-tools';

export const SlateInvocationStorageBucketFixtures = (db: PrismaClient) => {
  const defaultBucket = async (bucket?: string): Promise<SlateInvocationStorageBucket> => {
    const bucketName = bucket || `bucket-${randomBytes(4).toString('hex')}`;

    return db.slateInvocationStorageBucket.upsert({
      where: { bucket: bucketName },
      update: {},
      create: {
        oid: Math.floor(Math.random() * 1_000_000),
        bucket: bucketName
      }
    });
  };

  return {
    default: defaultBucket
  };
};

export const SlateInvocationFixtures = (db: PrismaClient) => {
  const defaultInvocation = async (data: {
    deploymentOid: bigint;
    bucketOid: number;
    providerInvocationId?: string;
    overrides?: Partial<SlateInvocation>;
  }): Promise<SlateInvocation> => {
    const { oid, id } = getId('slateInvocation');
    const providerInvocationId =
      data.providerInvocationId || `inv_${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<SlateInvocation>(
      {
        oid,
        id,
        isPending: true,
        hasResponseError: false,
        hasInvocationError: false,
        providerInvocationId,
        deploymentOid: data.deploymentOid,
        bucketOid: data.bucketOid,
        ...data.overrides
      } as SlateInvocation,
      {
        persist: value => db.slateInvocation.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const succeeded = async (data: {
    deploymentOid: bigint;
    bucketOid?: number;
    providerInvocationId?: string;
    overrides?: Partial<SlateInvocation>;
  }): Promise<SlateInvocation> => {
    // Get or create the invocations bucket using upsert with race condition handling
    // Prisma's upsert isn't truly atomic in PostgreSQL, so concurrent calls can still race
    const bucketName = env.storage.INVOCATIONS_BUCKET_NAME;
    let testBucket: SlateInvocationStorageBucket;
    try {
      testBucket = await db.slateInvocationStorageBucket.upsert({
        where: { bucket: bucketName },
        update: {},
        create: {
          oid: Math.floor(Math.random() * 1_000_000),
          bucket: bucketName
        }
      });
    } catch (err: any) {
      // Handle race condition - another concurrent call may have created it
      if (err.code === 'P2002') {
        testBucket = await db.slateInvocationStorageBucket.findFirstOrThrow({
          where: { bucket: bucketName }
        });
      } else {
        throw err;
      }
    }

    const invocation = await defaultInvocation({
      deploymentOid: data.deploymentOid,
      bucketOid: data.bucketOid ?? testBucket.oid,
      providerInvocationId: data.providerInvocationId,
      overrides: {
        isPending: false,
        hasResponseError: false,
        hasInvocationError: false,
        ...data.overrides
      }
    });

    // Store mock invocation data in object storage so presenter can fetch it
    const mockStoredInvocation: StoredSlateInvocation = {
      id: invocation.id,
      requests: [],
      responses: [],
      logs: [[Date.now(), 'Test invocation completed']],
      provider: {
        id: invocation.providerInvocationId,
        status: 'succeeded' as const,
        functionVersionId: 'test-function-version',
        billedTimeMs: 100,
        computeTimeMs: 50,
        error: null
      }
    };

    await storage.putObject(
      bucketName,
      getStoredInvocationStorageKey(invocation),
      JSON.stringify(mockStoredInvocation)
    );

    return invocation;
  };

  return {
    default: defaultInvocation,
    succeeded
  };
};
