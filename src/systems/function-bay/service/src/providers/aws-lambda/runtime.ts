import type {
  FunctionBayLayer,
  FunctionBayRuntimeConfig,
  FunctionBayRuntimeSpec
} from '@function-bay/types';
import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { Runtime } from '../../../prisma/generated/client';
import { db } from '../../db';
import type { ForgeWorkflowStep } from '../../forge';
import { ID, snowflake } from '../../id';
import { provider } from './provider';
import { workflow } from './workflow';

let persistedRuntimes = new Map<string, Runtime>();

export let layer = {
  provider: 'aws.lambda' as const,
  version: '2026-01-01',
  os: 'linux' as const,
  osIdentifier: 'aws-linux.any' as const,
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
  let identifier = `function-bay::runtime::${provider.identifier}::${await Hash.sha256(
    canonicalize({
      layer,
      runtime: spec,
      workflow
    })
  )}`;

  let runtime = persistedRuntimes.get(identifier);

  if (!runtime) {
    let name = `AWS Lambda ${spec.identifier}@${spec.version}`;
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
  }

  return {
    runtime,
    spec,
    layer,
    workflow,
    identifier
  };
};
