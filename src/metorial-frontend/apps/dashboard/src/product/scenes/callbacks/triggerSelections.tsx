import { CodeEditor } from '@metorial/code-editor';
import type { DashboardInstanceCallbacksGetOutput } from '@metorial/dashboard-sdk';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Error,
  Input,
  Spacer,
  Text,
  TextArrayInput,
  theme
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

export type CallbackTriggerGroup =
  DashboardInstanceCallbacksGetOutput['triggerGroups'][number];

type Selections = Record<string, Record<string, any>>;
type FieldSchema = Record<string, any>;
type FieldKind = 'text' | 'number' | 'boolean' | 'list' | 'json';

let Row = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;

  & + & {
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let Group = styled('div')`
  & + & {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let TriggerGroupStatusBadge = ({ status }: { status: CallbackTriggerGroup['status'] }) => (
  <Badge color={status === 'active' ? 'blue' : 'orange'}>
    {status === 'active' ? 'Active' : 'Needs Selection'}
  </Badge>
);

let humanize = (key: string) => {
  let words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/)
    .map(word => (/^ids?$/i.test(word) ? word.toUpperCase().replace('IDS', 'IDs') : word));
  let label = words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

let singular = (label: string) => label.replace(/IDs$/, 'ID').replace(/([^s])s$/, '$1');

let listDescription = (field: string, schema: FieldSchema) => {
  let item = singular(humanize(field));
  let hint = `Enter one ${item.charAt(0).toLowerCase()}${item.slice(1)} per box. Use Add, or press Enter, for another.`;
  return schema.description ? `${hint} ${schema.description}` : hint;
};

let fieldKind = (schema: FieldSchema): FieldKind => {
  if (schema.type === 'string') return 'text';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array' && schema.items?.type === 'string') return 'list';
  return 'json';
};

let orderedFields = (schema: FieldSchema) => {
  let required: string[] = schema.required ?? [];
  let rank = (field: string) =>
    required.includes(field) ? required.indexOf(field) : required.length;
  return Object.entries<FieldSchema>(schema.properties ?? {}).sort(
    ([a], [b]) => rank(a) - rank(b)
  );
};

// Selections the form has no fields for are saved back as stored, unless removed.
export let unusedSelections = (
  triggerGroups: Pick<CallbackTriggerGroup, 'key'>[],
  selections: Selections | null,
  removed: string[] = []
): Selections => {
  let listed = new Set(triggerGroups.map(group => group.key));
  return Object.fromEntries(
    Object.entries(selections ?? {}).filter(
      ([key]) => !listed.has(key) && !removed.includes(key)
    )
  );
};

let missingGroups = (triggerGroups: CallbackTriggerGroup[]) =>
  triggerGroups.filter(group => group.status === 'selection_required');

export let CallbackSelectionRequiredCallout = ({
  triggerGroups,
  settingsPath
}: {
  triggerGroups: CallbackTriggerGroup[];
  settingsPath: string;
}) => {
  let missing = missingGroups(triggerGroups);
  if (!missing.length) return null;

  return (
    <Callout color="orange">
      <span>
        <strong>
          {missing.length === 1
            ? `${missing[0]!.name} is not active yet.`
            : `${missing.length} triggers are not active yet.`}
        </strong>{' '}
        {missing.length === 1 ? 'It needs' : 'They need'} to know what to watch before any
        events are delivered. <Link to={settingsPath}>Choose what to watch</Link>
      </span>
    </Callout>
  );
};

export let CallbackTriggerGroupsBox = ({
  triggerGroups,
  settingsPath
}: {
  triggerGroups: CallbackTriggerGroup[];
  settingsPath: string;
}) => {
  if (!triggerGroups.length) return null;

  return (
    <Box
      title="Triggers"
      description="Triggers that only deliver events for what you select."
      rightActions={
        <Link to={settingsPath}>
          <Button size="2" as="span" variant="outline">
            Edit Selections
          </Button>
        </Link>
      }
    >
      {triggerGroups.map(group => (
        <Row key={group.key}>
          <div>
            <Text size="2" weight="strong">
              {group.name}
            </Text>
            {group.description ? (
              <Text size="2" color="gray600">
                {group.description}
              </Text>
            ) : null}
          </div>

          <TriggerGroupStatusBadge status={group.status} />
        </Row>
      ))}
    </Box>
  );
};

let toFormValue = (kind: FieldKind, value: unknown) => {
  if (kind === 'list') return Array.isArray(value) ? value.map(String) : [];
  if (kind === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (value === undefined || value === null) return '';
  return kind === 'json' ? JSON.stringify(value, null, 2) : String(value);
};

let fromFormValue = (kind: FieldKind, value: any): { value?: unknown; error?: string } => {
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

let SelectionField = ({
  field,
  schema,
  required,
  value,
  error,
  onChange
}: {
  field: string;
  schema: FieldSchema;
  required: boolean;
  value: any;
  error?: string;
  onChange: (value: any) => void;
}) => {
  let kind = fieldKind(schema);
  let label = `${humanize(field)}${required ? '' : ' (optional)'}`;

  if (kind === 'list') {
    return (
      <TextArrayInput
        label={label}
        description={listDescription(field, schema)}
        placeholder={singular(humanize(field))}
        value={value ?? []}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (kind === 'boolean') {
    return (
      <>
        <Checkbox
          label={label}
          description={schema.description}
          checked={value ?? schema.default ?? false}
          onCheckedChange={checked => onChange(checked === true)}
        />
        {error ? <Error size={12}>{error}</Error> : null}
      </>
    );
  }

  if (kind === 'json') {
    return (
      <>
        <CodeEditor
          label={label}
          description={schema.description}
          lang="json"
          height="120px"
          value={value ?? ''}
          onChange={onChange}
        />
        {error ? <Error size={12}>{error}</Error> : null}
      </>
    );
  }

  return (
    <Input
      label={label}
      description={schema.description}
      value={value ?? ''}
      onChange={event => onChange(event.target.value)}
      error={error}
    />
  );
};

export let TriggerSelectionsForm = ({
  triggerGroups,
  selections,
  loading,
  success,
  onSave
}: {
  triggerGroups: CallbackTriggerGroup[];
  selections: Selections | null;
  loading?: boolean;
  success?: boolean;
  onSave: (selections: Selections | null) => Promise<unknown>;
}) => {
  let [values, setValues] = useState<Record<string, Record<string, any>>>({});
  let [errors, setErrors] = useState<Record<string, string>>({});
  let [removed, setRemoved] = useState<string[]>([]);

  let resetKey = JSON.stringify([
    triggerGroups.map(group => [group.key, group.selectionSchema]),
    selections
  ]);

  useEffect(() => {
    setValues(
      Object.fromEntries(
        triggerGroups.map(group => [
          group.key,
          Object.fromEntries(
            Object.entries<FieldSchema>(group.selectionSchema.properties ?? {}).map(
              ([field, schema]) => [
                field,
                toFormValue(fieldKind(schema), selections?.[group.key]?.[field])
              ]
            )
          )
        ])
      )
    );
    setRemoved([]);
  }, [resetKey]);

  if (!triggerGroups.length) {
    return (
      <Text size="2" color="gray600">
        Triggers that need a selection appear here once the callback is registered for a
        connection.
      </Text>
    );
  }

  let setField = (group: string, field: string, value: any) =>
    setValues(current => ({ ...current, [group]: { ...current[group], [field]: value } }));

  let submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let next = unusedSelections(triggerGroups, selections, removed);
    let nextErrors: Record<string, string> = {};

    for (let group of triggerGroups) {
      let properties: Record<string, FieldSchema> = group.selectionSchema.properties ?? {};
      let required: string[] = group.selectionSchema.required ?? [];
      let selection: Record<string, any> = {};

      for (let [field, schema] of Object.entries(properties)) {
        let result = fromFormValue(fieldKind(schema), values[group.key]?.[field]);
        if (result.error) nextErrors[`${group.key}.${field}`] = result.error;
        else if (result.value !== undefined) selection[field] = result.value;
      }

      if (!Object.keys(selection).length) continue;

      for (let field of required) {
        if (selection[field] !== undefined) continue;
        let schema = properties[field];
        if (schema && fieldKind(schema) === 'boolean') {
          selection[field] = schema.default ?? false;
        } else {
          nextErrors[`${group.key}.${field}`] = `${humanize(field)} is required`;
        }
      }
      next[group.key] = selection;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await onSave(Object.keys(next).length ? next : null);
  };

  let unused = Object.keys(unusedSelections(triggerGroups, selections));
  let toggleRemoved = (key: string) =>
    setRemoved(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    );

  return (
    <form onSubmit={submit}>
      {triggerGroups.map(group => (
        <Group key={group.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Text size="3" weight="strong">
              {group.name}
            </Text>
            <TriggerGroupStatusBadge status={group.status} />
          </div>
          {group.description ? (
            <Text size="2" color="gray600">
              {group.description}
            </Text>
          ) : null}

          <Spacer size={12} />

          {orderedFields(group.selectionSchema).map(([field, schema]) => (
            <div key={field} style={{ marginBottom: 12 }}>
              <SelectionField
                field={field}
                schema={schema}
                required={(group.selectionSchema.required ?? []).includes(field)}
                value={values[group.key]?.[field]}
                error={errors[`${group.key}.${field}`]}
                onChange={value => setField(group.key, field, value)}
              />
            </div>
          ))}
        </Group>
      ))}

      {unused.length ? (
        <Group>
          <Text size="3" weight="strong">
            Not in use
          </Text>
          <Text size="2" color="gray600">
            These selections match no trigger on this callback. Removing one takes effect when
            you save.
          </Text>

          {unused.map(key => (
            <Row key={key}>
              <Text
                size="2"
                color={removed.includes(key) ? 'gray600' : undefined}
                style={{
                  wordBreak: 'break-all',
                  textDecoration: removed.includes(key) ? 'line-through' : undefined
                }}
              >
                {key}
              </Text>
              <Button
                type="button"
                size="1"
                variant="outline"
                onClick={() => toggleRemoved(key)}
              >
                {removed.includes(key) ? 'Undo' : 'Remove'}
              </Button>
            </Row>
          ))}
        </Group>
      ) : null}

      <Spacer size={8} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="2" type="submit" loading={loading} success={success}>
          Save Selections
        </Button>
      </div>
    </form>
  );
};
