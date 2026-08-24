import { Button, Flex, Input, Select, Spacer, Text, Title } from '@metorial-io/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackLink } from '../../components/BackLink.js';
import { FormWrapper } from '../../components/styled.js';
import { createGlobalWebhook, useSlates } from '../../state/index.js';

let parseJsonObject = (value: string, label: string): Record<string, any> => {
  if (!value.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, any>;
};

export let WebhookCreate = () => {
  let navigate = useNavigate();

  let [slateSearch, setSlateSearch] = useState('');
  let [slateId, setSlateId] = useState<string | undefined>(undefined);
  let [name, setName] = useState('');
  let [description, setDescription] = useState('');
  let [metadataText, setMetadataText] = useState('');
  let [userConfigText, setUserConfigText] = useState('{}');
  let [error, setError] = useState<string | null>(null);
  let [isSubmitting, setIsSubmitting] = useState(false);

  let slates = useSlates(slateSearch.trim() || undefined);
  let slateItems = (slates.data?.items ?? []).map(slate => ({
    id: slate.id,
    label: slate.name || slate.identifier
  }));

  let submit = async () => {
    setError(null);

    if (!slateId) {
      setError('Select a provider to bind this webhook to.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    let metadata: Record<string, any>;
    let userConfig: Record<string, any>;
    try {
      metadata = parseJsonObject(metadataText, 'Metadata');
      userConfig = parseJsonObject(userConfigText, 'User config');
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Invalid JSON.');
      return;
    }

    setIsSubmitting(true);
    try {
      let webhook = await createGlobalWebhook({
        slateId,
        name: name.trim(),
        description: description.trim() || undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        userConfig
      });

      navigate(`/webhooks/${webhook.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to create webhook.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Flex direction="column" gap={32}>
      <BackLink to="/webhooks">Back to Webhooks</BackLink>

      <div>
        <Title size="6" weight="strong">
          Create Global Webhook
        </Title>
        <Spacer size={4} />
        <Text size="2" color="gray600">
          This finishes the provider's manual webhook setup immediately, using the
          configuration you provide below.
        </Text>
      </div>

      <FormWrapper>
        <Flex direction="column" gap={16}>
          <Input
            label="Search providers"
            placeholder="Search by name"
            value={slateSearch}
            onInput={value => setSlateSearch(value)}
          />

          <Select
            label="Provider"
            placeholder="Select a provider"
            value={slateId}
            onChange={setSlateId}
            items={
              slateItems.length
                ? slateItems
                : [{ id: '', label: 'No matching providers', disabled: true }]
            }
          />

          <Input label="Name" value={name} onInput={setName} placeholder="e.g. GitHub" />

          <Input
            label="Description"
            value={description}
            onInput={setDescription}
            placeholder="Optional"
          />

          <Input
            label="Metadata (JSON)"
            description="Optional"
            as="textarea"
            minRows={3}
            value={metadataText}
            onInput={setMetadataText}
            placeholder="{}"
          />

          <Input
            label="User config (JSON)"
            description="Passed straight to the provider's manual webhook setup handshake."
            as="textarea"
            minRows={4}
            value={userConfigText}
            onInput={setUserConfigText}
          />

          {error && (
            <Text size="2" color="red600">
              {error}
            </Text>
          )}

          <Flex>
            <Button color="blue" loading={isSubmitting} disabled={isSubmitting} onClick={submit}>
              Create webhook
            </Button>
          </Flex>
        </Flex>
      </FormWrapper>
    </Flex>
  );
};
