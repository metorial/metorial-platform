import { Paths } from '@metorial/frontend-config';
import { useCallbackTriggerSelectionOptions, useCurrentInstance } from '@metorial/state';
import {
  Button,
  Combobox,
  Input,
  MultiSelect,
  Spacer,
  Text,
  TextArrayInput
} from '@metorial/ui';
import { useDebounced } from '@metorial/use-debounced';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSelectionOptionsNote,
  type SelectionOptionsNote
} from './triggerSelectionOptionsNote';

let LOOKUP_DEBOUNCE_MS = 400;

export type SelectionOptionsLookup = {
  instanceId: string;
  callbackId: string;
  triggerGroupKey: string;
  selection: Record<string, unknown>;
};

type FieldProps = {
  field: string;
  label: string;
  description?: string;
  error?: string;
  lookup: SelectionOptionsLookup;
};

type OptionItem = { id: string; label: string; description?: string };

// The other fields are sent along so a dependent list, such as the tabs of a spreadsheet, can
// follow them. They are compared as text so that re-rendering the form is not a change.
let useDependentSelection = (field: string, lookup: SelectionOptionsLookup) => {
  let { [field]: _own, ...others } = lookup.selection;
  let key = useDebounced(JSON.stringify(others), LOOKUP_DEBOUNCE_MS);

  return useMemo(() => JSON.parse(key) as Record<string, unknown>, [key]);
};

// Without a query the input is the same for every caller, so the unsearched list is fetched once.
let useOptions = (d: {
  field: string;
  lookup: SelectionOptionsLookup;
  selection: Record<string, unknown>;
  query?: string;
}) => {
  let options = useCallbackTriggerSelectionOptions(d.lookup.instanceId, d.lookup.callbackId, {
    triggerGroupKey: d.lookup.triggerGroupKey,
    field: d.field,
    ...(d.query ? { query: d.query } : {}),
    ...(Object.keys(d.selection).length ? { selection: d.selection } : {})
  });

  let items: OptionItem[] = (options.data?.items ?? []).map(option => ({
    id: String(option.value),
    label: option.label,
    description: option.description ?? undefined
  }));

  return {
    items,
    hasMore: Boolean(options.data?.nextPageToken),
    isLoading: options.isLoading,
    error: options.error ? options.error.message : null,
    note: getSelectionOptionsNote(options.data),
    refetch: options.refetch
  };
};

// A list can be incomplete for an account, so a typed or pasted value can always be used as is.
let withTypedValue = (items: OptionItem[], typed: string | undefined, numeric?: boolean) => {
  let value = typed?.trim();
  if (!value || (numeric && !/^\d+$/.test(value))) return items;
  if (items.some(item => item.id === value)) return items;

  return [...items, { id: value, label: value, description: 'Use this value as typed' }];
};

let listMessages = (d: {
  query: string | undefined;
  error: string | null;
  hasMore: boolean;
  loaded: number;
  shown: number;
}) => {
  let failure = d.error ? `The list could not be loaded: ${d.error}` : null;
  let more = d.hasMore
    ? d.query
      ? `Showing the first ${d.loaded} matches. Keep typing to narrow them down.`
      : `Showing the first ${d.loaded}. Search to find the rest.`
    : undefined;

  return {
    empty:
      failure ??
      (d.query
        ? `No matches for "${d.query}".`
        : 'Nothing to choose from. Type or paste an ID to use it.'),
    status: failure && d.shown ? failure : more
  };
};

let unavailable = (description: string | undefined, error: string, hint: string) =>
  [description, `The list could not be loaded: ${error} ${hint}`].filter(Boolean).join(' ');

let RetryButton = ({ onRetry }: { onRetry: () => unknown }) => {
  let [retrying, setRetrying] = useState(false);

  return (
    <>
      <Spacer size={6} />
      <Button
        type="button"
        size="1"
        variant="outline"
        loading={retrying}
        onClick={async () => {
          setRetrying(true);
          await onRetry();
          setRetrying(false);
        }}
      >
        Try Again
      </Button>
    </>
  );
};

