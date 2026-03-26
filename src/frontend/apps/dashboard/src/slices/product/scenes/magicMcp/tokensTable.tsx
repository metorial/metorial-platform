import {
  DashboardInstanceMagicMcpGroupsListOutput,
  DashboardInstanceMagicMcpTokensCreateBody,
  DashboardInstanceMagicMcpTokensGetOutput,
  DashboardInstanceMagicMcpTokensListOutput,
  DashboardInstanceMagicMcpTokensListQuery
} from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateMagicMcpToken,
  useCurrentInstance,
  useMagicMcpGroups,
  useMagicMcpTokens
} from '@metorial/state';
import {
  Badge,
  Button,
  Checkbox,
  confirm,
  Copy,
  Dialog,
  Flex,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text,
  theme,
  toast,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiClipboardLine, RiDeleteBinLine, RiMoreLine } from '@remixicon/react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Table as DashboardTable } from '../../../../components/table';
import { FilterPayload } from '../../../../components/table/filter';
import {
  TableStateProvider,
  TableStateProviderResult
} from '../../../../components/table/type';
import { getEnumListFilterValue, getStringFilterValue } from '../../../../lib/dataTableUtils';

type TokenRow = DashboardInstanceMagicMcpTokensListOutput['items'][number];
type MagicMcpGroupRow = DashboardInstanceMagicMcpGroupsListOutput['items'][number];
type MagicMcpTokensTableProps = DashboardInstanceMagicMcpTokensListQuery & {
  instanceId: string;
};

let formatGroupRestrictions = (token: Pick<TokenRow, 'groups'>) => {
  if (!token.groups.length) {
    return (
      <Text size="1" color="gray600">
        Unrestricted
      </Text>
    );
  }

  return (
    <Flex gap={6} style={{ flexWrap: 'wrap' }}>
      {token.groups.map(group => (
        <Badge key={group.id} size="1" color="gray">
          {group.name ?? group.slug ?? group.id}
        </Badge>
      ))}
    </Flex>
  );
};

let GroupRestrictionsField = ({
  groups,
  selectedGroupIds,
  setSelectedGroupIds,
  emptyText
}: {
  groups: MagicMcpGroupRow[];
  selectedGroupIds: string[];
  setSelectedGroupIds: (value: string[]) => void;
  emptyText: string;
}) => {
  if (groups.length === 0) {
    return (
      <Text size="2" color="gray600">
        {emptyText}
      </Text>
    );
  }

  return (
    <Flex direction="column" gap={8}>
      {groups.map(group => {
        let isSelected = selectedGroupIds.includes(group.id);
        let isArchived = group.status !== 'active';

        return (
          <div key={group.id}>
            <Checkbox
              checked={isSelected}
              disabled={isArchived}
              label={group.name ?? group.slug ?? group.id}
              description={
                isArchived
                  ? 'Archived groups can be removed from tokens but cannot be newly added.'
                  : group.description ?? group.slug
              }
              onCheckedChange={checked => {
                if (checked) {
                  setSelectedGroupIds([...selectedGroupIds, group.id]);
                  return;
                }

                setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id));
              }}
            />
          </div>
        );
      })}
    </Flex>
  );
};

let useRestrictionOptions = (token?: Pick<TokenRow, 'groups'> | null) => {
  let instance = useCurrentInstance();
  let groups = useMagicMcpGroups(instance.data?.id, {
    limit: 100,
    order: 'asc',
    status: ['active', 'archived']
  });

  let items = useMemo(() => {
    let merged = new Map<string, MagicMcpGroupRow>();

    for (let group of groups.data?.items ?? []) {
      merged.set(group.id, group);
    }

    for (let group of token?.groups ?? []) {
      if (merged.has(group.id)) continue;
      merged.set(group.id, group);
    }

    return Array.from(merged.values());
  }, [groups.data?.items, token?.groups]);

  return {
    groups,
    items
  };
};

