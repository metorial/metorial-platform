import {
  SCHEMA_MARKER_PREFIX,
  withoutSchemaKeys
} from '@metorial-subspace/provider-utils/src/lib/schemaMarkers';

export let presentTriggerSchema = <T>(schema: T): T =>
  withoutSchemaKeys(
    schema,
    key => key.startsWith('x-') && !key.startsWith(SCHEMA_MARKER_PREFIX)
  );
