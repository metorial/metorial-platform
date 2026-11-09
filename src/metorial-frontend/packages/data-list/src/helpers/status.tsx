import { getEnumListFilterValue, type FilterPayload } from '@metorial/filter-bar';
import { Badge, type ColorType } from '@metorial/ui';

export type StatusDefinition = {
  label: string;
  color: ColorType;
};

export type StatusDescriptor<V extends string> = {
  values: readonly V[];
  options: { id: V; label: string }[];
  getLabel: (value: string) => string;
  getColor: (value: string) => ColorType;
  parse: (payload: FilterPayload | undefined) => V[] | undefined;
};

export let defineStatus = <V extends string>(
  definitions: Record<V, StatusDefinition>
): StatusDescriptor<V> => {
  let values = Object.keys(definitions) as V[];

  return {
    values,
    options: values.map(id => ({ id, label: definitions[id].label })),
    getLabel: value => definitions[value as V]?.label ?? value,
    getColor: value => definitions[value as V]?.color ?? 'gray',
    parse: payload => getEnumListFilterValue(payload, values)
  };
};

export let StatusBadge = <V extends string>({
  status,
  descriptor
}: {
  status: string;
  descriptor: StatusDescriptor<V>;
}) => (
  <Badge size="2" color={descriptor.getColor(status)}>
    {descriptor.getLabel(status)}
  </Badge>
);

export let lifecycleStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  archived: { label: 'Archived', color: 'orange' },
  deleted: { label: 'Deleted', color: 'gray' }
});

export let lifecycleStatusWithDraft = defineStatus({
  draft: { label: 'Draft', color: 'blue' },
  active: { label: 'Active', color: 'green' },
  archived: { label: 'Archived', color: 'orange' },
  deleted: { label: 'Deleted', color: 'gray' }
});
