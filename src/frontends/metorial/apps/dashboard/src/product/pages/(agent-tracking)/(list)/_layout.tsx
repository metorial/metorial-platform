import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import {
  agentTrackingSetupStepCount,
  AgentTrackingStatusBadge,
  useAgentTrackingSetupProgress
} from '../../../scenes/agentTracking/setupProgress';
import { WithInfo } from '../../../scenes/agentTracking/info';

export let AgentTrackingListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let progress = useAgentTrackingSetupProgress(instance.data?.id);

  let pathname = useLocation().pathname;
  let params = [organization.data, project.data, instance.data] as const;

  let setupLabel =
    progress.loaded && !progress.hasData
      ? `Setup · ${progress.completedSteps} of ${agentTrackingSetupStepCount}`
      : 'Setup';

  return (
    <ContentLayout>
      <PageHeader
        title={
          <WithInfo info="What your team's Claude Code sessions cost, and who ran them.">
            Agent Usage
          </WithInfo>
        }
        actions={<AgentTrackingStatusBadge progress={progress} />}
      />

      <LinkTabs
        current={pathname}
        links={[
          { label: 'Sessions', to: Paths.instance.agentTracking.sessions(...params) },
          { label: 'Spend', to: Paths.instance.agentTracking.spend(...params) },
          { label: 'Team', to: Paths.instance.agentTracking.team(...params) },
          { label: 'Report', to: Paths.instance.agentTracking.report(...params) },
          { label: setupLabel, to: Paths.instance.agentTracking.setup(...params) }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
