import { uniqueId } from '@lowerdeck/testing-tools';
import type {
  FunctionBundle,
  FunctionDeployment,
  FunctionDeploymentStep,
  Function as FunctionModel,
  FunctionVersion,
  Runtime
} from '../prisma/generated/client';
import { db } from '../src/db';
import { encryption } from '../src/encryption';
import { getId } from '../src/id';
import { provider as awsLambdaProvider } from '../src/providers/aws-lambda/provider';
import { provider as localProvider } from '../src/providers/local/provider';
import { functionBay } from './client';

export let createTenant = async (
  overrides: { hasAutomaticEnclaveOverride?: boolean; isServiceDefault?: boolean } = {}
) => {
  let presented = await functionBay.tenant.upsert({
    identifier: uniqueId('tenant'),
    name: 'Test Tenant',
    ...overrides
  });

  return db.tenant.findUniqueOrThrow({ where: { id: presented.id } });
};

export let createRuntime = async (
  overrides: Partial<Runtime> & { local?: boolean } = {}
): Promise<Runtime> => {
  let { local, ...rest } = overrides;
  let provider = local ? localProvider : awsLambdaProvider;
  let identifier = rest.identifier ?? uniqueId('runtime');

  return db.runtime.create({
    data: {
      ...getId('runtime'),
      identifier,
      name: `Runtime ${identifier}`,
      providerOid: provider.oid,
      configuration: {
        runtime: { identifier: 'nodejs', version: '22.x' },
        layer: {
          provider: 'aws.lambda',
          identifier: uniqueId('layer'),
          version: '2026-01-01',
          os: 'linux',
          osIdentifier: 'aws-linux.any',
          arch: 'x86_64'
        }
      },
      ...rest
    } as Runtime
  });
};

export let createFunction = async (input: {
  tenantOid: bigint;
  runtimeOid?: bigint;
  overrides?: Partial<FunctionModel>;
}): Promise<FunctionModel> => {
  let identifier = input.overrides?.identifier ?? uniqueId('function');

  return db.function.create({
    data: {
      ...getId('function'),
      status: 'active',
      identifier,
      name: `Function ${identifier}`,
      tenantOid: input.tenantOid,
      runtimeOid: input.runtimeOid ?? null,
      ...input.overrides
    } as FunctionModel
  });
};

export let createBundle = async (input: {
  functionOid: bigint;
  overrides?: Partial<FunctionBundle>;
}): Promise<FunctionBundle> =>
  db.functionBundle.create({
    data: {
      ...getId('functionBundle'),
      status: 'available',
      functionOid: input.functionOid,
      storageKey: `bundles/${uniqueId('bundle')}.zip`,
      bucket: 'e2e-bundles',
      ...input.overrides
    } as FunctionBundle
  });

let encryptEnv = async (entityId: string, env: Record<string, string> = {}) =>
  encryption.encrypt({ secret: JSON.stringify(env), entityId });

export let createVersion = async (input: {
  functionOid: bigint;
  runtimeOid: bigint;
  functionBundleOid: bigint;
  overrides?: Partial<FunctionVersion>;
}): Promise<FunctionVersion> => {
  let ids = getId('functionVersion');
  let identifier = input.overrides?.identifier ?? uniqueId('v');

  return db.functionVersion.create({
    data: {
      ...ids,
      status: 'active',
      identifier,
      name: `Version ${identifier}`,
      supportsV2Proxy: true,
      functionOid: input.functionOid,
      runtimeOid: input.runtimeOid,
      functionBundleOid: input.functionBundleOid,
      encryptedEnvironmentVariables: await encryptEnv(ids.id),
      configuration: { memorySizeMb: 256, timeoutSeconds: 30 },
      providerData: { functionArn: `arn:e2e:${identifier}`, versionArn: `arn:e2e:${identifier}:1` },
      manifest: { entrypoint: 'index.handler', files: ['index.js'] },
      ...input.overrides
    } as FunctionVersion
  });
};

export let createFunctionWithVersion = async (input: {
  tenantOid?: bigint;
  functionOverrides?: Partial<FunctionModel>;
  versionOverrides?: Partial<FunctionVersion>;
} = {}) => {
  let tenant = input.tenantOid
    ? await db.tenant.findUniqueOrThrow({ where: { oid: input.tenantOid } })
    : await createTenant();
  let runtime = await createRuntime();
  let func = await createFunction({
    tenantOid: tenant.oid,
    runtimeOid: runtime.oid,
    overrides: input.functionOverrides
  });
  let bundle = await createBundle({ functionOid: func.oid });
  let version = await createVersion({
    functionOid: func.oid,
    runtimeOid: runtime.oid,
    functionBundleOid: bundle.oid,
    overrides: input.versionOverrides
  });

  await db.function.update({ where: { oid: func.oid }, data: { currentVersionOid: version.oid } });

  return { tenant, runtime, function: func, bundle, version };
};

export let createDeployment = async (input: {
  functionOid: bigint;
  runtimeOid: bigint;
  overrides?: Partial<FunctionDeployment>;
}): Promise<FunctionDeployment> => {
  let ids = getId('functionDeployment');
  let identifier = input.overrides?.identifier ?? uniqueId('deploy');

  return db.functionDeployment.create({
    data: {
      ...ids,
      status: 'pending',
      identifier,
      name: `Deployment ${identifier}`,
      functionOid: input.functionOid,
      runtimeOid: input.runtimeOid,
      encryptedEnvironmentVariables: await encryptEnv(ids.id),
      configuration: { memorySizeMb: 256, timeoutSeconds: 30 },
      ...input.overrides
    } as FunctionDeployment
  });
};

export let createDeploymentStep = async (input: {
  functionDeploymentOid: bigint;
  output?: string;
  overrides?: Partial<FunctionDeploymentStep>;
}): Promise<FunctionDeploymentStep> =>
  db.functionDeploymentStep.create({
    data: {
      ...getId('functionDeploymentStep'),
      status: 'succeeded',
      type: 'deploy',
      name: 'Deploy Step',
      functionDeploymentOid: input.functionDeploymentOid,
      output: input.output ?? '',
      startedAt: new Date(Date.now() - 5000),
      endedAt: new Date(),
      ...input.overrides
    } as FunctionDeploymentStep
  });
