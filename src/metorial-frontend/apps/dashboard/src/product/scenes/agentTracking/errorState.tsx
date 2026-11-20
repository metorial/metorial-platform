import { Button, Callout } from '@metorial/ui';
import { useEffect, useRef } from 'react';

let autoRetryMaxSeconds = 3;

export let notSetUpText = 'Agent Usage is not set up for this instance yet.';

export let noIngestAddressText =
  'Agent Usage has no public ingest address on this instance yet.';

let errorDetails = (error: unknown) => {
  let data = (error as { data?: Record<string, any> }).data ?? {};
  let retryAfter = Number(data.retry_after_seconds ?? data.retryAfterSeconds);

  return {
    status: Number(data.status),
    code: typeof data.code == 'string' ? data.code : undefined,
    message: typeof data.message == 'string' ? data.message : undefined,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
  };
};

export let agentTrackingErrorStatus = (error: unknown) =>
  error ? errorDetails(error).status : undefined;

export let AgentTrackingErrorState = ({
  error,
  onRetry
}: {
  error: unknown;
  onRetry: () => void;
}) => {
  let details = errorDetails(error);
  let autoRetried = useRef(false);

  let shortWait =
    details.status == 429 &&
    details.retryAfterSeconds !== undefined &&
    details.retryAfterSeconds <= autoRetryMaxSeconds;

  useEffect(() => {
    if (!shortWait || autoRetried.current) return;
    autoRetried.current = true;

    let timer = setTimeout(onRetry, details.retryAfterSeconds! * 1000);
    return () => clearTimeout(timer);
  }, [shortWait]);

  let retryButton = (
    <Button size="2" variant="outline" onClick={onRetry}>
      Retry
    </Button>
  );

  if (details.status == 404) {
    return (
      <Callout color="gray">
        {notSetUpText} Once Metorial has enabled it, you can create an ingestion key on the
        Setup tab.
      </Callout>
    );
  }

  if (details.code == 'agent_tracking_individuals_hidden') {
    return (
      <Callout color="gray">
        This organization hides individual data in Agent Usage, so this is not shown per member
        or per session. An organization admin can change this on the Settings tab.
      </Callout>
    );
  }

  if (details.status == 403) {
    return (
      <Callout color="gray">
        Agent Usage is not available to you. It needs the Agent Usage permission, which only
        organization admins have.
      </Callout>
    );
  }

  if (details.status == 429) {
    return (
      <Callout color="orange" action={retryButton}>
        Your organization has made a lot of agent usage requests in the last minute.
        {details.retryAfterSeconds
          ? ` Try again in ${details.retryAfterSeconds} seconds.`
          : ' Try again in a minute.'}
      </Callout>
    );
  }

  if (details.status >= 500) {
    return (
      <Callout color="orange" action={retryButton}>
        Agent Usage cannot answer right now. Try again in a moment.
      </Callout>
    );
  }

  return (
    <Callout color="red" action={retryButton}>
      {details.message ?? 'Agent usage could not be loaded.'}
    </Callout>
  );
};
