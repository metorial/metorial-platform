import { renderWithLoader } from '@metorial/data-hooks';
import { useAgentTrackingInstanceSettings, useCurrentInstance } from '@metorial/state';
import { Callout } from '@metorial/ui';
import React from 'react';
import { useAgentTrackingAvailability } from './access';
import { AgentTrackingErrorState, PrivacySettingsButton } from './errorState';
import { individualsVisibility } from './individuals';

export let useAgentTrackingIndividualsVisibility = (opts: { enabled?: boolean } = {}) => {
  let instance = useCurrentInstance();
  let { access, enabled, available } = useAgentTrackingAvailability();
  let settings = useAgentTrackingInstanceSettings(
    available && opts.enabled !== false ? instance.data?.id : null
  );

  let visibility = individualsVisibility({
    enabled,
    scopes: { loaded: !!access.data || !!access.error, hasScope: access.hasScope },
    settings: {
      loaded: !!settings.data,
      failed: !!settings.error,
      hideIndividuals: !!settings.data?.privacy.hideIndividuals
    }
  });

  return { visibility, settings };
};

let IndividualsHiddenNotice = ({ subject }: { subject: string }) => (
  <Callout color="gray" action={<PrivacySettingsButton />}>
    {subject} would show individual people, which this organization hides in Agent Usage; Spend
    still shows daily totals.
  </Callout>
);

export let AgentTrackingIndividualsGate = ({
  subject,
  children
}: {
  subject: string;
  children: React.ReactNode;
}) => {
  let { visibility, settings } = useAgentTrackingIndividualsVisibility();

  return renderWithLoader(
    { settings },
    { error: error => <AgentTrackingErrorState error={error} onRetry={settings.refetch} /> }
  )(() =>
    visibility == 'hidden' ? <IndividualsHiddenNotice subject={subject} /> : <>{children}</>
  );
};
