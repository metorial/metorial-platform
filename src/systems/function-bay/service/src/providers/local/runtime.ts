import type { FunctionBayRuntimeSpec } from '@function-bay/types';
import { canonicalize } from '@mtsrc/canonicalize';
import { Hash } from '@mtsrc/hash';
import type { Runtime } from '../../../prisma/generated/client';
import { db } from '../../db';
import type { ForgeWorkflowStep } from '../../forge';
import { ID, snowflake } from '../../id';
import { layer } from '../aws-lambda/runtime';
import { provider } from './provider';
import { workflow } from './workflow';

let persistedRuntimes = new Map<string, Runtime>();

let getRuntimeName = (spec: FunctionBayRuntimeSpec) => {
  switch (spec.identifier) {
    case 'nodejs':
      return `Local Node.js ${spec.version} (Lambda-compatible)`;
    case 'python':
      return `Local Python ${spec.version} (Lambda-compatible)`;
    case 'ruby':
      return `Local Ruby ${spec.version} (Lambda-compatible)`;
    case 'java':
      return `Local Java ${spec.version} (Lambda-compatible)`;
  }
};

export let getRuntime = async (
  spec: FunctionBayRuntimeSpec
): Promise<{
  runtime: Runtime;
  spec: FunctionBayRuntimeSpec;
  layer: typeof layer;
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
    let name = getRuntimeName(spec);
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
    persistedRuntimes.set(identifier, runtime);
  }

  return {
    runtime,
    spec,
    layer,
    workflow,
    identifier
  };
};
