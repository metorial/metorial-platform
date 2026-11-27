import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { useAgentTrackingIngestSources } from '@metorial/state';
import { Button, Callout, Text, useCopy } from '@metorial/ui';
import { RiFileCopyLine } from '@remixicon/react';
import { AgentTrackingErrorState, noIngestAddressText } from './errorState';

export let CopyButton = ({
  value,
  label,
  variant = 'outline'
}: {
  value: string;
  label: string;
  variant?: 'outline' | 'ghost';
}) => {
  let { copy, copied } = useCopy(value);

  return (
    <Button size="1" variant={variant} iconLeft={<RiFileCopyLine />} onClick={() => copy()}>
      {copied ? 'Copied' : label}
    </Button>
  );
};

export let CommandStep = ({
  title,
  command,
  language
}: {
  title: string;
  command: string;
  language: string;
}) => (
  <>
    <Text size="2" weight="medium">
      {title}
    </Text>
    <CodeBlock code={command} language={language} lineNumbers={false} />
    <div>
      <CopyButton value={command} label="Copy Command" />
    </div>
  </>
);

export let MissingFile = ({
  instanceId,
  notConfigured,
  subject = 'file'
}: {
  instanceId: string;
  notConfigured: boolean;
  subject?: string;
}) => {
  let activeKeys = useAgentTrackingIngestSources(instanceId, { limit: 1, status: 'active' });

  if (notConfigured) {
    return (
      <Text size="2" color="gray600">
        The {subject} is built from an ingestion key.
      </Text>
    );
  }

  return renderWithLoader(
    { activeKeys },
    { error: error => <AgentTrackingErrorState error={error} onRetry={activeKeys.refetch} /> }
  )(({ activeKeys }) =>
    activeKeys.data.items.length ? (
      <Callout color="gray">
        {noIngestAddressText} No {subject} can be built, but existing keys can still be
        revoked.
      </Callout>
    ) : (
      <Text size="2" color="gray600">
        Create an ingestion key first. The {subject} is built from it.
      </Text>
    )
  );
};
