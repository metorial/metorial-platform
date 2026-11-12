import type { JSONSchema7 } from 'json-schema';
import { formatSchemaFieldLabel } from '../jsonSchemaInput';

// A stored schema loses its property order, but `required` keeps the order it was declared in.
export let orderJsonSchemaPropertiesByRequired = <Schema extends JSONSchema7 | null>(
  schema: Schema
): Schema => {
  if (!schema?.properties || !schema.required?.length) return schema;

  let required = schema.required;
  let position = (key: string) => {
    let index = required.indexOf(key);
    return index === -1 ? required.length : index;
  };

  return {
    ...schema,
    properties: Object.fromEntries(
      Object.entries(schema.properties).sort(([a], [b]) => position(a) - position(b))
    )
  };
};

type SetupIssue = { path: string[]; code?: unknown; message?: unknown };

let isSetupIssue = (issue: unknown): issue is SetupIssue =>
  typeof issue === 'object' &&
  issue !== null &&
  Array.isArray((issue as SetupIssue).path) &&
  (issue as SetupIssue).path.length > 0;

// Keyed like the field errors of `JsonSchemaInput`: the field titles joined by ` > `.
let getSetupIssueFieldLabels = (schema: JSONSchema7 | null, path: string[]) => {
  let labels: string[] = [];
  let current: JSONSchema7 | null = schema;

  for (let key of path) {
    let property: unknown = current?.properties?.[key];
    if (!property || typeof property !== 'object') return null;

    current = property as JSONSchema7;
    labels.push(current.title ?? formatSchemaFieldLabel(key));
  }

  return labels;
};

// Maps a failed setup request to a message per field and one message for the whole form.
export let getWebhookSetupErrorMessages = (p: {
  schema: JSONSchema7 | null;
  error: { message?: string; errors?: unknown } | null | undefined;
}) => {
  let fieldErrors: Record<string, string> = {};
  if (!p.error) return { message: null, fieldErrors };

  let unplaced: string[] = [];

  for (let issue of Array.isArray(p.error.errors) ? p.error.errors.filter(isSetupIssue) : []) {
    let labels = getSetupIssueFieldLabels(p.schema, issue.path.map(String));

    if (!labels) {
      unplaced.push(
        typeof issue.message === 'string'
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.path.join('.')
      );
      continue;
    }

    let label = labels[labels.length - 1];
    fieldErrors[labels.join(' > ')] ??=
      issue.code === 'invalid_format'
        ? `${label} is not in the expected format.`
        : `${label} is not valid.`;
  }

  let fields = Object.keys(fieldErrors);

  return {
    message: [
      p.error.message || 'Setup could not be completed.',
      fields.length ? `Check ${fields.join(', ')}.` : null,
      ...unplaced
    ]
      .filter(Boolean)
      .join(' '),
    fieldErrors
  };
};
