export type FieldSchema = Record<string, any>;

export type FieldKind = 'text' | 'number' | 'boolean' | 'list' | 'json';

export let humanize = (key: string) => {
  let words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/)
    .map(word => (/^ids?$/i.test(word) ? word.toUpperCase().replace('IDS', 'IDs') : word));
  let label = words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export let singular = (label: string) => label.replace(/IDs$/, 'ID').replace(/([^s])s$/, '$1');

export let fieldLabel = (field: string, schema: FieldSchema) =>
  typeof schema.title === 'string' && schema.title.trim() ? schema.title : humanize(field);

export let listDescription = (field: string, schema: FieldSchema) => {
  let item = singular(fieldLabel(field, schema));
  let hint = `Enter one ${item.charAt(0).toLowerCase()}${item.slice(1)} per box. Use Add, or press Enter, for another.`;
  return schema.description ? `${hint} ${schema.description}` : hint;
};

export let fieldKind = (schema: FieldSchema): FieldKind => {
  if (schema.type === 'string') return 'text';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array' && schema.items?.type === 'string') return 'list';
  return 'json';
};

export let hasSelectionOptions = (schema: FieldSchema) => {
  let linked = schema['x-slates-options-linked'];

  return (
    schema['x-slates-options'] === true ||
    (typeof linked === 'object' &&
      linked !== null &&
      typeof linked.slate === 'string' &&
      typeof linked.optionList === 'string')
  );
};

export let orderedFields = (schema: FieldSchema) => {
  let required: string[] = schema.required ?? [];
  let rank = (field: string) =>
    required.includes(field) ? required.indexOf(field) : required.length;
  return Object.entries<FieldSchema>(schema.properties ?? {}).sort(
    ([a], [b]) => rank(a) - rank(b)
  );
};

export let toFormValue = (kind: FieldKind, value: unknown) => {
  if (kind === 'list') return Array.isArray(value) ? value.map(String) : [];
  if (kind === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (value === undefined || value === null) return '';
  return kind === 'json' ? JSON.stringify(value, null, 2) : String(value);
};

export let fromFormValue = (
  kind: FieldKind,
  value: any
): { value?: unknown; error?: string } => {
  if (kind === 'list') {
    let items = ((value ?? []) as string[]).map(item => item.trim()).filter(Boolean);
    return { value: items.length ? items : undefined };
  }
  if (kind === 'boolean') return { value };

  let text = String(value ?? '').trim();
  if (!text) return {};

  if (kind === 'number') {
    let number = Number(text);
    return Number.isFinite(number) ? { value: number } : { error: 'Enter a number' };
  }
  if (kind === 'json') {
    try {
      return { value: JSON.parse(text) };
    } catch {
      return { error: 'Enter valid JSON' };
    }
  }
  return { value: text };
};

export let parseGroupValues = (
  selectionSchema: FieldSchema,
  values: Record<string, any> | undefined
) => {
  let selection: Record<string, unknown> = {};
  let errors: Record<string, string> = {};

  for (let [field, schema] of Object.entries<FieldSchema>(selectionSchema.properties ?? {})) {
    let result = fromFormValue(fieldKind(schema), values?.[field]);
    if (result.error) errors[field] = result.error;
    else if (result.value !== undefined) selection[field] = result.value;
  }

  return { selection, errors };
};
