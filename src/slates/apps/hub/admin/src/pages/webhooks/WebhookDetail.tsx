import { renderWithLoader } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  confirm,
  Datalist,
  Flex,
  Group,
  InlineCopy,
  Input,
  RenderDate,
  Text,
  Title
} from '@metorial-io/ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { MonoCode } from '../../components/styled.js';
import { deleteGlobalWebhook, updateGlobalWebhook, useWebhook } from '../../state/index.js';

let statusColors: Record<string, 'gray' | 'green' | 'red'> = {
  awaiting_setup: 'gray',
  active: 'green',
  deleted: 'red'
};

export let WebhookDetail = () => {
  let { webhookRegistrationId } = useParams<{ webhookRegistrationId: string }>();
  let webhook = useWebhook(webhookRegistrationId);

  return renderWithLoader({ webhook })(({ webhook: loaded }) => (
    <WebhookDetailContent webhook={loaded.data} onChanged={webhook.refetch} />
  ));
};

let WebhookDetailContent = ({
  webhook,
  onChanged
}: {
  webhook: NonNullable<ReturnType<typeof useWebhook>['data']>;
  onChanged: () => void;
}) => {
  let navigate = useNavigate();

  let [name, setName] = useState(webhook.name);
  let [description, setDescription] = useState(webhook.description ?? '');
  let [metadataText, setMetadataText] = useState(JSON.stringify(webhook.metadata ?? {}, null, 2));
  let [error, setError] = useState<string | null>(null);
  let [isSaving, setIsSaving] = useState(false);
  let [isDeleting, setIsDeleting] = useState(false);

  let save = async () => {
    setError(null);

    let metadata: Record<string, any>;
    try {
      metadata = metadataText.trim() ? JSON.parse(metadataText) : {};
    } catch {
      setError('Metadata must be valid JSON.');
      return;
    }

    setIsSaving(true);
    try {
      await updateGlobalWebhook({
        webhookRegistrationId: webhook.id,
        name: name.trim(),
        description: description.trim() || undefined,
        metadata
      });
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save webhook.');
    } finally {
      setIsSaving(false);
    }
  };

  let remove = () => {
    confirm({
      title: 'Delete webhook',
      description: `Are you sure you want to delete "${webhook.name}"? It will stop accepting requests immediately.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteGlobalWebhook(webhook.id);
          navigate('/webhooks');
        } catch (deleteError) {
          setError(
            deleteError instanceof Error ? deleteError.message : 'Failed to delete webhook.'
          );
          setIsDeleting(false);
        }
      }
    });
  };

  return (
    <Flex direction="column" gap={24}>
      <BackLink to="/webhooks">Back to Webhooks</BackLink>

      <Flex justify="space-between" align="center">
        <Flex align="center" gap={12}>
          <Title size="6" weight="strong">
            {webhook.name}
          </Title>
          <Badge color={statusColors[webhook.status] || 'gray'}>{webhook.status}</Badge>
        </Flex>
        <Button color="red" variant="outline" loading={isDeleting} onClick={remove}>
          Delete
        </Button>
      </Flex>

      <Group.Wrapper>
        <Group.Content>
          <Datalist
            items={[
              {
                label: 'ID',
                value: (
                  <Flex align="center" gap={6}>
                    <MonoCode>{webhook.id}</MonoCode>
                    <InlineCopy value={webhook.id} />
                  </Flex>
                )
              },
              { label: 'Type', value: webhook.type },
              { label: 'Owner', value: webhook.owner },
              {
                label: 'Provider',
                value: webhook.slateId ? (
                  <Link to={`/slates/${webhook.slateId}`}>{webhook.slateId}</Link>
                ) : (
                  '-'
                )
              },
              {
                label: 'Receive URL',
                value: (
                  <Flex align="center" gap={6}>
                    <MonoCode>{webhook.receiveUrl}</MonoCode>
                    <InlineCopy value={webhook.receiveUrl} />
                  </Flex>
                )
              },
              { label: 'Created', value: <RenderDate date={webhook.createdAt} /> },
              { label: 'Updated', value: <RenderDate date={webhook.updatedAt} /> }
            ]}
          />
        </Group.Content>
      </Group.Wrapper>

      <Group.Wrapper>
        <Group.Header title="Edit" />
        <Group.Content>
          <Flex direction="column" gap={16}>
            <Input label="Name" value={name} onInput={setName} />
            <Input label="Description" value={description} onInput={setDescription} />
            <Input
              label="Metadata (JSON)"
              as="textarea"
              minRows={3}
              value={metadataText}
              onInput={setMetadataText}
            />

            {error && (
              <Text size="2" color="red600">
                {error}
              </Text>
            )}

            <Flex>
              <Button color="blue" loading={isSaving} disabled={isSaving} onClick={save}>
                Save changes
              </Button>
            </Flex>
          </Flex>
        </Group.Content>
      </Group.Wrapper>
    </Flex>
  );
};
