import { capitalize } from '@metorial/case';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { ApiKeysFilter, MetorialApiKey, useRevealableApiKey } from '@metorial/state';
import {
  Badge,
  Button,
  confirm,
  Copy,
  DatePicker,
  Dialog,
  Flex,
  Input,
  Menu,
  RenderDate,
  Select,
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
import { subDays } from 'date-fns';
import { useState } from 'react';
import styled from 'styled-components';
import { useNow } from '../../../../hooks/useNow';
import { useApiKeysWithAutoInit } from './useApiKeysWithAutoInit';

export let ApiKeysScene = ({
  filter,
  header,
  extra
}: {
  filter: ApiKeysFilter;
  header: {
    title: string;
    description: string;
  };
  extra?: React.ReactNode;
}) => {
  let name = {
    organization_management_token: 'Organization Token',
    user_auth_token: 'User Access Token',
    instance_access_token: 'API Key'
  }[filter.type];

  let apiKeys = useApiKeysWithAutoInit(filter);

  let createApiKeyModal = () =>
    showModal(({ dialogProps, close }) => {
      let mutator = apiKeys.createMutator();

      let form = useForm({
        initialValues: {
          name: '',
          description: '',
          expiresAt: undefined,
          type: {
            organization_management_token: 'organization_management_token' as const,
            user_auth_token: 'organization_management_token' as const, // user_auth_token don't exist anymore
            instance_access_token: 'instance_access_token_secret' as const
          }[filter.type] as
            | 'organization_management_token'
            | 'instance_access_token_secret'
            | 'instance_access_token_publishable'
        },
        onSubmit: async values => {
          let [res] = await mutator.mutate({
            type: values.type,
            instanceId:
              filter.type === 'instance_access_token' ? filter.instanceId : undefined,
            organizationId:
              filter.type === 'organization_management_token'
                ? filter.organizationId
                : undefined,

            name: values.name,
            description: values.description,
            expiresAt: values.expiresAt
          } as any);

          if (res) {
            close();

            setTimeout(() => {
              if (res && res.secret) {
                showModal(({ dialogProps, close }) => {
                  return (
                    <Dialog.Wrapper variant="padded" {...dialogProps}>
                      <Dialog.Title>{name} Created</Dialog.Title>
                      <Dialog.Description>
                        Your new {name} is ready to use. Please don't share it with anyone and
                        keep it in a safe place, such as a password manager. You won't be able
                        to see it again.
                      </Dialog.Description>

                      <Copy label={name} value={res.secret ?? '...'} />

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
            description: yup.string(),
            expiresAt: yup
              .date()
              .optional()
              .min(new Date(), 'Expires at must be in the future'),
            type: yup
              .string()
              .oneOf([
                'organization_management_token',
                'instance_access_token_secret',
                'instance_access_token_publishable'
              ])
          }) as any
      });

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Create {name}</Dialog.Title>
          <Dialog.Description>Create a new {name} for the application.</Dialog.Description>

          <form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer height={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer height={15} />

            <DatePicker
              label="Expires At"
              type="single"
              value={form.values.expiresAt}
              onChange={v => form.setFieldValue('expiresAt', v)}
              resettable
            />
            <form.RenderError field="expiresAt" />

            {filter.type === 'instance_access_token' && (
              <>
                <Spacer height={15} />

                <Select
                  label="Type"
                  value={form.values.type}
                  items={[
                    { id: 'instance_access_token_secret', label: 'Secret' },
                    { id: 'instance_access_token_publishable', label: 'Publishable' }
                  ]}
                  onChange={v => form.setFieldValue('type', v)}
                />
                <form.RenderError field="type" />
              </>
            )}

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

  let updateApiKeyModal = ({ apiKeyId }: { apiKeyId: string }) =>
    showModal(({ dialogProps, close }) => {
      let apiKey = apiKeys.data?.find(k => k.id === apiKeyId);
      let mutator = apiKeys.updateMutator();

      let form = useForm({
        initialValues: {
          name: apiKey?.name ?? undefined,
          description: apiKey?.description ?? undefined,
          expiresAt: apiKey?.expiresAt ?? undefined,
          type: apiKey?.type ?? undefined
        },
        onSubmit: async values => {
          let [res] = await mutator.mutate({
            ...values,
            apiKeyId
          });
          if (res) close();
        },
        schema: yup =>
          yup.object().shape({
            name: yup.string().required('Name is required'),
            description: yup.string(),
            expiresAt: yup
              .date()
              .optional()
              .min(new Date(), 'Expires at must be in the future'),
            type: yup.string().oneOf(['publishable', 'secret'])
          }) as any
      });

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Update {name}</Dialog.Title>
          <Dialog.Description>Update the {name} details.</Dialog.Description>

          <form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer height={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer height={15} />

            <DatePicker
              label="Expires At"
              type="single"
              value={form.values.expiresAt}
              onChange={v => form.setFieldValue('expiresAt', v)}
              resettable
            />
            <form.RenderError field="expiresAt" />

            <Spacer height={15} />

            <Select
              label="Type"
              value={form.values.type}
              items={[
                { id: 'secret', label: 'Secret' },
                { id: 'publishable', label: 'Publishable' }
              ]}
              onChange={v => form.setFieldValue('type', v)}
            />
            <form.RenderError field="type" />

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

  let rotateApiKeyModal = ({ apiKeyId }: { apiKeyId: string }) =>
    showModal(({ dialogProps, close }) => {
      let mutator = apiKeys.rotateMutator();
      let [remainsValidForSeconds, setRemainsValidForSeconds] = useState('0');

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Rotate {name}</Dialog.Title>

          <Dialog.Description>
            Rotating your {name} will invalidate the current secret and generate a new one. You
            can configure a buffer time for which both the old and new keys will be valid. This
            gives you time to update your applications with the new key.
          </Dialog.Description>

          <Select
            value={remainsValidForSeconds}
            onChange={v => setRemainsValidForSeconds(v)}
            items={[
              { id: '0', label: 'Revoke immediately' },
              { id: '60', label: '1 minute' },
              { id: '300', label: '5 minutes' },
              { id: '3600', label: '1 hour' },
              { id: '86400', label: '1 day' }
            ]}
          />

          <Spacer height={15} />

          <Dialog.Actions>
            <Button onClick={close}>Close</Button>

            <Button
              onClick={async () => {
                let [res] = await mutator.mutate({
                  apiKeyId,
                  currentExpiresAt: new Date(
                    Date.now() + Number(remainsValidForSeconds) * 1000
                  )
                });
                if (!res) return;

                close();

                if (res) {
                  setTimeout(() => {
                    showModal(({ dialogProps, close }) => {
                      return (
                        <Dialog.Wrapper {...dialogProps} variant="padded">
                          <Dialog.Title>{name} Rotated</Dialog.Title>
                          <Dialog.Description>
                            A new secret has been generated for your {name}. Please keep it in
                            a safe place, such as a password manager. You won't be able to see
                            it again.
                          </Dialog.Description>

                          <Copy label={name} value={res.secret ?? 'xxx'} />

                          <Spacer height={15} />

                          <Dialog.Actions>
                            <Button onClick={close}>Close</Button>
                          </Dialog.Actions>
                        </Dialog.Wrapper>
                      );
                    });
                  }, 100);
                }
              }}
            >
              Rotate
            </Button>
          </Dialog.Actions>
        </Dialog.Wrapper>
      );
    });

  let deleteApiKeyMutation = apiKeys.revokeMutator();
  let deleteApiKeyModal = ({ apiKeyId }: { apiKeyId: string }) =>
    confirm({
      title: `Delete ${name}`,
      description: `Are you sure you want to delete this ${name}?`,
      confirmText: `Delete`,
      onConfirm: async () => {
        let [res] = await deleteApiKeyMutation.mutate({
          apiKeyId
        });
        if (res) toast.success(`${name} deleted successfully`);
      }
    });

  let sevenDaysAgo = subDays(new Date(), 7);

  return (
    <>
      {renderWithLoader({ apiKeys, creating: apiKeys.creatingInitialApplication })(
        ({ apiKeys }) => (
          <>
            <PageHeader
              title={header.title}
              description={header.description}
              actions={
                <Button size="2" onClick={() => createApiKeyModal()}>
                  Create {name}
                </Button>
              }
            />

            {extra && <div>{extra}</div>}

            <Table
              headers={['Status', 'Type', 'Name', 'Secret', 'Expires', 'Last Used', ' ']}
              padding={{ sides: '20px' }}
              data={apiKeys.data
                .filter(
                  apiKey =>
                    apiKey.status == 'active' ||
                    (apiKey.deletedAt && apiKey.deletedAt > sevenDaysAgo) ||
                    (apiKey.expiresAt && apiKey.expiresAt > sevenDaysAgo)
                )
                .map(apiKey => [
                  <Badge size="1" color={apiKey.status == 'active' ? 'green' : 'gray'}>
                    {capitalize(apiKey.status)}
                  </Badge>,
                  <Badge
                    size="1"
                    color={apiKey.type.includes('publishable') ? 'blue' : 'purple'}
                  >
                    {{
                      organization_management_token: 'Admin Token',
                      user_auth_token: 'User Token',
                      instance_access_token_secret: 'Secret Key',
                      instance_access_token_publishable: 'Publishable Key'
                    }[apiKey.type] ?? apiKey.type}
                  </Badge>,
                  <Flex gap={3} direction="column">
                    <Text size="2" weight="strong">
                      {apiKey.name}
                    </Text>
                    <Text size="1" color="gray600" truncate>
                      {apiKey.description}
                    </Text>
                  </Flex>,
                  <ApiKeySecret apiKey={apiKey} />,
                  apiKey.expiresAt ? <RenderDate date={apiKey.expiresAt} /> : 'Never',
                  apiKey.lastUsedAt ? <RenderDate date={apiKey.lastUsedAt} /> : 'Never',

                  <Menu
                    items={[
                      {
                        id: 'update',
                        label: 'Update',
                        disabled: apiKey.status != 'active'
                      },
                      {
                        id: 'delete',
                        label: 'Delete',
                        disabled: apiKey.status != 'active'
                      },
                      {
                        id: 'rotate',
                        label: 'Rotate',
                        disabled: apiKey.status != 'active'
                      }
                    ]}
                    onItemClick={item => {
                      if (item == 'update')
                        updateApiKeyModal({
                          apiKeyId: apiKey.id
                        });
                      if (item == 'delete')
                        deleteApiKeyModal({
                          apiKeyId: apiKey.id
                        });
                      if (item == 'rotate')
                        rotateApiKeyModal({
                          apiKeyId: apiKey.id
                        });
                    }}
                  >
                    <Button
                      size="1"
                      variant="outline"
                      iconLeft={<RiMoreLine />}
                      title="Open API key options"
                    />
                  </Menu>
                ])}
            />

            {apiKeys.data.length == 0 && (
              <>
                <Spacer height={10} />
                <Text size="2" color="gray600" align="center">
                  No {name} found. Create one to get started.
                </Text>
              </>
            )}
          </>
        )
      )}
    </>
  );
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

export let ApiKeySecret = ({ apiKey }: { apiKey: MetorialApiKey }) => {
  let reveal = useRevealableApiKey({
    apiKeyId: apiKey.id
  });

  let secret = reveal.value ?? apiKey.secret;
  let copy = useCopy(secret!);

  let now = useNow();
  let canReveal =
    apiKey.revealInfo && (apiKey.revealInfo.forever || apiKey.revealInfo.until > now);

  return (
    <SecretWrapper>
      {canReveal || secret ? (
        <>
          <Code style={!secret ? { filter: 'blur(10px)' } : {}}>
            {secret ?? apiKey.secretRedactedLong}
          </Code>

          <Action style={{ opacity: secret ? 1 : 0 }}>
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
        </>
      ) : (
        <Code>{apiKey.secretRedacted}</Code>
      )}

      <Overlay style={secret || !canReveal ? { opacity: 0, pointerEvents: 'none' } : {}}>
        <div>
          <Button
            onClick={() => {
              reveal.reveal();
            }}
            variant="solid"
            loading={reveal.isLoading || !!reveal.value}
            size="1"
          >
            Reveal Secret
          </Button>
        </div>
      </Overlay>
    </SecretWrapper>
  );
};
