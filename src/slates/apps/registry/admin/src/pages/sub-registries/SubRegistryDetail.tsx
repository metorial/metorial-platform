import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { renderWithLoader, useForm } from '@metorial-io/data-hooks';
import { Button, Flex, Text, Group, Badge, Input, Spacer, Datalist, Select, Callout, RenderDate } from '@metorial-io/ui';
import { useSubRegistry, useTenant, useAddSubRegistryFilter, useRemoveSubRegistryFilter } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { MonoCode, MonoText } from '../../components/styled';

let getFilterTypeDescription = (filterType: 'scope' | 'prefix' | 'package'): string => {
  if (filterType === 'scope') return 'Filter by scope: enter a scope ID or identifier to show only slates owned by that scope';
  if (filterType === 'prefix') return 'Filter by identifier prefix: e.g., "@myorg/" matches all slates starting with @myorg/';
  return 'Include a specific slate by its exact identifier';
};

export let SubRegistryDetail = () => {
  let { tenantId, subRegistryId } = useParams<{ tenantId: string; subRegistryId: string }>();
  let tenant = useTenant(tenantId ?? '');
  let subRegistry = useSubRegistry(tenantId, subRegistryId!);
  let addFilter = useAddSubRegistryFilter();
  let removeFilter = useRemoveSubRegistryFilter();

  let [showAddForm, setShowAddForm] = useState(false);

  let filterForm = useForm({
    initialValues: {
      filterType: 'scope' as 'scope' | 'prefix' | 'package',
      filterValue: ''
    },
    onSubmit: async values => {
      if (!tenantId || !subRegistryId || !values.filterValue.trim()) return;
      let [, error] = await addFilter.mutate({ tenantId, subRegistryId, type: values.filterType, value: values.filterValue.trim() });
      if (!error) {
        filterForm.setFieldValue('filterValue', '');
        setShowAddForm(false);
      }
    },
    schema: yup =>
      yup.object({
        filterType: yup.string().oneOf(['scope', 'prefix', 'package']).required(),
        filterValue: yup.string().required()
      })
  });

  let handleRemoveFilter = async (filterId: string) => {
    let shouldRemove = window.confirm(
      'Are you sure you want to remove this filter? This will change which slates appear in this sub-registry.'
    );

    if (!shouldRemove || !tenantId || !subRegistryId) return;

    await removeFilter.mutate({ tenantId, subRegistryId, filterId });
  };

  return renderWithLoader({ subRegistry })(({ subRegistry }) => (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/sub-registries`}>Back to Sub-Registries</BackLink>

      <Group.Wrapper>
        <Group.Header
          title={subRegistry.data!.name}
          description={
            <Badge color="gray" size="1">
              <code>{subRegistry.data!.identifier}</code>
            </Badge>
          }
        />
        <Group.Content>
          <Datalist
            items={[
              { label: 'ID', value: <MonoCode>{subRegistry.data!.id}</MonoCode> },
              { label: 'Tenant', value: tenant.data?.name ?? '-' },
              { label: 'Created', value: <RenderDate date={subRegistry.data!.createdAt} /> }
            ]}
          />
        </Group.Content>
      </Group.Wrapper>

      <Group.Wrapper>
        <Group.Header
          title="Filters"
          description="Filters control which slates appear in this sub-registry. Multiple filters use OR logic - a slate appears if it matches any filter."
        />
        <Group.Content>
          {showAddForm ? (
            <form onSubmit={filterForm.handleSubmit}>
              <Flex direction="column" gap={16}>
                <Select
                  label="Filter Type"
                  description={getFilterTypeDescription(filterForm.values.filterType)}
                  value={filterForm.values.filterType}
                  onChange={value => {
                    filterForm.setFieldValue('filterType', value as 'scope' | 'prefix' | 'package');
                    filterForm.setFieldValue('filterValue', '');
                  }}
                  items={[
                    { id: 'scope', label: 'Scope' },
                    { id: 'prefix', label: 'Prefix' },
                    { id: 'package', label: 'Package' }
                  ]}
                />

                <Input
                  label={filterForm.values.filterType === 'scope' ? 'Scope ID or Identifier' : filterForm.values.filterType === 'prefix' ? 'Prefix' : 'Package Identifier'}
                  placeholder={filterForm.values.filterType === 'scope' ? 'e.g., scope_abc123 or myorg' : filterForm.values.filterType === 'prefix' ? 'e.g., @myorg/' : 'e.g., @myorg/my-slate'}
                  value={filterForm.values.filterValue}
                  onChange={e => filterForm.setFieldValue('filterValue', e.target.value)}
                />
                <filterForm.RenderError field="filterType" />
                <filterForm.RenderError field="filterValue" />

                <addFilter.RenderError />

                <Flex gap={8}>
                  <Button
                    type="submit"
                    loading={addFilter.isLoading}
                    disabled={!filterForm.values.filterValue.trim()}
                  >
                    Add Filter
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </Flex>
              </Flex>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)}>
              + Add Filter
            </Button>
          )}

          <Spacer size={24} />

          {!subRegistry.data!.filters || subRegistry.data!.filters.length === 0 ? (
            <Text size="2" color="gray600">No filters configured. All slates will be visible.</Text>
          ) : (
            <Flex direction="column" gap={12}>
              {subRegistry.data!.filters.map(filter => (
                <Callout key={filter.id} color="gray">
                  <Flex align="center" justify="space-between" style={{ width: '100%' }}>
                    <Flex align="center" gap={12}>
                      <Badge color="blue" size="1">{filter.type}</Badge>
                      <Text size="2" weight="medium">
                        <MonoText>{filter.value}</MonoText>
                      </Text>
                    </Flex>
                    <Button
                      variant="outline"
                      size="1"
                      color="red"
                      onClick={() => handleRemoveFilter(filter.id)}
                    >
                      Remove
                    </Button>
                  </Flex>
                </Callout>
              ))}
            </Flex>
          )}
        </Group.Content>
      </Group.Wrapper>

    </Flex>
  ));
}
