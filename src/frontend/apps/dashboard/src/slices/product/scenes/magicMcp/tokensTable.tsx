import {
  DashboardInstanceMagicMcpTokensGetOutput,
  DashboardInstanceMagicMcpTokensListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreateMagicMcpToken,
  useCurrentInstance,
  useMagicMcpTokens
} from '@metorial/state';
import {
  Badge,
  Button,
  confirm,
  Copy,
  Dialog,
  Input,
  Menu,
  RenderDate,
  showModal,
  Spacer,
  Text,
  theme,
  toast,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiClipboardLine, RiMoreLine } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';

export let MagicTokensTable = (filter: DashboardInstanceMagicMcpTokensListQuery) => {
  let instance = useCurrentInstance();
  let tokens = useMagicMcpTokens(instance.data?.id, {
    ...filter,
    order: filter.order ?? 'desc'
  });

  let deleteTokenMutation = tokens.revokeMutator();
  let deleteTokenModal = ({ tokenId }: { tokenId: string }) =>
    confirm({
      title: `Delete Magic MCP token`,
      description: `Are you sure you want to delete this Magic MCP token?`,
      confirmText: `Delete`,
      onConfirm: async () => {
        let [res] = await deleteTokenMutation.mutate({
          magicMcpTokenId: tokenId
        });
        if (res) toast.success(`Magic MCP token deleted`);
      }
    });

  let updateTokenModal = ({ tokenId }: { tokenId: string }) =>
    showModal(({ dialogProps, close }) => {
      let token = tokens.data?.items?.find(k => k.id === tokenId);
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

  return renderWithPagination(tokens)(tokens => (
    <>
      <Table
        headers={['Status', 'Name', 'Secret', 'Created', '']}
        data={tokens.data.items.map(token => ({
          data: [
            {
              active: (
                <Badge size="1" color="green">
                  Active
                </Badge>
              ),
              deleted: (
                <Badge size="1" color="red">
                  Revoked
                </Badge>
              )
            }[token.status],
            <div>
              <Text size="2" weight="strong">
                {token.name}
              </Text>
              {token.description && (
                <Text size="1" color="gray600">
                  {token.description}
                </Text>
              )}
            </div>,
            <TokenSecret token={token} />,
            <RenderDate date={token.createdAt} />,

            <Menu
              items={[
                {
                  id: 'update',
                  label: 'Update',
                  disabled: token.status != 'active'
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  disabled: token.status != 'active'
                }
              ]}
              onItemClick={item => {
                if (item == 'update')
                  updateTokenModal({
                    tokenId: token.id
                  });
                if (item == 'delete')
                  deleteTokenModal({
                    tokenId: token.id
                  });
              }}
            >
              <Button
                size="1"
                variant="outline"
                iconLeft={<RiMoreLine />}
                title="Open token options"
              />
            </Menu>
          ]
        }))}
      />

      {tokens.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No Magic MCP tokens found.
        </Text>
      )}
    </>
  ));
};

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

export let TokenSecret = ({ token }: { token: DashboardInstanceMagicMcpTokensGetOutput }) => {
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
            onClick={e => {
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

export let createMagicMcpTokenModal = () =>
  showModal(({ dialogProps, close }) => {
    let mutator = useCreateMagicMcpToken();
    let instance = useCurrentInstance();

    let form = useForm({
      initialValues: {
        name: '',
        description: ''
      },
      onSubmit: async values => {
        let [res] = await mutator.mutate({
          name: values.name,
          description: values.description,
          instanceId: instance.data!.id
        });

        if (res) {
          close();

          setTimeout(() => {
            if (res && res.secret) {
              showModal(({ dialogProps, close }) => {
                return (
                  <Dialog.Wrapper variant="padded" {...dialogProps}>
                    <Dialog.Title>Magic MCP Token Created</Dialog.Title>
                    <Dialog.Description>
                      Your new Magic MCP token is ready to use. Please don't share it with
                      anyone and keep it in a safe place, such as a password manager. You won't
                      be able to see it again.
                    </Dialog.Description>

                    <Copy label="Magic MCP Token" value={res.secret ?? '...'} />

                    <Spacer height={15} />

                    <Dialog.Actions>
                      <Button onClick={close}>Close</Button>
                    </Dialog.Actions>
                  </Dialog.Wrapper>
                );
              });
            }
          }, 100);
        }
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Magic MCP Token</Dialog.Title>
        <Dialog.Description>
          Create a new Magic MCP token for the application.
        </Dialog.Description>

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
              Create
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
