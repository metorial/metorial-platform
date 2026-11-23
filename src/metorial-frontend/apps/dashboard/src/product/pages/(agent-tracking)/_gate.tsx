import { renderWithLoader } from '@metorial/data-hooks';
import { ComingSoon } from '@metorial/empty-state';
import { ContentLayout } from '@metorial/layout';
import { Callout } from '@metorial/ui';
import React from 'react';
import { useAgentTrackingAvailability } from '../../scenes/agentTracking/access';

export let AgentTrackingPageGate = ({ children }: { children: React.ReactNode }) => {
  let { flags, access, enabled } = useAgentTrackingAvailability();

  return renderWithLoader({ flags, access })(() => {
    if (!enabled) {
      return (
        <ContentLayout>
          <ComingSoon
            title="Agent Usage"
            description="See what your team's AI coding agents cost, by member and by model."
          />
        </ContentLayout>
      );
    }

    if (!access.hasScope) {
      return (
        <ContentLayout>
          <Callout color="gray">
            Agent Usage is visible to organization admins only. Ask an admin of this
            organization for access.
          </Callout>
        </ContentLayout>
      );
    }

    return <>{children}</>;
  });
};
