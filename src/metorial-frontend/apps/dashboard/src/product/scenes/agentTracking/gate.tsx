import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useAgentTrackingIngestSources, useAgentTrackingSetupStatus } from '@metorial/state';
import { Button, ProgressSteps } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { AgentTrackingErrorState } from './errorState';

let FirstRun = ({ instanceId, subject }: { instanceId: string; subject: string }) => {
  let ctx = useInstanceContext();
  let keys = useAgentTrackingIngestSources(instanceId, { limit: 1, status: 'active' });

  let params = [ctx.organization, ctx.project, ctx.instance] as const;

  return renderWithLoader(
    { keys },
    { error: error => <AgentTrackingErrorState error={error} onRetry={keys.refetch} /> }
  )(({ keys }) => {
    let hasKey = !!keys.data.items.length;

    return (
      <Box
        title={`Connect a Coding Agent to See ${subject}`}
        description={
          hasKey
            ? 'A key exists, but no usage has arrived yet. Finish setup and start your coding agent; the first session shows up here within about a minute.'
            : 'It takes about five minutes. Create a key, set up Claude Code or Codex on each machine, then start it. The first session shows up here within about a minute.'
        }
        rightActions={
          <Link to={Paths.instance.agentTracking.setup(...params)}>
            <Button size="2" as="span">
              {hasKey ? 'Continue Setup' : 'Start Setup'}
            </Button>
          </Link>
        }
      >
        <ProgressSteps
          orientation="horizontal"
          steps={[
            {
              id: 'key',
              label: 'Create a Key',
              description: 'You get a settings file or config with the key already in it.',
              state: hasKey ? 'complete' : 'active'
            },
            {
              id: 'deploy',
              label: 'Deploy One File',
              description:
                'A copy-ready command or config for macOS, Linux or Windows, or your MDM.',
              state: hasKey ? 'active' : 'pending'
            },
            {
              id: 'prompt',
              label: 'Send One Prompt',
              description:
                'The session appears in about a minute. Cost follows 30 to 90 seconds later.',
              state: 'pending'
            }
          ]}
        />
      </Box>
    );
  });
};

export let AgentTrackingDataGate = ({
  instanceId,
  subject,
  children
}: {
  instanceId: string;
  subject: string;
  children: React.ReactNode;
}) => {
  let setupStatus = useAgentTrackingSetupStatus(instanceId);

  return renderWithLoader(
    { setupStatus },
    {
      error: error => <AgentTrackingErrorState error={error} onRetry={setupStatus.refetch} />
    }
  )(({ setupStatus }) =>
    setupStatus.data.lastReceivedAt ? (
      <>{children}</>
    ) : (
      <FirstRun instanceId={instanceId} subject={subject} />
    )
  );
};
