import {
  ApiKeysCreateBody,
  ApiKeysGetOutput,
  ApiKeysUpdateBody
} from '@metorial/dashboard-sdk';
import { col, createDataList, defineAction, defineStatus, f } from '@metorial/data-list';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { ApiKeysFilter, useCurrentOrganization, useRevealableApiKey } from '@metorial/state';
import {
  Badge,
  Button,
  confirm,
  Copy,
  DatePicker,
  Dialog,
  Input,
  Select,
  showModal,
  Spacer,
  TextArrayInput,
  theme,
  toast,
  Tooltip,
  useCopy
} from '@metorial/ui';
import { useNow } from '@metorial/use-now';
import { RiClipboardLine } from '@remixicon/react';
import { getVisibleApiKeys } from './visibleApiKeys';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useApiKeysWithAutoInit } from './useApiKeysWithAutoInit';

type ApiKeyType = ApiKeysGetOutput['type'];
type InstanceApiKeyType = Exclude<ApiKeyType, 'organization_management_token'>;
type InstanceApiKeysFilter = Extract<ApiKeysFilter, { type: 'instance_access_token' }>;

let normalizeOptionalString = (value: string | undefined) => value || undefined;
let normalizeIpFilters = (value: string[] | undefined) =>
  Array.from(new Set((value ?? []).map(item => item.trim()).filter(Boolean)));

let isInstanceApiKeyType = (value: string): value is InstanceApiKeyType =>
  value === 'instance_access_token_secret' || value === 'instance_access_token_publishable';

let getApiKeyTypeLabel = (type: ApiKeyType) => {
  switch (type) {
    case 'organization_management_token':
      return 'Admin Token';
    case 'instance_access_token_secret':
      return 'Secret Key';
    case 'instance_access_token_publishable':
      return 'Publishable Key';
  }
};

