import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  allPortalConsumerAccessLoader,
  useAllMagicMcpServers,
  useAllPortalConsumerAccess,
  useAllProviderTemplates,
  useCreatePortalConsumerAccessQuiet,
  useCurrentInstance,
  usePortalConsumerAccess
} from '@metorial/state';
import {
  Button,
  Checkbox,
  Entity,
  Flex,
  Input,
  Menu,
  Panel,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDebounced } from '../../../../hooks/useDebounced';
import { getPortalTargetLabel, getPortalTargetTypeLabel } from '../../pages/portal/shared';

type PortalAccessTargetType = 'provider_template' | 'magic_mcp_server';

let portalAccessSuccessMessage = 'Provider access updated';
let portalAccessErrorMessage =
  'An error occurred while processing your request. Please try again later.';

let portalAccessPickerCopy: Record<
  PortalAccessTargetType,
  {
    title: string;
    description: string;
    resourceLabel: string;
    resourcePluralLabel: string;
  }
> = {
  provider_template: {
    title: 'Add Access to Provider Template',
    description: 'Add access to a provider template for members of this consumer group.',
    resourceLabel: 'Provider Template',
    resourcePluralLabel: 'provider templates'
  },
  magic_mcp_server: {
    title: 'Add Access to Magic MCP Server',
    description: 'Add access to a Magic MCP server for members of this consumer group.',
    resourceLabel: 'Magic MCP Server',
    resourcePluralLabel: 'Magic MCP servers'
  }
};

let getGrantedTargetIds = (
  accesses:
    | {
        access:
          | {
              type: 'provider_template';
              providerTemplate: {
                id: string;
              };
            }
          | {
              type: 'magic_mcp_server';
              magicMcpServer: {
                id: string;
              };
            };
      }[]
    | null
    | undefined,
  type: PortalAccessTargetType
) => {
  return new Set(
    (accesses ?? []).flatMap(access => {
      if (type == 'provider_template' && access.access.type == 'provider_template') {
        return [access.access.providerTemplate.id];
      }

      if (type == 'magic_mcp_server' && access.access.type == 'magic_mcp_server') {
        return [access.access.magicMcpServer.id];
      }

      return [];
    })
  );
};

let PortalAccessPickerModal = (props: {
  instanceId: string;
  portalId: string;
  consumerGroupId: string;
  type: PortalAccessTargetType;
  close: () => void;
  dialogProps: any;
  onCreate: () => void;
}) => {
  let copy = portalAccessPickerCopy[props.type];
  let [selected, setSelected] = useState<string[]>([]);
  let [search, setSearch] = useState('');
  let [submitting, setSubmitting] = useState(false);
  let searchDebounced = useDebounced(search, 300);

  let createAccess = useCreatePortalConsumerAccessQuiet();
  let grantedAccess = useAllPortalConsumerAccess(props.instanceId, props.portalId, {
    consumerGroupId: props.consumerGroupId,
    type: props.type,
    limit: 100
  });
  let providerTemplates = useAllProviderTemplates(
    props.type == 'provider_template' ? props.instanceId : null,
    {
      limit: 100,
      search: searchDebounced
    }
  );
  let magicMcpServers = useAllMagicMcpServers(
    props.type == 'magic_mcp_server' ? props.instanceId : null,
    {
      limit: 100,
      search: searchDebounced,
      preconfiguredOnly: true
    }
  );
  let targets = props.type == 'provider_template' ? providerTemplates : magicMcpServers;

  useEffect(() => {
    let grantedIds = getGrantedTargetIds(grantedAccess.data, props.type);

    setSelected(current => current.filter(id => !grantedIds.has(id)));
  }, [grantedAccess.data, props.type]);

  let toggleSelected = (id: string, checked?: boolean | 'indeterminate') => {
    setSelected(current => {
      let nextChecked = typeof checked == 'boolean' ? checked : !current.includes(id);

      if (nextChecked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter(currentId => currentId != id);
    });
  };

  let submitSelected = async () => {
    if (!selected.length || submitting) return;

    setSubmitting(true);

    let results = await Promise.all(
      selected.map(targetId =>
        createAccess.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerGroupId: props.consumerGroupId,
          access:
            props.type == 'provider_template'
              ? {
                  type: 'provider_template',
                  providerTemplateId: targetId
                }
              : {
                  type: 'magic_mcp_server',
                  magicMcpServerId: targetId
                }
        })
      )
    );
    let hasError = results.some(([created, error]) => !created || !!error);

    await allPortalConsumerAccessLoader
      .fetchAndReturn(
        {
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerGroupId: props.consumerGroupId,
          type: props.type,
          limit: 100
        },
        { force: true }
      )
      .catch(() => null);

    setSubmitting(false);
    props.onCreate();
    props.close();

    if (hasError) {
      toast.error(portalAccessErrorMessage);
      return;
    }

    toast.success(portalAccessSuccessMessage);
  };

  return (
    <Panel.Wrapper {...props.dialogProps}>
      <Panel.Header>
        <Panel.Title>{copy.title}</Panel.Title>
        <Panel.Description>{copy.description}</Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <Input
          placeholder={`Search ${copy.resourcePluralLabel}...`}
          label={`Search ${copy.resourcePluralLabel}`}
          hideLabel
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Spacer height={15} />

        {renderWithLoader({ grantedAccess, targets })(data => {
          let grantedIds = getGrantedTargetIds(data.grantedAccess.data, props.type);
          let availableTargets = data.targets.data.filter(target => !grantedIds.has(target.id));

          if (data.targets.data.length === 0) {
            return (
              <Text size="2" color="gray600" align="center">
                {searchDebounced
                  ? `No ${copy.resourcePluralLabel} found for "${searchDebounced}".`
                  : `No ${copy.resourcePluralLabel} are available yet.`}
              </Text>
            );
          }

          if (availableTargets.length === 0) {
            return (
              <Text size="2" color="gray600" align="center">
                {`All ${copy.resourcePluralLabel} already have access.`}
              </Text>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availableTargets.map(target => (
                <div
                  key={target.id}
                  onClick={() => toggleSelected(target.id)}
                >
                  <Entity.Wrapper>
                    <Entity.Content>
                      <Entity.Field
                        prefix={
                          <div
                            onClick={e => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                          >
                            <Checkbox
                              checked={selected.includes(target.id)}
                              onCheckedChange={value => toggleSelected(target.id, value)}
                              label={`Select ${copy.resourceLabel}`}
                              hideLabel
                            />
                          </div>
                        }
                        title={target.name ?? target.id}
                        description={target.description}
                      />
                    </Entity.Content>
                  </Entity.Wrapper>
                </div>
              ))}
            </div>
          );
        })}

        <Spacer height={15} />

        <Button
          fullWidth
          size="2"
          disabled={selected.length === 0 || submitting}
          loading={submitting}
          onClick={submitSelected}
        >
          Add Access
        </Button>
      </Panel.Content>
    </Panel.Wrapper>
  );
};

