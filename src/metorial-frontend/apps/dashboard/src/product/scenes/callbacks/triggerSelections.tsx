import { CodeEditor } from '@metorial/code-editor';
import type { DashboardInstanceCallbacksGetOutput } from '@metorial/dashboard-sdk';
import type { CallbackRegistration } from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Error,
  Flex,
  Input,
  Spacer,
  Spinner,
  Text,
  TextArrayInput,
  theme
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CallbackSyncErrorCallout } from './shared';
import {
  SelectionOptionsField,
  SelectionOptionsListField,
  type SelectionOptionsLookup
} from './triggerSelectionOptions';
import {
  type FieldSchema,
  fieldKind,
  fieldLabel,
  hasSelectionOptions,
  listDescription,
  orderedFields,
  parseGroupValues,
  singular,
  toFormValue
} from './triggerSelectionSchema';

export type CallbackTriggerGroup =
  DashboardInstanceCallbacksGetOutput['triggerGroups'][number];

type Selections = Record<string, Record<string, any>>;
type FormValues = Record<string, Record<string, any>>;
type LoadedSelections = { selectionsKey: string; schemaKeys: Record<string, string> };

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

let Notice = styled('div')`
  margin-top: 12px;
`;

let TriggerGroupStatusBadge = ({ status }: { status: CallbackTriggerGroup['status'] }) => (
  <Badge color={status === 'active' ? 'blue' : 'orange'}>
    {status === 'active' ? 'Active' : 'Needs Selection'}
  </Badge>
);

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

let groupFormValues = (
  group: Pick<CallbackTriggerGroup, 'key' | 'selectionSchema'>,
  selections: Selections | null
) =>
  Object.fromEntries(
    Object.entries<FieldSchema>(group.selectionSchema.properties ?? {}).map(
      ([field, schema]) => [
        field,
        toFormValue(fieldKind(schema), selections?.[group.key]?.[field])
      ]
    )
  );

let describeLoad = (
  triggerGroups: Pick<CallbackTriggerGroup, 'key' | 'selectionSchema'>[],
  selections: Selections | null,
  previous: LoadedSelections | null
): LoadedSelections => {
  let selectionsKey = JSON.stringify(selections);
  let schemaKeys: Record<string, string> =
    previous?.selectionsKey === selectionsKey ? { ...previous.schemaKeys } : {};

  for (let group of triggerGroups) {
    schemaKeys[group.key] = JSON.stringify(group.selectionSchema);
  }

  return { selectionsKey, schemaKeys };
};

// Background refreshes can change the trigger groups while someone is editing, so edits are kept
// until the stored selections change or the group's schema does.
export let formValuesAfterLoad = ({
  triggerGroups,
  selections,
  current,
  previous
}: {
  triggerGroups: Pick<CallbackTriggerGroup, 'key' | 'selectionSchema'>[];
  selections: Selections | null;
  current: FormValues;
  previous: LoadedSelections | null;
}) => {
  let keepEdits = !!previous && previous.selectionsKey === JSON.stringify(selections);
  let values: FormValues = keepEdits ? { ...current } : {};

  for (let group of triggerGroups) {
    let unchanged =
      keepEdits &&
      !!values[group.key] &&
      previous?.schemaKeys[group.key] === JSON.stringify(group.selectionSchema);
    if (!unchanged) values[group.key] = groupFormValues(group, selections);
  }

  return values;
};

let RegistrationNotice = ({ registration }: { registration: CallbackRegistration }) => {
  if (registration.failure) {
    return (
      <Notice>
        <CallbackSyncErrorCallout sync={registration.failure} />
      </Notice>
    );
  }

  if (registration.isRegistering) {
    return (
      <Notice>
        <Flex align="center" gap={8}>
          <Spinner size={12} />
          <Text size="2" color="gray600">
            Registering with the provider. Trigger status updates here when it finishes.
          </Text>
        </Flex>
      </Notice>
    );
  }

  if (registration.hasTimedOut) {
    return (
      <Notice>
        <Text size="2" color="gray600">
          Registration is taking longer than usual. Reload the page later to see the result.
        </Text>
      </Notice>
    );
  }

  return null;
};

