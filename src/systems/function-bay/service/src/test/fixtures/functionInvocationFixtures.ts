import type {
  PrismaClient,
  FunctionInvocation,
  FunctionVersion,
  Function as FunctionModel,
  Tenant,
  Runtime,
  Provider
} from '../../../prisma/generated/client';
import { FunctionInvocationStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { FunctionVersionFixtures } from './functionVersionFixtures';

export const FunctionInvocationFixtures = (db: PrismaClient) => {
  const versionFixtures = FunctionVersionFixtures(db);

  const defaultInvocation = async (data: {
    functionVersionOid: bigint;
    overrides?: Partial<FunctionInvocation>;
  }): Promise<FunctionInvocation> => {
    const { oid, id } = getId('functionInvocation');

    const factory = defineFactory<FunctionInvocation>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionInvocationStatus.succeeded,
        functionVersionOid: data.functionVersionOid,
        error: data.overrides?.error ?? null,
        logs: data.overrides?.logs ?? '',
        computeTimeMs: data.overrides?.computeTimeMs ?? 150,
        billedTimeMs: data.overrides?.billedTimeMs ?? 200
      } as FunctionInvocation,
      {
        persist: value => db.functionInvocation.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const succeeded = async (data?: {
    versionOverrides?: Partial<FunctionVersion>;
    invocationOverrides?: Partial<FunctionInvocation>;
  }): Promise<
    FunctionInvocation & {
      functionVersion: FunctionVersion & {
        function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
      };
    }
  > => {
    const version = await versionFixtures.complete({
      versionOverrides: data?.versionOverrides
    });

    const invocation = await defaultInvocation({
      functionVersionOid: version.oid,
      overrides: {
        status: FunctionInvocationStatus.succeeded,
        logs: '[1234567890, "Function executed successfully"]\n[1234567891, "Output: ok"]',
        error: null,
        ...data?.invocationOverrides
      }
    });

    return db.functionInvocation.findUniqueOrThrow({
      where: { oid: invocation.oid },
      include: {
        functionVersion: {
          include: {
            function: {
              include: {
                tenant: true,
                runtime: { include: { provider: true } }
              }
            }
          }
        }
      }
    }) as Promise<
      FunctionInvocation & {
        functionVersion: FunctionVersion & {
          function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
        };
      }
    >;
  };

  const failed = async (data?: {
    versionOverrides?: Partial<FunctionVersion>;
    invocationOverrides?: Partial<FunctionInvocation>;
    error?: Record<string, unknown>;
  }): Promise<
    FunctionInvocation & {
      functionVersion: FunctionVersion & {
        function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
      };
    }
  > => {
    const version = await versionFixtures.complete({
      versionOverrides: data?.versionOverrides
    });

    const invocation = await defaultInvocation({
      functionVersionOid: version.oid,
      overrides: {
        status: FunctionInvocationStatus.failed,
        error: data?.error ?? { message: 'Execution failed', code: 'RUNTIME_ERROR' },
        logs: '[1234567890, "Error: Something went wrong"]\n[1234567891, "    at handler (index.js:10:5)"]',
        ...data?.invocationOverrides
      }
    });

    return db.functionInvocation.findUniqueOrThrow({
      where: { oid: invocation.oid },
      include: {
        functionVersion: {
          include: {
            function: {
              include: {
                tenant: true,
                runtime: { include: { provider: true } }
              }
            }
          }
        }
      }
    }) as Promise<
      FunctionInvocation & {
        functionVersion: FunctionVersion & {
          function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
        };
      }
    >;
  };

  return {
    default: defaultInvocation,
    succeeded,
    failed
  };
};