// Opens in a new tab so the selections entered so far are kept.
let OptionsNote = ({ note }: { note: SelectionOptionsNote | null }) => {
  let instance = useCurrentInstance();
  if (!note) return null;

  return (
    <Text size="1" color="gray600" style={{ marginTop: 6 }}>
      {note.text}
      {note.kind === 'not_connected' ? (
        <>
          {' '}
          <Link
            to={Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              note.provider.slug
            )}
            target="_blank"
          >
            {note.linkLabel}
          </Link>
          {note.linkSuffix}
        </>
      ) : null}
    </Text>
  );
};

export let SelectionOptionsField = ({
  field,
  label,
  description,
  error,
  lookup,
  numeric,
  value,
  onChange
}: FieldProps & { numeric?: boolean; value: string; onChange: (value: string) => void }) => {
  let selection = useDependentSelection(field, lookup);
  let initial = useOptions({ field, lookup, selection });
  let [picked, setPicked] = useState<OptionItem | null>(null);

  let valueLabel = value
    ? ((picked?.id === value
        ? picked.label
        : initial.items.find(item => item.id === value)?.label) ?? value)
    : undefined;

  let searchOptions = ({ searchQuery }: { searchQuery?: string }) => {
    // While closed the box shows the chosen value, and Combobox reports that text as the search.
    let query =
      searchQuery && searchQuery !== value && searchQuery !== valueLabel
        ? searchQuery
        : undefined;
    let options = useOptions({ field, lookup, selection, query });
    let items = withTypedValue(options.items, query, numeric);

    return {
      items,
      isLoading: options.isLoading,
      ...listMessages({
        query,
        error: options.error,
        hasMore: options.hasMore,
        loaded: options.items.length,
        shown: items.length
      })
    };
  };

  if (initial.error) {
    return (
      <>
        <Input
          label={label}
          description={unavailable(description, initial.error, 'Enter the value by hand.')}
          value={value}
          onChange={event => onChange(event.target.value)}
          error={error}
        />
        <RetryButton onRetry={initial.refetch} />
      </>
    );
  }

  return (
    <>
      <Combobox
        label={label}
        description={description}
        error={error}
        placeholder="Search or choose"
        value={value || null}
        valueLabel={valueLabel}
        debounceMs={LOOKUP_DEBOUNCE_MS}
        provider={searchOptions}
        onChange={(next, item) => {
          setPicked(next && item ? { id: next, label: item.label } : null);
          onChange(next ?? '');
        }}
      />
      <OptionsNote note={initial.note} />
    </>
  );
};

export let SelectionOptionsListField = ({
  field,
  label,
  description,
  error,
  lookup,
  value,
  onChange
}: FieldProps & { value: string[]; onChange: (value: string[]) => void }) => {
  let selection = useDependentSelection(field, lookup);
  let [search, setSearch] = useState('');
  let debounced = useDebounced(search.trim(), LOOKUP_DEBOUNCE_MS);
  let query = search.trim() ? debounced : undefined;
  let initial = useOptions({ field, lookup, selection });
  let options = useOptions({ field, lookup, selection, query });
  let [pickedLabels, setPickedLabels] = useState<Record<string, string>>({});

  if (initial.error) {
    return (
      <>
        <TextArrayInput
          label={label}
          description={unavailable(description, initial.error, 'Enter one value per box.')}
          value={value}
          onChange={onChange}
          error={error}
        />
        <RetryButton onRetry={initial.refetch} />
      </>
    );
  }

  let listedLabels = Object.fromEntries(
    [...initial.items, ...options.items].map(item => [item.id, item.label])
  );
  let items = withTypedValue(options.items, query);
  let messages = listMessages({
    query,
    error: options.error,
    hasMore: options.hasMore,
    loaded: options.items.length,
    shown: items.length
  });

  return (
    <>
      <MultiSelect
        label={label}
        description={description}
        placeholder="Choose"
        error={error}
        value={value}
        valueLabels={{ ...pickedLabels, ...listedLabels }}
        items={items}
        searchable
        searchPlaceholder="Search, or paste an ID"
        onSearchChange={setSearch}
        isLoading={options.isLoading}
        empty={messages.empty}
        footer={messages.status}
        onChange={next => {
          // A name found through a search is kept, so the choice still shows it once the search is cleared.
          setPickedLabels(current => ({
            ...current,
            ...Object.fromEntries(
              next.filter(id => listedLabels[id]).map(id => [id, listedLabels[id]!])
            )
          }));
          onChange(next);
        }}
      />
      <OptionsNote note={initial.note} />
    </>
  );
};