let SelectionField = ({
  field,
  schema,
  required,
  value,
  error,
  lookup,
  onChange
}: {
  field: string;
  schema: FieldSchema;
  required: boolean;
  value: any;
  error?: string;
  lookup?: SelectionOptionsLookup;
  onChange: (value: any) => void;
}) => {
  let kind = fieldKind(schema);
  let label = `${fieldLabel(field, schema)}${required ? '' : ' (optional)'}`;

  if (lookup && hasSelectionOptions(schema) && kind === 'list') {
    return (
      <SelectionOptionsListField
        field={field}
        label={label}
        description={schema.description}
        value={value ?? []}
        error={error}
        lookup={lookup}
        onChange={onChange}
      />
    );
  }

  if (lookup && hasSelectionOptions(schema) && (kind === 'text' || kind === 'number')) {
    return (
      <SelectionOptionsField
        field={field}
        label={label}
        description={schema.description}
        value={value ?? ''}
        error={error}
        lookup={lookup}
        numeric={kind === 'number'}
        onChange={onChange}
      />
    );
  }

  if (kind === 'list') {
    return (
      <TextArrayInput
        label={label}
        description={listDescription(field, schema)}
        placeholder={singular(fieldLabel(field, schema))}
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
  lookup,
  registration,
  loading,
  success,
  onSave
}: {
  triggerGroups: CallbackTriggerGroup[];
  selections: Selections | null;
  lookup?: { instanceId: string; callbackId: string };
  registration: CallbackRegistration;
  loading?: boolean;
  success?: boolean;
  onSave: (selections: Selections | null) => Promise<unknown>;
}) => {
  let [values, setValues] = useState<FormValues>({});
  let [errors, setErrors] = useState<Record<string, string>>({});
  let [removed, setRemoved] = useState<string[]>([]);
  let loaded = useRef<LoadedSelections | null>(null);

  let resetKey = JSON.stringify([
    triggerGroups.map(group => [group.key, group.selectionSchema]),
    selections
  ]);

  useEffect(() => {
    let previous = loaded.current;
    let next = describeLoad(triggerGroups, selections, previous);
    loaded.current = next;

    setValues(current =>
      formValuesAfterLoad({ triggerGroups, selections, current, previous })
    );
    if (previous?.selectionsKey !== next.selectionsKey) setRemoved([]);
  }, [resetKey]);

  let setField = (group: string, field: string, value: any) =>
    setValues(current => ({ ...current, [group]: { ...current[group], [field]: value } }));

  let submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let next = unusedSelections(triggerGroups, selections, removed);
    let nextErrors: Record<string, string> = {};

    for (let group of triggerGroups) {
      let properties: Record<string, FieldSchema> = group.selectionSchema.properties ?? {};
      let required: string[] = group.selectionSchema.required ?? [];
      let { selection, errors: fieldErrors } = parseGroupValues(
        group.selectionSchema,
        values[group.key]
      );

      for (let [field, error] of Object.entries(fieldErrors)) {
        nextErrors[`${group.key}.${field}`] = error;
      }

      if (!Object.keys(selection).length) continue;

      for (let field of required) {
        if (selection[field] !== undefined) continue;
        let schema = properties[field];
        if (schema && fieldKind(schema) === 'boolean') {
          selection[field] = schema.default ?? false;
        } else {
          nextErrors[`${group.key}.${field}`] =
            `${fieldLabel(field, schema ?? {})} is required`;
        }
      }
      next[group.key] = selection;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await onSave(Object.keys(next).length ? next : null);
  };

  let groupLookup = (group: CallbackTriggerGroup) =>
    lookup && {
      ...lookup,
      triggerGroupKey: group.key,
      selection: parseGroupValues(group.selectionSchema, values[group.key]).selection
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
                lookup={groupLookup(group)}
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

      <RegistrationNotice registration={registration} />

      <Spacer size={8} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="2" type="submit" loading={loading} success={success}>
          Save Selections
        </Button>
      </div>
    </form>
  );
};