let showCreatePortalAccessModal = (props: {
  instanceId: string;
  portalId: string;
  consumerGroupId: string;
  type: PortalAccessTargetType;
  onCreate: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <PortalAccessPickerModal
      dialogProps={dialogProps}
      close={close}
      instanceId={props.instanceId}
      portalId={props.portalId}
      consumerGroupId={props.consumerGroupId}
      type={props.type}
      onCreate={props.onCreate}
    />
  ));

export let PortalGroupAccess = (props: {
  portalId: string;
  groupId: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => {
  let instance = useCurrentInstance();
  let access = usePortalConsumerAccess(instance.data?.id, props.portalId, {
    consumerGroupId: props.groupId,
    limit: 100
  });
  let deleteAccess = access.deleteMutator();

  let accessContent = renderWithPagination(access, {
    hidePaginationWhenUnavailable: true
  })(accessPage => (
    <>
      <Table
        headers={['Resource', 'Type', 'Created', '']}
        data={accessPage.data.items.map(item => ({
          data: [
            getPortalTargetLabel(item.access),
            getPortalTargetTypeLabel(item.access),
            <RenderDate date={item.createdAt} />,
            <Flex justify="end" style={{ width: '100%' }}>
              <Button
                size="1"
                variant="outline"
                loading={
                  deleteAccess.isLoading && deleteAccess.input?.consumerAccessId === item.id
                }
                onClick={async () => {
                  let [removed] = await deleteAccess.mutate({
                    consumerAccessId: item.id
                  });

                  if (removed) {
                    access.refetch();
                  }
                }}
              >
                Remove
              </Button>
            </Flex>
          ]
        }))}
      />

      {accessPage.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No explicit access rules exist for this group.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(({ instance }) => (
    <Box
      title={props.title ?? 'Provider Access'}
      description={
        props.description ??
        'Choose which provider templates and Magic MCP servers members of this group can access.'
      }
      rightActions={
        <Menu
          items={[
            {
              id: 'provider_template',
              label: 'Provider Template',
              description: 'Grant access to a reusable provider template'
            },
            {
              id: 'magic_mcp_server',
              label: 'Magic MCP Server',
              description: 'Grant access to an existing Magic MCP server'
            }
          ]}
          onItemClick={id =>
            showCreatePortalAccessModal({
              instanceId: instance.data.id,
              portalId: props.portalId,
              consumerGroupId: props.groupId,
              type: id as PortalAccessTargetType,
              onCreate: () => access.refetch()
            })
          }
        >
          <Button size="2">Add Access</Button>
        </Menu>
      }
    >
      {accessContent}
    </Box>
  ));
};
