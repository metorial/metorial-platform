import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingInstanceSettings, useCurrentInstance } from '@metorial/state';
import { Button, Callout } from '@metorial/ui';
import React from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { AgentTrackingErrorState } from './errorState';

export let useAgentTrackingPrivacy = () => {
  let instance = useCurrentInstance();
  return useAgentTrackingInstanceSettings(instance.data?.id);
};

export let hiddenGroupText = (minGroupUsers: number) => `fewer than ${minGroupUsers} people`;

let IndividualsHiddenNotice = ({ subject }: { subject: string }) => {
  let ctx = useInstanceContext();

  return (
    <Callout
      color="gray"
      action={
        <Link
          to={Paths.instance.agentTracking.settings(
            ctx.organization,
            ctx.project,
            ctx.instance
          )}
        >
          <Button size="2" variant="outline" as="span">
            Privacy Settings
          </Button>
        </Link>
      }
    >
      {subject} would show individual people, and this organization hides individual data in
      Agent Usage. Spend still shows daily totals. An organization admin can change this in the
      privacy settings.
    </Callout>
  );
};

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
