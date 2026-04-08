import { ProviderSessionLogs } from '../../(logs)/provider-session/logs';
import { useParams } from 'react-router-dom';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';

export let MagicMcpConnectionMessagesPage = () => {
  let { connectionId } = useParams();
  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ session }) => <ProviderSessionLogs session={session} />}
    </RenderWithResolvedMagicMcpSession>
  );
};
