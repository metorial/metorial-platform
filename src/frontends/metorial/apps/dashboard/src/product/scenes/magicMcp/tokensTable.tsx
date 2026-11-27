import {
  DashboardInstanceMagicMcpGroupsListOutput,
  DashboardInstanceMagicMcpTokensGetOutput,
  DashboardInstanceMagicMcpTokensListOutput,
  DashboardInstanceMagicMcpTokensListQuery
} from '@metorial/dashboard-sdk';
import { useForm, useMutation } from '@metorial/data-hooks';
import {
  col,
  createDataList,
  defineAction,
  deleteAction,
  f,
  lifecycleStatus,
  withDefaults
} from '@metorial/data-list';
import {
  magicMcpTokensLoader,
  useCreateMagicMcpToken,
  useCurrentInstance,
  useMagicMcpGroups,
  useMagicMcpToken,
  useMagicMcpTokens,
  withAuth
} from '@metorial/state';
import {
  Badge,
  Button,
  Checkbox,
  Copy,
  Dialog,
  Flex,
  Input,
  showModal,
  Spacer,
  Text,
  theme,
  toast,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { RiClipboardLine, RiEditLine, RiLockLine } from '@remixicon/react';
import { useMemo, useState, type ComponentProps } from 'react';
import styled from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';

export type TokenRow = DashboardInstanceMagicMcpTokensListOutput['items'][number];
type MagicMcpGroupRow = DashboardInstanceMagicMcpGroupsListOutput['items'][number];

export let formatGroupRestrictions = (token: Pick<TokenRow, 'groups'>) => {
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
        <Badge key={group.id} size="2" color="gray">
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
                  : (group.description ?? group.slug)
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
        Your new Magic MCP token is ready to use. Please don't share it with anyone and keep it
        in a safe place, such as a password manager.
      </Dialog.Description>

      <Copy label="Magic MCP Token" value={secret} />

      <Spacer height={15} />

      <Dialog.Actions>
        <Button onClick={close}>Close</Button>
      </Dialog.Actions>
    </Dialog.Wrapper>
  ));

export let showManageRestrictionsModal = (p: { token: TokenRow }) =>
  showModal(({ dialogProps, close }) => {
    let instance = useCurrentInstance();
    let token = useMagicMcpToken(instance.data?.id, p.token.id);
    let addGroupsMutator = token.useAddGroupsMutator();
    let removeGroupsMutator = token.useRemoveGroupsMutator();
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
          Restrict this token to specific Magic MCP groups. Leave all groups unchecked to keep
          the token unrestricted.
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
                  magicMcpGroupIds: groupsToAdd
                });
                if (!res) didSucceed = false;
              }

              if (didSucceed && groupsToRemove.length > 0) {
                let [res] = await removeGroupsMutator.mutate({
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

export let updateTokenModal = ({
  tokenId,
  instanceId,
  token: initialToken
}: {
  tokenId: string;
  instanceId: string;
  token?: Pick<TokenRow, 'name' | 'description'>;
}) =>
  showModal(({ dialogProps, close }) => {
    let token = useMagicMcpToken(instanceId, tokenId);
    let mutator = token.useUpdateMutator();
    let current = initialToken ?? token.data;

    let form = useForm({
      initialValues: {
        name: current?.name ?? undefined,
        description: current?.description ?? undefined
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate(values);
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
            <Button size="2" variant="soft" onClick={close} type="button">
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

let useDeleteMagicMcpToken = () =>
  useMutation(
    (i: { instanceId: string; magicMcpTokenId: string }) =>
      withAuth(sdk => sdk.magicMcp.tokens.delete(i.instanceId, i.magicMcpTokenId)),
    { onSuccess: () => void magicMcpTokensLoader.refetchAll() }
  );

export let magicTokenActions = [
  defineAction<TokenRow, any, { instanceId?: string }>({
    id: 'update',
    label: 'Update Details',
    icon: <RiEditLine />,
    disabled: row => row.status !== 'active',
    useRun:
      ({ ctx }) =>
      row => {
        updateTokenModal({ tokenId: row.id, instanceId: ctx.instanceId!, token: row });
      }
  }),
  defineAction<TokenRow, any, { instanceId?: string }>({
    id: 'restrictions',
    label: 'Edit Restrictions',
    icon: <RiLockLine />,
    disabled: row => row.status !== 'active',
    useRun: () => row => {
      showManageRestrictionsModal({ token: row });
    }
  }),
  deleteAction<TokenRow, any, { instanceId?: string }>({
    noun: 'Token',
    name: row => row.name,
    disabled: row => row.status !== 'active',
    useMutate: () => useDeleteMagicMcpToken(),
    input: (row, { ctx }) => ({ instanceId: ctx.instanceId!, magicMcpTokenId: row.id })
  })
];

let MagicTokensList = createDataList<DashboardInstanceMagicMcpTokensListQuery>(
  'magic-mcp-tokens'
)
  .context(useInstanceContext)
  .filters((_props, ctx) => ({
    status: f.status(lifecycleStatus, { only: ['active', 'deleted'] }),
    magicMcpGroupId: f.entity(entityFilters.magicMcpGroup(ctx.instanceId))
  }))
  .paginated(({ props, ctx, filters, limit }) =>
    useMagicMcpTokens(
      ctx.instanceId,
      withDefaults(
        {
          order: props.order ?? 'asc',
          status: props.status,
          magicMcpGroupId: props.magicMcpGroupId,
          magicMcpServerId: props.magicMcpServerId,
          magicMcpEndpointId: props.magicMcpEndpointId,
          limit: props.limit
        },
        { ...filters, limit }
      )
    )
  )
  .columns([
    col.status(lifecycleStatus),
    col.name({ fallback: 'Unnamed Token' }),
    col.custom({ id: 'secret', header: 'Secret', render: row => <TokenSecret token={row} /> }),
    col.custom({
      id: 'groupRestrictions',
      header: 'Group Restrictions',
      render: row => formatGroupRestrictions(row)
    }),
    col.createdAt(),
    col.updatedAt(),
    col.id({ header: 'Token ID' })
  ])
  .itemActions(magicTokenActions)
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

export let MagicTokensTable = (props: ComponentProps<typeof MagicTokensList>) => (
  <MagicTokensList emptyState="No Magic MCP tokens found." {...props} />
);

export let createMagicMcpTokenModal = (opts?: { groupId?: string }) =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreateMagicMcpToken();
    let { groups, items } = useRestrictionOptions();
    let instance = useCurrentInstance();

    let form = useForm({
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
          magicMcpGroupIds: values.groupIds.length > 0 ? values.groupIds : undefined
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
