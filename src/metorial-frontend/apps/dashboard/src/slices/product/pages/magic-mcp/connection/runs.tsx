import { ProviderRunsTable } from '../../../scenes/providerRun/table';
import { useParams } from 'react-router-dom';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';

export let MagicMcpConnectionRunsPage = () => {
  let { connectionId } = useParams();

  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ magicMcpSession }) => <ProviderRunsTable sessionId={magicMcpSession.sessionId} />}
    </RenderWithResolvedMagicMcpSession>
  );
};
