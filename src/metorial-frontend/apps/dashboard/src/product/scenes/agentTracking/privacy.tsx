import { renderWithLoader } from '@metorial/data-hooks';
import { useAgentTrackingInstanceSettings, useCurrentInstance } from '@metorial/state';
import { Callout } from '@metorial/ui';
import React from 'react';
import { AgentTrackingErrorState, PrivacySettingsButton } from './errorState';

export let useAgentTrackingPrivacy = () => {
  let instance = useCurrentInstance();
  return useAgentTrackingInstanceSettings(instance.data?.id);
};

export let hiddenGroupText = (minGroupUsers: number) => `fewer than ${minGroupUsers} people`;

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
  let settings = useAgentTrackingPrivacy();

  return renderWithLoader(
    { settings },
    { error: error => <AgentTrackingErrorState error={error} onRetry={settings.refetch} /> }
  )(({ settings }) =>
    settings.data.privacy.hideIndividuals ? (
      <IndividualsHiddenNotice subject={subject} />
    ) : (
      <>{children}</>
    )
  );
};
