import { DashboardInstanceSessionsGetOutput } from '@metorial/dashboard-sdk';
import { Callout } from '@metorial/ui';
import styled from 'styled-components';
import { McpConnectionInstructionsScene } from '../../mcpConnectionInstructions';

let ConnectPanel = styled.div`
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export let ConnectTabPanel = ({
  session
}: {
  session: DashboardInstanceSessionsGetOutput;
}) => {
  return (
    <ConnectPanel>
      <McpConnectionInstructionsScene
        name={session.name ?? `Session ${session.id.slice(0, 8)}...`}
        endpointLabel="Connection URL"
        endpointValue={session.connectionUrl ?? 'No connection URL available'}
        endpointCopyValue={session.connectionUrl ?? ''}
        tokenLabel={session.clientSecret ? 'Client Secret' : undefined}
        tokenValue={session.clientSecret}
        tokenCopyValue={session.clientSecret ?? ''}
        snippetUrl={session.connectionUrl ?? null}
        snippetToken={session.clientSecret ?? null}
        emptyState={
          <Callout color="gray">
            This session does not currently expose a client secret.
          </Callout>
        }
      />
    </ConnectPanel>
  );
};
