import { v } from '@lowerdeck/validation';
import {
  EVENT_ATTRIBUTE_SCHEMA_MARKER,
  isJsonObject,
  SCHEMA_MARKER_PREFIX,
  SELECTION_OPTIONS_SCHEMA_MARKER,
  withoutSchemaKeys
} from '@metorial-subspace/provider-utils/src/lib/schemaMarkers';

let SLATES_SCHEMA_MARKER_PREFIX = 'x-slates-';
let SLATES_OPTIONS_SCHEMA_MARKER = 'x-slates-options';
let SLATES_LINKED_OPTIONS_SCHEMA_MARKER = 'x-slates-options-linked';
let SLATES_EVENT_ATTRIBUTE_SCHEMA_MARKER = 'x-slates-event-attribute';

let linkedOptionListValidator = v.object({ slate: v.string(), optionList: v.string() });

type JsonSchema = Record<string, any>;

let getLinkedOptionList = (property: JsonSchema) => {
  let marker = linkedOptionListValidator.validate(
    property[SLATES_LINKED_OPTIONS_SCHEMA_MARKER]
  );
  return marker.success ? marker.value : null;
};

// The platform prefix is reserved, so an integration cannot set a platform marker itself.
let isHubOnlyKey = (key: string) =>
  key.startsWith(SLATES_SCHEMA_MARKER_PREFIX) || key.startsWith(SCHEMA_MARKER_PREFIX);

let markedFields = (schema: unknown, isMarked: (property: JsonSchema) => boolean) =>
  isJsonObject(schema) && isJsonObject(schema.properties)
    ? Object.entries(schema.properties).filter(
        ([, property]) => isJsonObject(property) && isMarked(property)
      )
    : [];

let toPlatformSchema = <T>(
  schema: T,
  marker: string,
  isMarked: (property: JsonSchema) => boolean
): T => {
  let platform = withoutSchemaKeys(schema, isHubOnlyKey);
  let marked = new Set(markedFields(schema, isMarked).map(([field]) => field));
  if (!marked.size || !isJsonObject(platform)) return platform;

  return {
    ...platform,
    properties: Object.fromEntries(
      Object.entries(platform.properties).map(([field, property]) => [
        field,
        marked.has(field) ? { ...(property as JsonSchema), [marker]: true } : property
      ])
    )
  };
};

export let toPlatformSelectionSchema = <T>(schema: T): T =>
  toPlatformSchema(
    schema,
    SELECTION_OPTIONS_SCHEMA_MARKER,
    property =>
      property[SLATES_OPTIONS_SCHEMA_MARKER] === true || !!getLinkedOptionList(property)
  );

export let toPlatformTriggerOutputSchema = <T>(schema: T): T =>
  toPlatformSchema(
    schema,
    EVENT_ATTRIBUTE_SCHEMA_MARKER,
    property => property[SLATES_EVENT_ATTRIBUTE_SCHEMA_MARKER] === true
  );

export let toPlatformSelectableTriggerGroups = <T extends { selectionSchema: JsonSchema }>(
  groups: T[] | undefined
) =>
  groups?.map(group => ({
    ...group,
    selectionSchema: toPlatformSelectionSchema(group.selectionSchema),
    linkedOptionProviders: Object.fromEntries(
      markedFields(group.selectionSchema, property => !!getLinkedOptionList(property)).map(
        ([field, property]) => [field, getLinkedOptionList(property)!.slate]
      )
    )
  }));