let showCreatedTokenModal = (secret: string) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper variant="padded" {...dialogProps}>
      <Dialog.Title>Magic MCP Token Created</Dialog.Title>
      <Dialog.Description>
        Your new Magic MCP token is ready to use. Please don't share it with anyone and
        keep it in a safe place, such as a password manager.
      </Dialog.Description>

      <Copy label="Magic MCP Token" value={secret} />

      <Spacer height={15} />

      <Dialog.Actions>
        <Button onClick={close}>Close</Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  ));

let showManageRestrictionsModal = (p: { token: TokenRow }) =>
  showModal(({ dialogProps, close }) => {
    let instance = useCurrentInstance();
    let tokens = useMagicMcpTokens(instance.data?.id);
    let addGroupsMutator = tokens.addGroupsMutator();
    let removeGroupsMutator = tokens.removeGroupsMutator();
    let { groups, items } = useRestrictionOptions(p.token);
    let [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
      p.token.groups.map(group => group.id)
    );

    let initialGroupIds = p.token.groups.map(group => group.id);
    let groupsToAdd = selectedGroupIds.filter(id => !initialGroupIds.includes(id));
    let groupsToRemove = initialGroupIds.filter(id => !selectedGroupIds.includes(id));
    let isLoading = addGroupsMutator.isLoading || removeGroupsMutator.isLoading;

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Edit Group Restrictions</Dialog.Title>
        <Dialog.Description>
          Restrict this token to specific Magic MCP groups. Leave all groups unchecked to
          keep the token unrestricted.
        </Dialog.Description>

        <Spacer height={16} />

        {groups.isLoading ? (
          <Text size="2" color="gray600">
            Loading groups...
          </Text>
        ) : (
          <GroupRestrictionsField
            groups={items}
            selectedGroupIds={selectedGroupIds}
            setSelectedGroupIds={setSelectedGroupIds}
            emptyText="No Magic MCP groups are available yet. Create a group first if you want to restrict this token."
          />
        )}

        <Spacer height={16} />

        <Dialog.Actions>
          <Button variant="soft" onClick={close} type="button" disabled={isLoading}>
            Cancel
          </Button>
          <Button
            loading={isLoading}
            disabled={groups.isLoading}
            onClick={async () => {
              if (!instance.data) return;

              let didSucceed = true;

              if (groupsToAdd.length > 0) {
                let [res] = await addGroupsMutator.mutate({
                  magicMcpTokenId: p.token.id,
                  magicMcpGroupIds: groupsToAdd
                });
                if (!res) didSucceed = false;
              }

              if (didSucceed && groupsToRemove.length > 0) {
                let [res] = await removeGroupsMutator.mutate({
                  magicMcpTokenId: p.token.id,
                  magicMcpGroupIds: groupsToRemove
                });
                if (!res) didSucceed = false;
              }

              if (!didSucceed) return;

              toast.success('Magic MCP token restrictions updated');
              close();
            }}
          >
            Save Restrictions
          </Button>
        </Dialog.Actions>
      </Dialog.Wrapper>
    );
  });

let getTokenStatusFilterValue = (
  value: FilterPayload | undefined
): DashboardInstanceMagicMcpTokensListQuery['status'] =>
  getEnumListFilterValue(value, ['active', 'deleted']);

