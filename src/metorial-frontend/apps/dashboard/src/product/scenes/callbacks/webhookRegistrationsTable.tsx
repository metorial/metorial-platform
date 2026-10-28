import { CodeEditor } from '@metorial/code-editor';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { Markdown } from '@metorial/markdown';
import {
  useCreateWebhookRegistration,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteWebhookRegistration,
  useProviderAuthCredentials,
  useSetupWebhookRegistration,
  useWebhookRegistrations,
  WebhookRegistrationPreview
} from '@metorial/state';
import {
  Table as DashboardTable,
  getConstrainedEnumListFilterValue,
  getListFilterValue,
  TableFilter,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import {
  Badge,
  Button,
  Callout,
  Combobox,
  confirm,
  Dialog,
  Input,
  Panel,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine, RiSettings3Line } from '@remixicon/react';
import { useMemo, useState } from 'react';
import {
  getJsonSchemaDefaultObject,
  getJsonSchemaObject,
  hasJsonSchemaProperties
} from '../../lib/jsonSchema';
import {
  getEmptyRequiredFieldLabels,
  getEmptyRequiredJsonStringFieldLabels,
  getInvalidJsonStringFieldLabels,
  JsonSchemaInput
} from '../jsonSchemaInput';
import { entityFilters } from '../entityFilters';
import { ProviderSelectionStep } from '../providerCreationPanel';
import {
  getWebhookRegistrationStatusColor,
  WEBHOOK_REGISTRATION_STATUS_LABELS
} from './shared';

let showCreateWebhookRegistrationModal = (p: {
  instanceId: string;
  provider?: { id: string; name: string };
  providerAuthCredentialsId?: string;
  onCreate: (created: { id: string }) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let [providerId, setProviderId] = useState(p.provider?.id ?? '');
    let [credentials, setCredentials] = useState<{ id: string; label: string } | null>(null);
    let createRegistration = useCreateWebhookRegistration();

    let form = useForm({
      initialValues: {
        name: p.provider ? `${p.provider.name} Webhook Receiver` : '',
        description: ''
      },
      onSubmit: async values => {
        if (!providerId) return;

        let [created] = await createRegistration.mutate({
          instanceId: p.instanceId,
          providerId,
          providerAuthCredentialsId: p.providerAuthCredentialsId ?? credentials?.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });

        if (!created) return;

        close();
        p.onCreate(created);

        showWebhookRegistrationSetupPanel({
          instanceId: p.instanceId,
          registration: created,
          onComplete: () => p.onCreate(created)
        });
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        })
    });

    return (
      <Panel.Wrapper {...dialogProps} width={900}>
        <Panel.Header>
          <Panel.Title>
            {p.provider
              ? `Set Up ${p.provider.name} Webhook Receiver`
              : 'Create Webhook Receiver'}
          </Panel.Title>
        </Panel.Header>

        <Panel.Content>
          {providerId ? (
            <form onSubmit={form.handleSubmit}>
              <Callout color="gray">
                Metorial will create a secure receive URL, then guide you through adding it to
                the provider and saving any required verification values.
              </Callout>

              <Spacer size={16} />

              <Input label="Name" required {...form.getFieldProps('name')} />
              <form.RenderError field="name" />

              <Spacer size={10} />

              <Input label="Description" {...form.getFieldProps('description')} />
              <form.RenderError field="description" />

              {!p.provider ? (
                <>
                  <Spacer size={10} />

                  <Combobox
                    label="App Credentials"
                    description="Pick the provider app this receiver belongs to. Leave empty to share the receiver across every app of the provider."
                    placeholder="Shared by all apps"
                    value={credentials?.id ?? null}
                    valueLabel={credentials?.label}
                    provider={({ searchQuery }) => {
                      let authCredentials = useProviderAuthCredentials(p.instanceId, {
                        providerId,
                        origin: 'custom',
                        status: 'active',
                        limit: 25,
                        search: searchQuery || undefined
                      });

                      return {
                        items: (authCredentials.data?.items ?? []).map(item => ({
                          id: item.id,
                          label: item.name ?? item.id
                        })),
                        isLoading: authCredentials.isLoading,
                        empty: searchQuery
                          ? 'No matching app credentials found.'
                          : 'No app credentials for this provider.'
                      };
                    }}
                    onChange={(value, item) =>
                      setCredentials(value && item ? { id: value, label: item.label } : null)
                    }
                  />
                </>
              ) : null}

              <Spacer size={18} />

              <Dialog.Actions>
                {p.provider ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={createRegistration.isLoading}
                    onClick={close}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={createRegistration.isLoading}
                    onClick={() => {
                      setProviderId('');
                      setCredentials(null);
                    }}
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  loading={createRegistration.isLoading}
                  success={createRegistration.isSuccess}
                >
                  Create Webhook Receiver
                </Button>
              </Dialog.Actions>

              <createRegistration.RenderError />
            </form>
          ) : (
            <ProviderSelectionStep
              instanceId={p.instanceId}
              emptyText="No providers support webhook receivers yet."
              providerListingsFilter={{ capabilities: { supportsWebhookRegistration: true } }}
              onSelect={setProviderId}
            />
          )}
        </Panel.Content>
      </Panel.Wrapper>
    );
  });

let getWebhookSetupSchemaFieldErrors = (p: {
  schema: ReturnType<typeof getJsonSchemaObject>;
  value: Record<string, unknown>;
}) => {
  let fieldErrors: Record<string, string> = {};

  for (let field of getEmptyRequiredFieldLabels({ schema: p.schema, value: p.value })) {
    fieldErrors[field] = `\`${field}\` is required before continuing.`;
  }

  for (let field of getEmptyRequiredJsonStringFieldLabels({
    schema: p.schema,
    value: p.value
  })) {
    fieldErrors[field] = `\`${field}\` is required before continuing.`;
  }

  for (let field of getInvalidJsonStringFieldLabels({ schema: p.schema, value: p.value })) {
    fieldErrors[field] = `\`${field}\` must contain valid JSON before continuing.`;
  }

  return fieldErrors;
};

let showWebhookRegistrationSetupPanel = (p: {
  instanceId: string;
  registration: WebhookRegistrationPreview;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let setupRegistration = useSetupWebhookRegistration();
    let isPending = p.registration.setup.status === 'pending';

    let hasSchema = hasJsonSchemaProperties(p.registration.setup.schema);
    let schemaObj = getJsonSchemaObject(p.registration.setup.schema);

    let [configValue, setConfigValue] = useState<Record<string, unknown>>(() =>
      getJsonSchemaDefaultObject(p.registration.setup.schema)
    );
    let [rawConfig, setRawConfig] = useState('{}');
    let [parseError, setParseError] = useState<string | null>(null);
    let [attemptedSubmit, setAttemptedSubmit] = useState(false);

    let schemaFieldErrors =
      hasSchema && attemptedSubmit
        ? getWebhookSetupSchemaFieldErrors({ schema: schemaObj, value: configValue })
        : {};

    let submit = async () => {
      let userConfig: Record<string, any>;

      if (hasSchema) {
        let fieldErrors = getWebhookSetupSchemaFieldErrors({
          schema: schemaObj,
          value: configValue
        });

        if (Object.keys(fieldErrors).length > 0) {
          setAttemptedSubmit(true);
          return;
        }

        userConfig = configValue;
      } else {
        try {
          userConfig = JSON.parse(rawConfig || '{}');
        } catch {
          setParseError('Enter valid JSON.');
          return;
        }

        if (
          typeof userConfig !== 'object' ||
          userConfig === null ||
          Array.isArray(userConfig)
        ) {
          setParseError('Setup values must be a JSON object.');
          return;
        }
      }

      setParseError(null);

      let [updated] = await setupRegistration.mutate({
        instanceId: p.instanceId,
        webhookRegistrationId: p.registration.id,
        userConfig
      });

      if (!updated) return;

      close();
      p.onComplete();
    };

    return (
      <Panel.Wrapper {...dialogProps} width={860}>
        <Panel.Header>
          <Panel.Title>{p.registration.name}</Panel.Title>
        </Panel.Header>

        <Panel.Content>
          {p.registration.setup.document ? (
            <Markdown>{p.registration.setup.document}</Markdown>
          ) : null}

          {isPending ? (
            <>
              <Spacer size={20} />

              {hasSchema ? (
                <>
                  <JsonSchemaInput
                    schema={schemaObj}
                    value={configValue}
                    onChange={setConfigValue}
                    fieldErrors={schemaFieldErrors}
                    variant="raw"
                  />
                </>
              ) : (
                <CodeEditor
                  label="Setup Values"
                  description="Provider-specific values from the instructions above, as JSON — for example a signing secret you copied out of the provider's dashboard."
                  height="180px"
                  lang="json"
                  border
                  value={rawConfig}
                  onChange={setRawConfig}
                />
              )}

              {parseError ? (
                <>
                  <Spacer size={8} />
                  <Text size="2" color="red600">
                    {parseError}
                  </Text>
                </>
              ) : null}

              <Spacer size={18} />

              <Dialog.Actions>
                <Button
                  type="button"
                  variant="outline"
                  disabled={setupRegistration.isLoading}
                  onClick={close}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={setupRegistration.isLoading}
                  success={setupRegistration.isSuccess}
                  onClick={() => void submit()}
                >
                  Complete Setup
                </Button>
              </Dialog.Actions>

              <setupRegistration.RenderError />
            </>
          ) : (
            <>
              <Spacer size={20} />
              <Callout color="green">
                <span>Setup is complete — this receiver is live.</span>
              </Callout>
              <Spacer size={18} />
              <Dialog.Actions>
                <Button type="button" variant="outline" onClick={close}>
                  Close
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Panel.Content>
      </Panel.Wrapper>
    );
  });

type WebhookRegistrationsTableProps = {
  instanceId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useWebhookRegistrationsTableState: TableStateProvider<
  WebhookRegistrationsTableProps,
  WebhookRegistrationPreview,
  TableStateProviderResult<WebhookRegistrationPreview> & {
    registrations: ReturnType<typeof useWebhookRegistrations>;
  }
> = (props, opts) => {
  let registrations = useWebhookRegistrations(props.instanceId, {
    order: 'desc',
    status: getConstrainedEnumListFilterValue(
      opts.filter.status,
      ['awaiting_setup', 'active', 'archived', 'deleted'],
      undefined
    ),
    providerId: getListFilterValue(opts.filter.providerId)
  });

  return {
    isLoading: registrations.isLoading,
    error: registrations.error,
    hasMoreAfter: registrations.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: registrations.data?.pagination.hasMoreBefore ?? false,
    items: registrations.data?.items ?? [],
    loadNext: registrations.next,
    loadPrevious: registrations.previous,
    registrations
  };
};

let useWebhookRegistrationsTableFilters = (instanceId: string) =>
  useMemo<TableFilter<WebhookRegistrationPreview>[]>(
    () => [
      {
        id: 'status',
        fields: ['status'],
        label: 'Status',
        description: 'Filter by status',
        type: 'select',
        options: [
          { id: 'awaiting_setup', label: 'Awaiting Setup' },
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' }
        ]
      },
      entityFilters.provider(instanceId)
    ],
    [instanceId]
  );

let webhookRegistrationsTable = new DashboardTable<
  WebhookRegistrationsTableProps,
  WebhookRegistrationPreview
>('webhook-registrations')
  .state(useWebhookRegistrationsTableState)
  .hookState((state, props) => {
    let deleteRegistration = useDeleteWebhookRegistration();

    return {
      instanceId: props.instanceId,
      registrations: state.registrations,
      deleteRegistration
    };
  })
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Receiver',
      render: registration => (
        <div>
          <Text size="2" weight="strong">
            {registration.name}
          </Text>
          <Text size="1" color="gray600">
            {registration.provider.name}
          </Text>
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: registration => (
        <Badge color={getWebhookRegistrationStatusColor(registration.status)}>
          {WEBHOOK_REGISTRATION_STATUS_LABELS[registration.status] ?? registration.status}
        </Badge>
      )
    },
    {
      id: 'receiveUrl',
      isDefault: true,
      header: 'Receive URL',
      render: registration =>
        registration.receiveUrl ? (
          <Text size="2" style={{ fontFamily: 'jetbrains mono, monospace' }}>
            {registration.receiveUrl}
          </Text>
        ) : (
          <Text size="2" color="gray600">
            Not provisioned
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: registration => <RenderDate date={registration.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Receiver ID',
      render: registration => <ID id={registration.id} />
    }
  ])
  .link((registration, props) =>
    Paths.instance.webhookRegistration(
      props.organization.data,
      props.project.data,
      props.instance.data,
      registration.id
    )
  )
  .actions({
    setup: async (registrations, state) => {
      let registration = registrations[0];
      if (!registration) return;

      showWebhookRegistrationSetupPanel({
        instanceId: state.instanceId,
        registration,
        onComplete: () => void state.registrations.refetch()
      });
    },
    delete: async (registrations, state) => {
      let registration = registrations[0];
      if (!registration) return;

      confirm({
        title: `Delete ${registration.name}?`,
        description:
          'Metorial tears down the receiver on the provider and stops accepting webhooks at this URL. This cannot be undone.',
        confirmText: 'Delete',
        onConfirm: async () => {
          await state.deleteRegistration.mutate({
            instanceId: state.instanceId,
            webhookRegistrationId: registration.id
          });
          await state.registrations.refetch();
        }
      });
    }
  })
  .rowActions([
    {
      id: 'setup',
      label: 'View Setup',
      icon: <RiSettings3Line />,
      action: 'setup'
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'delete'
    }
  ])
  .build();

export let WebhookRegistrationsTable = ({ instanceId }: { instanceId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let tableFilters = useWebhookRegistrationsTableFilters(instanceId);

  return webhookRegistrationsTable({
    instanceId,
    instance,
    organization,
    project,
    tableFilters,
    emptyState:
      'No webhook receivers yet. Create one to get a Metorial URL you can point a provider at.'
  });
};

export let CreateWebhookRegistrationButton = ({
  instanceId,
  provider,
  providerAuthCredentialsId,
  onCreate
}: {
  instanceId: string;
  provider?: { id: string; name: string };
  providerAuthCredentialsId?: string;
  onCreate?: (created: { id: string }) => void;
}) => (
  <Button
    size="2"
    onClick={() =>
      showCreateWebhookRegistrationModal({
        instanceId,
        provider,
        providerAuthCredentialsId,
        onCreate: created => onCreate?.(created)
      })
    }
  >
    Create Webhook Receiver
  </Button>
);

export let showWebhookRegistrationSetup = showWebhookRegistrationSetupPanel;