export let ApiKeysScene = ({
  filter,
  header,
  extra,
  tableLayout
}: {
  filter: InstanceApiKeysFilter;
  header: {
    title: string;
    description: string;
  };
  extra?: React.ReactNode;
  tableLayout?: 'product';
}) => {
  let name = 'API Key';
  let apiKeyTypeItems: Array<{ id: InstanceApiKeyType; label: string }> = [
    {
      id: 'instance_access_token_secret',
      label: getApiKeyTypeLabel('instance_access_token_secret')
    },
    {
      id: 'instance_access_token_publishable',
      label: getApiKeyTypeLabel('instance_access_token_publishable')
    }
  ];

  let apiKeys = useApiKeysWithAutoInit(filter);
  let org = useCurrentOrganization();

  let createApiKeyModal = () =>
    showModal(({ dialogProps, close }) => {
      let mutator = apiKeys.createMutator();

      let form = useForm({
        initialValues: {
          name: '',
          description: '',
          expiresAt: undefined,
          type: 'instance_access_token_secret' as InstanceApiKeyType
        },
        onSubmit: async values => {
          let [res] = await mutator.mutate({
            type: values.type,
            instanceId: filter.instanceId,
            name: values.name,
            description: normalizeOptionalString(values.description),
            expiresAt: values.expiresAt
          } satisfies ApiKeysCreateBody);

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
          yup.object({
            name: yup.string().trim().required('Name is required'),
            description: yup.string().optional(),
            expiresAt: yup
              .date()
              .optional()
              .min(new Date(), 'Expires at must be in the future'),
            type: yup
              .mixed<InstanceApiKeyType>()
              .oneOf(['instance_access_token_secret', 'instance_access_token_publishable'])
              .required('Type is required')
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

            <Spacer height={15} />

            <Select
              label="Type"
              value={form.values.type}
              items={apiKeyTypeItems}
              onChange={v => {
                if (isInstanceApiKeyType(v)) {
                  form.setFieldValue('type', v);
                }
              }}
            />
            <form.RenderError field="type" />

            <Spacer height={15} />

            <Dialog.Actions>
              <Button
                size="1"
                variant="soft"
                onClick={close}
                type="button"
                disabled={mutator.isLoading}
              >
                Cancel
              </Button>
              <Button
                size="1"
                type="submit"
                loading={mutator.isLoading}
                success={mutator.isSuccess}
              >
                Create
              </Button>
            </Dialog.Actions>
            <mutator.RenderError />
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
          description: apiKey?.description ?? '',
          expiresAt: apiKey?.expiresAt ?? undefined,
          ipFilters: apiKey?.ipFilters ?? [],
          type: apiKey?.type ?? undefined
        },
        onSubmit: async values => {
          let [res] = await mutator.mutate({
            apiKeyId,
            name: values.name,
            description: normalizeOptionalString(values.description),
            expiresAt: values.expiresAt,
            ipFilters: normalizeIpFilters(values.ipFilters)
          } satisfies ApiKeysUpdateBody & { apiKeyId: string });
          if (res) close();
        },
        schema: yup =>
          yup.object({
            name: yup.string().trim().required('Name is required'),
            description: yup.string().optional(),
            expiresAt: yup
              .date()
              .optional()
              .min(new Date(), 'Expires at must be in the future'),
            ipFilters: yup.array(yup.string().trim()).required(),
            type: yup
              .mixed<InstanceApiKeyType>()
              .oneOf(['instance_access_token_secret', 'instance_access_token_publishable'])
              .optional()
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

            <TextArrayInput
              label="IP Filters"
              description="Optional allow list of IP addresses or CIDR ranges that can use this API key."
              placeholder="203.0.113.10 or 10.0.0.0/24"
              value={form.values.ipFilters}
              onChange={v => form.setFieldValue('ipFilters', v)}
            />
            <form.RenderError field="ipFilters" />

            <Spacer height={15} />

            <Select
              label="Type"
              value={form.values.type ?? ''}
              items={apiKeyTypeItems}
              onChange={v => {
                if (isInstanceApiKeyType(v)) {
                  form.setFieldValue('type', v);
                }
              }}
            />
            <form.RenderError field="type" />

            <Spacer height={15} />

            <Dialog.Actions>
              <Button
                size="1"
                variant="soft"
                onClick={close}
                type="button"
                disabled={mutator.isLoading}
              >
                Cancel
              </Button>
              <Button
                size="1"
                type="submit"
                loading={mutator.isLoading}
                success={mutator.isSuccess}
              >
                Update
              </Button>
            </Dialog.Actions>
            <mutator.RenderError />
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
            <Button onClick={close} disabled={mutator.isLoading}>
              Close
            </Button>

            <Button
              loading={mutator.isLoading}
              success={mutator.isSuccess}
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
          <mutator.RenderError />
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

  return (
    <>
      {renderWithLoader({ apiKeys, creating: apiKeys.creatingInitialApplication })(
        ({ apiKeys }) => (
          <>
            <PageHeader
              title={header.title}
              description={header.description}
              actions={
                org.data?.member?.role == 'admin' && (
                  <Button size="2" onClick={() => createApiKeyModal()}>
                    Create {name}
                  </Button>
                )
              }
            />

            {extra && <div>{extra}</div>}

            <ApiKeysTable
              items={apiKeys.data}
              layout={tableLayout}
              canManage={org.data?.member?.role === 'admin'}
              onUpdate={apiKeyId => updateApiKeyModal({ apiKeyId })}
              onDelete={apiKeyId => deleteApiKeyModal({ apiKeyId })}
              onRotate={apiKeyId => rotateApiKeyModal({ apiKeyId })}
            />
          </>
        )
      )}
    </>
  );
};

type ApiKeysTableProps = {
  items: ApiKeysGetOutput[];
  compact?: boolean;
  layout?: 'product';
  canManage?: boolean;
  onUpdate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRotate?: (id: string) => void;
};

let apiKeyStatus = defineStatus({
  active: { label: 'Active', color: 'green' },
  deleted: { label: 'Deleted', color: 'gray' }
});

let apiKeyTypeFilterOptions = [
  {
    id: 'instance_access_token_secret',
    label: getApiKeyTypeLabel('instance_access_token_secret')
  },
  {
    id: 'instance_access_token_publishable',
    label: getApiKeyTypeLabel('instance_access_token_publishable')
  }
] as const;

let createApiKeysList = (opts: { name: string; compact?: boolean; manage?: boolean }) =>
  createDataList<ApiKeysTableProps>(opts.name)
    .filters(() => ({
      status: f.status(apiKeyStatus),
      type: f.select('type', 'Type', apiKeyTypeFilterOptions)
    }))
    .search('Search API keys…')
    .items(
      ({ props, filters }) => {
        let visible = useMemo(() => getVisibleApiKeys(props.items), [props.items]);

        let items = useMemo(
          () =>
            visible.filter(
              apiKey =>
                (!filters.status || filters.status.includes(apiKey.status)) &&
                (!filters.type || filters.type.includes(apiKey.type as any))
            ),
          [visible, filters.status, filters.type]
        );

        return { items };
      },
      { pageSize: 25, searchFields: row => [row.name, row.description, row.id] }
    )
    .columns([
      ...(opts.compact
        ? []
        : [col.status<ApiKeysGetOutput, 'active' | 'deleted'>(apiKeyStatus)]),
      col.custom<ApiKeysGetOutput>({
        id: 'type',
        header: 'Type',
        render: apiKey => (
          <Badge size="2" color={apiKey.type.includes('publishable') ? 'blue' : 'purple'}>
            {getApiKeyTypeLabel(apiKey.type)}
          </Badge>
        )
      }),
      col.name<ApiKeysGetOutput>(),
      col.custom<ApiKeysGetOutput>({
        id: 'secret',
        header: 'Secret',
        render: apiKey => <ApiKeySecret apiKey={apiKey} />
      }),
      col.date<ApiKeysGetOutput>('expiresAt', {
        id: 'expires',
        header: 'Expires',
        isDefault: true,
        fallback: 'Never'
      }),
      col.date<ApiKeysGetOutput>('lastUsedAt', {
        id: 'last-used',
        header: 'Last Used',
        isDefault: true,
        fallback: 'Never'
      })
    ])
    .itemActions(
      opts.manage
        ? [
            defineAction<ApiKeysGetOutput, ApiKeysTableProps>({
              id: 'update',
              label: 'Update',
              disabled: apiKey => apiKey.status != 'active',
              useRun:
                ({ props }) =>
                apiKey =>
                  props.onUpdate?.(apiKey.id)
            }),
            defineAction<ApiKeysGetOutput, ApiKeysTableProps>({
              id: 'delete',
              label: 'Delete',
              destructive: true,
              disabled: apiKey => apiKey.status != 'active',
              useRun:
                ({ props }) =>
                apiKey =>
                  props.onDelete?.(apiKey.id)
            }),
            defineAction<ApiKeysGetOutput, ApiKeysTableProps>({
              id: 'rotate',
              label: 'Rotate',
              disabled: apiKey => apiKey.status != 'active',
              useRun:
                ({ props }) =>
                apiKey =>
                  props.onRotate?.(apiKey.id)
            })
          ]
        : []
    )
    .build();

let ManagedApiKeysList = createApiKeysList({ name: 'instance-api-keys', manage: true });
let ReadOnlyApiKeysList = createApiKeysList({ name: 'instance-api-keys' });
let CompactApiKeysList = createApiKeysList({
  name: 'instance-api-keys-preview',
  compact: true
});

export let ApiKeysTable = ({
  compact,
  canManage,
  layout: _layout,
  ...props
}: ApiKeysTableProps) => {
  if (compact) {
    return (
      <CompactApiKeysList
        {...props}
        listVariant="preview"
        listLimit={5}
        emptyState="No API keys found."
      />
    );
  }

  let List = canManage ? ManagedApiKeysList : ReadOnlyApiKeysList;

  return <List {...props} emptyState="No API keys found. Create one to get started." />;
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

export let ApiKeySecret = ({ apiKey }: { apiKey: ApiKeysGetOutput }) => {
  let reveal = useRevealableApiKey({
    apiKeyId: apiKey.id
  });
  let org = useCurrentOrganization();

  let secret = reveal.value ?? apiKey.secret;
  let copy = useCopy(secret!);

  let now = useNow();
  let canReveal =
    apiKey.revealInfo &&
    (apiKey.revealInfo.forever || (apiKey.revealInfo.until && apiKey.revealInfo.until > now));

  let [isRevealed, setIsRevealed] = useState(false);

  return (
    <SecretWrapper>
      {canReveal || secret ? (
        <>
          <Code style={!secret || !isRevealed ? { filter: 'blur(10px)' } : {}}>
            {secret ?? apiKey.secretRedactedLong}
          </Code>

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
        </>
      ) : (
        <Code>{apiKey.secretRedacted}</Code>
      )}

      <Overlay
        style={
          !canReveal || (isRevealed && secret) ? { opacity: 0, pointerEvents: 'none' } : {}
        }
      >
        <div>
          <Button
            onClick={() => {
              setIsRevealed(true);
              if (!secret) reveal.reveal();
            }}
            variant="solid"
            loading={isRevealed && (reveal.isLoading || !!reveal.value)}
            size="1"
            disabled={org.data?.member?.role != 'admin'}
          >
            Reveal Secret
          </Button>
        </div>
      </Overlay>
    </SecretWrapper>
  );
};
