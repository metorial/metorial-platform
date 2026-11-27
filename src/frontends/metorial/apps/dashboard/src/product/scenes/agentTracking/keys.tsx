import type {
  DashboardInstanceAgentTrackingIngestSourcesCreateOutput,
  DashboardInstanceAgentTrackingIngestSourcesListOutput
} from '@metorial/dashboard-sdk';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useAgentTrackingIngestSources,
  useCreateAgentTrackingIngestSource,
  useRevokeAgentTrackingIngestSource
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  confirm,
  Dialog,
  Input,
  RenderDate,
  showModal,
  Spacer,
  Text,
  Tooltip
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { AgentTrackingErrorState, noIngestAddressText } from './errorState';

type IngestSource = DashboardInstanceAgentTrackingIngestSourcesListOutput['items'][number];

export type CreatedIngestSource = DashboardInstanceAgentTrackingIngestSourcesCreateOutput;

export let showCreateIngestSourceDialog = (p: {
  instanceId: string;
  onCreate: (ingestSource: CreatedIngestSource) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let create = useCreateAgentTrackingIngestSource();

    let form = useForm({
      initialValues: { name: '' },
      onSubmit: async values => {
        let [ingestSource] = await create.mutate({
          instanceId: p.instanceId,
          name: values.name.trim(),
          clientFamily: 'claude_code'
        });
        if (!ingestSource) return;

        close();
        p.onCreate(ingestSource);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required').max(200)
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Create Ingestion Key</Dialog.Title>
        <Dialog.Description>
          Claude Code sends its usage with this key. The key is shown once, right after you
          create it.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            description="Tells the keys apart, such as where the key is deployed."
            placeholder="Engineering laptops"
            required
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          {create.error?.status == 404 ? (
            <Callout color="gray">{noIngestAddressText} No key can be created.</Callout>
          ) : (
            <create.RenderError />
          )}

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              size="2"
              disabled={create.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={create.isLoading}
              success={create.isSuccess}
            >
              Create Ingestion Key
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let RevokeButton = ({
  instanceId,
  ingestSource,
  canWrite,
  onRevoked
}: {
  instanceId: string;
  ingestSource: IngestSource;
  canWrite: boolean;
  onRevoked: (ingestSourceId: string) => void;
}) => {
  let revoke = useRevokeAgentTrackingIngestSource();

  return (
    <>
      <Button
        size="1"
        variant="outline"
        color="red"
        disabled={!canWrite}
        loading={revoke.isLoading}
        success={revoke.isSuccess}
        onClick={() =>
          confirm({
            title: 'Revoke Ingestion Key',
            description: `Claude Code installations that use "${ingestSource.name}" stop sending usage. Data already received stays. This cannot be undone.`,
            confirmText: 'Revoke',
            onConfirm: async () => {
              let [revoked] = await revoke.mutate({
                instanceId,
                ingestSourceId: ingestSource.id
              });
              if (revoked) onRevoked(ingestSource.id);
            }
          })
        }
      >
        Revoke
      </Button>
      <revoke.RenderError />
    </>
  );
};

let LastUsed = ({ ingestSource }: { ingestSource: IngestSource }) => {
  if (ingestSource.lastUsedStatus == 'used' && ingestSource.lastUsedAt) {
    return <RenderDate date={ingestSource.lastUsedAt} />;
  }

  if (ingestSource.lastUsedStatus == 'never_used') {
    return (
      <Text as="span" size="2" color="gray600">
        Never
      </Text>
    );
  }

  return (
    <Tooltip content="Agent Usage cannot answer right now, so when this key was last used cannot be determined.">
      <span>
        <Text as="span" size="2" color="gray600">
          Unavailable Right Now
        </Text>
      </span>
    </Tooltip>
  );
};

export let IngestSourcesTable = ({
  instanceId,
  keys,
  canWrite,
  onRevoked
}: {
  instanceId: string;
  keys: ReturnType<typeof useAgentTrackingIngestSources>;
  canWrite: boolean;
  onRevoked: (ingestSourceId: string) => void;
}) =>
  renderWithPagination(keys, {
    emptyState: (
      <Text size="2" color="gray600">
        No ingestion keys yet.
      </Text>
    ),
    error: error => <AgentTrackingErrorState error={error} onRetry={keys.refetch} />
  })(keys => (
    <Table
      headers={['Name', 'Key', 'Status', 'Last Used', 'Created', '']}
      data={keys.data.items.map(ingestSource => [
        <Text key="name" as="span" size="2" weight="medium">
          {ingestSource.name}
        </Text>,
        <Text key="key" as="span" size="2" color="gray700">
          {ingestSource.secretRedacted}
        </Text>,
        ingestSource.status == 'active' ? (
          <Badge key="status" size="2" color="green">
            Active
          </Badge>
        ) : (
          <Badge key="status" size="2" color="gray">
            Revoked
          </Badge>
        ),
        <LastUsed key="lastUsed" ingestSource={ingestSource} />,
        <RenderDate key="created" date={ingestSource.createdAt} />,
        ingestSource.status == 'active' ? (
          <RevokeButton
            key="revoke"
            instanceId={instanceId}
            ingestSource={ingestSource}
            canWrite={canWrite}
            onRevoked={onRevoked}
          />
        ) : null
      ])}
    />
  ));
