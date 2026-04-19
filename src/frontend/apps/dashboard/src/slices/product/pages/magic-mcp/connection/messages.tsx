import { useParams } from 'react-router-dom';
import { ProviderSessionLogs } from '../../(logs)/provider-session';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';

export let MagicMcpConnectionMessagesPage = () => {
  let { connectionId } = useParams();
  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ session }) => <ProviderSessionLogs session={session} />}
    </RenderWithResolvedMagicMcpSession>
  );
};
