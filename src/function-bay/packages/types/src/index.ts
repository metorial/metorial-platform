import { v, ValidationTypeValue } from '@lowerdeck/validation';

export let functionBayLayer = v.object({
  provider: v.enumOf(['aws.lambda', 'gcp.cloud-functions', 'azure.functions']),
  identifier: v.string(),
  version: v.string(),
  os: v.enumOf(['linux']),
  osIdentifier: v.string(),
  arch: v.enumOf(['x86_64', 'arm64'])
});

export type FunctionBayLayer = ValidationTypeValue<typeof functionBayLayer>;

export let functionBayRuntimeSpec = v.union([
  v.object({
    identifier: v.literal('nodejs'),
    version: v.enumOf(['24.x', '22.x'])
  }),
  v.object({
    identifier: v.literal('python'),
    version: v.enumOf(['3.14', '3.13', '3.12'])
  }),
  v.object({
    identifier: v.literal('ruby'),
    version: v.enumOf(['3.4', '3.3'])
  }),
  v.object({
    identifier: v.literal('java'),
    version: v.enumOf(['25', '21'])
  })
]);

export type FunctionBayRuntimeSpec = ValidationTypeValue<typeof functionBayRuntimeSpec>;

export let functionBayRuntimeConfig = v.object({
  layer: functionBayLayer,
  runtime: functionBayRuntimeSpec,
  handler: v.string(),
  identifier: v.string()
});

export type FunctionBayRuntimeConfig = ValidationTypeValue<typeof functionBayRuntimeConfig>;
