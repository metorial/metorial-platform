import type { FunctionBayLayer, FunctionBayRuntimeSpec } from '@function-bay/types';
import { canonicalize } from '@lowerdeck/canonicalize';
import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import type { Runtime } from '../../../prisma/generated/client';
import { db } from '../../db';
import type { ForgeWorkflowStep } from '../../forge';
import { ID, snowflake } from '../../id';
import { provider } from './provider';
import { workflow } from './workflow';

let persistedRuntimes = new Map<string, Runtime>();

export let layer = {
  provider: 'knative' as const,
  version: '2026-11-01',
  os: 'linux' as const,
  osIdentifier: 'runtime-function-node24' as const,
  arch: 'x86_64' as const,

  identifier: ''
} satisfies FunctionBayLayer;
layer.identifier = `function-bay::layer::${provider.identifier}::${await Hash.sha256(canonicalize(layer))}`;

export let getRuntime = async (
  spec: FunctionBayRuntimeSpec
): Promise<{
  runtime: Runtime;
  spec: FunctionBayRuntimeSpec;
  layer: FunctionBayLayer;
  workflow: ForgeWorkflowStep[];
  identifier: string;
}> => {
  if (spec.identifier !== 'nodejs') {
    throw new ServiceError(
      preconditionFailedError({
        message: `The ${spec.identifier} runtime is not supported on Kubernetes yet`
      })
    );
  }

  let identifier = `function-bay::runtime::${provider.identifier}::${await Hash.sha256(
    canonicalize({
      layer,
      runtime: spec,
      workflow
    })
  )}`;

  let runtime =
    process.env.NODE_ENV === 'test' ? undefined : persistedRuntimes.get(identifier);

  if (!runtime) {
    let name = `Kubernetes Node.js ${spec.version}`;
    runtime = await db.runtime.upsert({
      where: {
        identifier
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('runtime'),
        identifier,
        name,
        providerOid: provider.oid,
        configuration: {
          runtime: spec,
          layer
        }
      },
      update: {
        name
      }
    });
    if (process.env.NODE_ENV !== 'test') persistedRuntimes.set(identifier, runtime);
  }

  return {
    runtime,
    spec,
    layer,
    workflow,
    identifier
  };
};
