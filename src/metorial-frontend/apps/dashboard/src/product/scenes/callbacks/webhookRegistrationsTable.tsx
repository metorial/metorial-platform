import { CodeEditor } from '@metorial/code-editor';
import { useForm } from '@metorial/data-hooks';
import {
  createDataList,
  col,
  defineAction,
  defineStatus,
  EmptyValue,
  f
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { Markdown } from '@metorial/markdown';
import {
  useCreateWebhookRegistration,
  useDeleteWebhookRegistration,
  useSetupWebhookRegistration,
  useWebhookRegistrations,
  WebhookRegistrationPreview
} from '@metorial/state';
import { Button, Callout, Dialog, Input, Panel, showModal, Spacer, Text } from '@metorial/ui';
import { RiDeleteBinLine, RiSettings3Line } from '@remixicon/react';
import { useMemo, useState, type ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';
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
import { isWebhookRegistrationRemoved } from './shared';
import {
  WEBHOOK_REGISTRATION_COPY,
  type WebhookRegistrationTarget
} from './webhookRegistrationPurpose';
import {
  getWebhookSetupErrorMessages,
  orderJsonSchemaPropertiesByRequired
} from './webhookRegistrationSetup';

let showCreateWebhookRegistrationModal = (p: {
  instanceId: string;
  provider?: { id: string; name: string };
  target: WebhookRegistrationTarget;
  onCreate: (created: { id: string }) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let [providerId, setProviderId] = useState(p.provider?.id ?? '');
    let createRegistration = useCreateWebhookRegistration();
    let copy = WEBHOOK_REGISTRATION_COPY[p.target.purpose];

    let form = useForm({
      initialValues: {
        name: p.provider ? copy.createName(p.provider.name) : '',
        description: ''
      },
      onSubmit: async values => {
        if (!providerId) return;

        let [created] = await createRegistration.mutate({
          instanceId: p.instanceId,
          providerId,
          authCredentialsId:
            p.target.purpose === 'delivery_setup' ? p.target.authCredentialsId : undefined,
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
            {p.provider ? copy.createTitle(p.provider.name) : 'Create Webhook Receiver'}
          </Panel.Title>
        </Panel.Header>

        <Panel.Content>
          {providerId ? (
            <form onSubmit={form.handleSubmit}>
              <Callout color="gray">{copy.createIntro}</Callout>

              <Spacer size={16} />

              <Input label="Name" required {...form.getFieldProps('name')} />
              <form.RenderError field="name" />

              <Spacer size={10} />

              <Input label="Description" {...form.getFieldProps('description')} />
              <form.RenderError field="description" />

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
                    onClick={() => setProviderId('')}
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  loading={createRegistration.isLoading}
                  success={createRegistration.isSuccess}
                >
                  {copy.createSubmit}
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
    fieldErrors[field] = `${field} is required before continuing.`;
  }

  for (let field of getEmptyRequiredJsonStringFieldLabels({
    schema: p.schema,
    value: p.value
  })) {
    fieldErrors[field] = `${field} is required before continuing.`;
  }

  for (let field of getInvalidJsonStringFieldLabels({ schema: p.schema, value: p.value })) {
    fieldErrors[field] = `${field} must contain valid JSON before continuing.`;
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
    let schemaObj = useMemo(
      () =>
        orderJsonSchemaPropertiesByRequired(getJsonSchemaObject(p.registration.setup.schema)),
      [p.registration.setup.schema]
    );

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

    // A server error is about the submitted values, so it goes away once they are edited.
    let setupError = getWebhookSetupErrorMessages({
      schema: schemaObj,
      error:
        !hasSchema || setupRegistration.input?.userConfig === configValue
          ? setupRegistration.error
          : null
    });

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
                    fieldErrors={{ ...setupError.fieldErrors, ...schemaFieldErrors }}
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

              {setupError.message ? (
                <>
                  <Spacer size={12} />
                  <Callout color="red">{setupError.message}</Callout>
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
            </>
          ) : (
            <>
              <Spacer size={20} />
              <Callout color="green">
                <span>{WEBHOOK_REGISTRATION_COPY[p.registration.purpose].setupComplete}</span>
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

export let webhookRegistrationStatus = defineStatus({
  awaiting_setup: { label: 'Awaiting Setup', color: 'orange' },
  active: { label: 'Active', color: 'green' },
  archived: { label: 'Archived', color: 'orange' },
  deleted: { label: 'Deleted', color: 'gray' }
});

let WebhookRegistrationsList = createDataList<{ instanceId?: string }>('webhook-registrations')
  .context(useInstanceContext)
  .filters((props, ctx) => ({
    status: f.status(webhookRegistrationStatus, {
      only: ['awaiting_setup', 'active', 'archived']
    }),
    providerId: f.entity(entityFilters.provider(props.instanceId ?? ctx.instanceId))
  }))
  .paginated(({ props, ctx, filters }) =>
    useWebhookRegistrations(props.instanceId ?? ctx.instanceId, {
      order: 'desc',
      status: filters.status,
      providerId: filters.providerId
    })
  )
  .columns([
    col.name({ header: 'Receiver', description: row => row.provider.name }),
    col.status(webhookRegistrationStatus),
    col.custom({
      id: 'receiveUrl',
      header: 'Receive URL',
      render: row =>
        row.receiveUrl && !isWebhookRegistrationRemoved(row) ? (
          <Text size="2" style={{ fontFamily: 'jetbrains mono, monospace' }}>
            {row.receiveUrl}
          </Text>
        ) : (
          <EmptyValue>
            {isWebhookRegistrationRemoved(row) ? 'Removed' : 'Not provisioned'}
          </EmptyValue>
        )
    }),
    col.createdAt(),
    col.id({ header: 'Receiver ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.webhookRegistration(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .itemActions([
    defineAction<WebhookRegistrationPreview>({
      id: 'setup',
      label: 'View Setup',
      icon: <RiSettings3Line />,
      row: true,
      hidden: isWebhookRegistrationRemoved,
      useRun:
        ({ props, ctx }) =>
        async row => {
          showWebhookRegistrationSetupPanel({
            instanceId: (props.instanceId ?? ctx.instanceId)!,
            registration: row,
            onComplete: () => {}
          });
        }
    }),
    defineAction<WebhookRegistrationPreview>({
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      row: true,
      hidden: isWebhookRegistrationRemoved,
      destructive: true,
      confirm: {
        title: 'Delete Receiver',
        confirmText: 'Delete',
        description: ([row]) => WEBHOOK_REGISTRATION_COPY[row.purpose].deleteDescription
      },
      useRun: ({ props, ctx }) => {
        let deleteRegistration = useDeleteWebhookRegistration();

        return async row => {
          await deleteRegistration.mutate({
            instanceId: (props.instanceId ?? ctx.instanceId)!,
            webhookRegistrationId: row.id
          });
        };
      }
    })
  ])
  .build();

export let WebhookRegistrationsTable = (
  props: ComponentProps<typeof WebhookRegistrationsList>
) => (
  <WebhookRegistrationsList
    emptyState={{
      initial:
        'No webhook registrations yet. A callback shows the setup when its provider needs one.',
      filtered: 'No webhook receivers match your filters.'
    }}
    {...props}
  />
);

export let CreateWebhookRegistrationButton = ({
  instanceId,
  provider,
  target,
  onCreate
}: {
  instanceId: string;
  provider?: { id: string; name: string };
  target: WebhookRegistrationTarget;
  onCreate?: (created: { id: string }) => void;
}) => (
  <Button
    size="2"
    onClick={() =>
      showCreateWebhookRegistrationModal({
        instanceId,
        provider,
        target,
        onCreate: created => onCreate?.(created)
      })
    }
  >
    {WEBHOOK_REGISTRATION_COPY[target.purpose].createButton}
  </Button>
);

export let showWebhookRegistrationSetup = showWebhookRegistrationSetupPanel;