let updateTokenModal = ({ tokenId, instanceId }: { tokenId: string; instanceId: string }) =>
  showModal(({ dialogProps, close }) => {
    let tokens = useMagicMcpTokens(instanceId);
    let token = tokens.data?.items?.find(item => item.id === tokenId);
    let mutator = tokens.updateMutator();

    let form = useForm({
      initialValues: {
        name: token?.name ?? undefined,
        description: token?.description ?? undefined
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          ...values,
          magicMcpTokenId: tokenId
        });
        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Update Magic MCP Token</Dialog.Title>
        <Dialog.Description>Update the Magic MCP token details.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Dialog.Actions>
            <Button size="1" variant="soft" onClick={close} type="button">
              Cancel
            </Button>
            <Button size="1" type="submit">
              Update
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let magicTokensTableState: TableStateProvider<
  MagicMcpTokensTableProps,
  TokenRow,
  TableStateProviderResult<TokenRow>
> = (props, opts) => {
  let tokens = useMagicMcpTokens(props.instanceId, {
    order: props.order ?? 'asc',
    status: getTokenStatusFilterValue(opts.filter.status) ?? props.status,
    magicMcpGroupId: getStringFilterValue(opts.filter.magicMcpGroupId) ?? props.magicMcpGroupId
  });

  return {
    isLoading: tokens.isLoading,
    error: tokens.error,
    hasMoreAfter: tokens.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: tokens.data?.pagination.hasMoreBefore ?? false,
    items: tokens.data?.items ?? [],
    loadNext: tokens.next,
    loadPrevious: tokens.previous
  };
};

let magicTokensTable = new DashboardTable<
  MagicMcpTokensTableProps,
  TokenRow,
  {
    instanceId: string;
    openUpdateModal: (tokenId: string) => void;
    openRestrictionsModal: (token: TokenRow) => void;
    deleteToken: (tokenId: string) => Promise<void>;
  }
>('magic-mcp-tokens')
  .state(magicTokensTableState)
  .hookState((_, input) => {
    let tokens = useMagicMcpTokens(input.instanceId);
    let deleteMutation = tokens.revokeMutator();

    return {
      instanceId: input.instanceId,
      openUpdateModal: (tokenId: string) => {
        updateTokenModal({ tokenId, instanceId: input.instanceId });
      },
      openRestrictionsModal: (token: TokenRow) => {
        showManageRestrictionsModal({ token });
      },
      deleteToken: async (tokenId: string) => {
        let [res] = await deleteMutation.mutate({
          magicMcpTokenId: tokenId
        });

        if (res) toast.success('Magic MCP token deleted');
      }
    };
  })
  .columns([
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: token =>
        token.status === 'active' ? (
          <Badge size="1" color="green">
            Active
          </Badge>
        ) : (
          <Badge size="1" color="red">
            Revoked
          </Badge>
        )
    },
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: token => (
        <div>
          <Text size="2" weight="strong">
            {token.name ?? 'Unnamed Token'}
          </Text>
          {token.description && (
            <Text size="1" color="gray600">
              {token.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'secret',
      isDefault: true,
      header: 'Secret',
      render: token => <TokenSecret token={token} />
    },
    {
      id: 'groupRestrictions',
      isDefault: true,
      header: 'Group Restrictions',
      render: token => formatGroupRestrictions(token)
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: token => <RenderDate date={token.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: token => <RenderDate date={token.updatedAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Token ID',
      render: token => <ID id={token.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'active', label: 'Active' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'magicMcpGroupId',
      fields: ['magicMcpGroupId'],
      label: 'Group ID',
      description: 'Filter by group ID',
      type: 'string'
    }
  ])
  .actions({
    update: async (rows, state) => {
      let token = rows[0];
      if (!token) return;

      state.openUpdateModal(token.id);
    },
    restrictions: async (rows, state) => {
      let token = rows[0];
      if (!token) return;

      state.openRestrictionsModal(token);
    },
    delete: async (rows, state) => {
      let token = rows[0];
      if (!token) return;

      confirm({
        title: 'Delete Magic MCP token',
        description: 'Are you sure you want to delete this Magic MCP token?',
        confirmText: 'Delete',
        onConfirm: async () => {
          await state.deleteToken(token.id);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'update',
      label: 'Update Details',
      icon: <RiMoreLine />,
      disabled: token => token.status !== 'active',
      action: 'update'
    },
    {
      id: 'restrictions',
      label: 'Edit Restrictions',
      icon: <RiMoreLine />,
      disabled: token => token.status !== 'active',
      action: 'restrictions'
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      disabled: token => token.status !== 'active',
      action: 'delete'
    }
  ])
  .build();

let SecretWrapper = styled('div')`
  max-width: 300px;
  min-width: 150px;
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0px;
`;

let Code = styled('pre')`
  margin: 0;
  flex-shrink: 1;
  flex-grow: 1;

  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};

  word-break: break-all;
  word-wrap: break-word;
  white-space: pre-wrap;

  transition: all 0.2s;
`;

let Overlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: all 0.2s;
`;

let Action = styled('div')`
  display: flex;
  align-items: center;
  width: 30px;
  flex-shrink: 0;
`;

export let TokenSecret = ({
  token
}: {
  token: Pick<DashboardInstanceMagicMcpTokensGetOutput, 'secret'> | Pick<TokenRow, 'secret'>;
}) => {
  let secret = token.secret;
  let copy = useCopy(secret!);
  let [isRevealed, setIsRevealed] = useState(false);

  return (
    <SecretWrapper
      onClick={e => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <Code style={!secret || !isRevealed ? { filter: 'blur(10px)' } : {}}>{secret}</Code>

      <Action style={{ opacity: secret && isRevealed ? 1 : 0 }}>
        <Tooltip content="Copy Secret">
          <Button
            variant="outline"
            size="1"
            onClick={() => copy.copy()}
            disabled={!secret}
            iconRight={<RiClipboardLine />}
            success={copy.copied}
          />
        </Tooltip>
      </Action>

      <Overlay style={isRevealed ? { opacity: 0, pointerEvents: 'none' } : {}}>
        <div>
          <Button
            onClick={() => {
              setIsRevealed(true);
            }}
            variant="solid"
            size="1"
          >
            Reveal Secret
          </Button>
        </div>
      </Overlay>
    </SecretWrapper>
  );
};

export let MagicTokensTable = (filter: DashboardInstanceMagicMcpTokensListQuery = {}) => {
  let instance = useCurrentInstance();

  return magicTokensTable({
    instanceId: instance.data!.id,
    ...filter,
    emptyState: 'No Magic MCP tokens found.'
  });
};

export let createMagicMcpTokenModal = (opts?: { groupId?: string }) =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreateMagicMcpToken();
    let { groups, items } = useRestrictionOptions();
    let instance = useCurrentInstance();

    let form = useForm<
      Pick<DashboardInstanceMagicMcpTokensCreateBody, 'name' | 'description'> & {
        groupIds: string[];
      }
    >({
      initialValues: {
        name: '',
        description: '',
        groupIds: opts?.groupId ? [opts.groupId] : []
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          name: values.name,
          description: values.description || undefined,
          instanceId: instance.data!.id,
          groupIds: values.groupIds.length > 0 ? values.groupIds : undefined
        });

        if (!res) return;

        close();

        setTimeout(() => {
          if (res.secret) showCreatedTokenModal(res.secret);
        }, 100);
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string().optional(),
          groupIds: yup.array().of(yup.string().required()).defined()
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Magic MCP Token</Dialog.Title>
        <Dialog.Description>
          Create a new Magic MCP token to connect to Magic MCP servers. Select one or more
          groups to restrict the token, or leave all groups unchecked to keep it unrestricted.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <Text size="2" weight="strong" style={{ display: 'block', marginBottom: 8 }}>
            Group Restrictions
          </Text>

          {groups.isLoading ? (
            <Text size="2" color="gray600">
              Loading groups...
            </Text>
          ) : (
            <GroupRestrictionsField
              groups={items}
              selectedGroupIds={form.values.groupIds}
              setSelectedGroupIds={value => form.setFieldValue('groupIds', value)}
              emptyText="No Magic MCP groups are available yet. You can create an unrestricted token now and add restrictions later."
            />
          )}

          <Spacer height={15} />

          <Dialog.Actions>
            <Button size="1" variant="soft" onClick={close} type="button">
              Cancel
            </Button>
            <Button size="1" type="submit" loading={mutator.isPending}>
              Create
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
