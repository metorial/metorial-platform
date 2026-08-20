import {
  assertCanonicalStoredSlateConfigSchema,
  projectSlateConfigPresence,
  resolveStoredSlateConfigFieldDescriptors
} from '../../lib/configPatch';
import { validateJsonSchema } from '../../lib/validateJsonSchema';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export let projectConfigChangedPayload = (d: {
  value: unknown;
  schemaVersion: number;
  fields: unknown;
}) => {
  let descriptors = resolveStoredSlateConfigFieldDescriptors({
    schemaVersion: d.schemaVersion,
    fields: d.fields,
    value: d.value
  });
  return {
    config: projectSlateConfigPresence({ value: d.value, fields: descriptors }),
    fields: descriptors
  };
};

export let configChangedJobMatches = (d: {
  currentGeneration: number;
  currentSchemaHash: string | null;
  configGeneration?: number;
  configSchemaHash?: string;
}) =>
  d.configGeneration === undefined ||
  (d.currentGeneration === d.configGeneration && d.currentSchemaHash === d.configSchemaHash);

export let buildConfigChangedFailureUpdate = (d: {
  configOid: bigint;
  configGeneration?: number;
  invocationId: string;
  failure: 'provider_error' | 'provider_rejected' | 'invalid_provider_output';
}) => {
  let failures = {
    provider_error: {
      errorCode: 'provider_config_update_failed',
      errorMessage: 'Provider config update failed.'
    },
    provider_rejected: {
      errorCode: 'invalid_config',
      errorMessage: 'The provider rejected the configuration.'
    },
    invalid_provider_output: {
      errorCode: 'invalid_config_provider_output',
      errorMessage: 'Provider returned classified, undeclared, or invalid config fields.'
    }
  } as const;
  return {
    where: {
      oid: d.configOid,
      ...(d.configGeneration !== undefined ? { generation: d.configGeneration } : {})
    },
    data: {
      ...failures[d.failure],
      errorInvocationId: d.invocationId
    }
  };
};

export let mergeProviderConfigOutput = (d: {
  stored: Record<string, unknown>;
  providerOutput: Record<string, unknown>;
  schema: {
    version: number;
    descriptorHash: string | null;
    fields: unknown;
    schema: unknown;
  };
}) => {
  let canonical = assertCanonicalStoredSlateConfigSchema(d.schema);
  let unknown = Object.keys(d.providerOutput).filter(key => !canonical.fields[key]);
  if (unknown.length > 0) {
    throw new Error('Provider returned undeclared config fields');
  }
  let classified = Object.keys(d.providerOutput).filter(
    key => canonical.fields[key]?.visibility !== 'plain'
  );
  if (classified.length > 0) {
    throw new Error('Provider returned classified config fields');
  }
  let root = canonical.jsonSchema as Record<string, unknown>;
  let rootProperties = isRecord(root.properties) ? root.properties : {};
  let properties = isRecord(root.properties)
    ? Object.fromEntries(
        Object.keys(d.providerOutput).map(key => [key, rootProperties[key]])
      )
    : {};
  validateJsonSchema({
    schema: {
      type: 'object',
      properties,
      required: [],
      additionalProperties: false
    },
    data: d.providerOutput,
    entity: 'providerConfigOutput',
    message: 'Provider returned config values that do not match the canonical schema.'
  });
  let merged = { ...d.stored };
  for (let [key, value] of Object.entries(d.providerOutput)) {
    merged[key] = value;
  }
  return merged;
};
