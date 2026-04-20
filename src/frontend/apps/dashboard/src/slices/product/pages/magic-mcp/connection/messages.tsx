import { useParams } from 'react-router-dom';
import { RenderWithResolvedMagicMcpSession } from '../../../scenes/magicMcp/resolvedSession';
import { SessionTracingScene } from '../../../scenes/sessionTracing';

export let MagicMcpConnectionMessagesPage = () => {
  let { connectionId } = useParams();
  return (
    <RenderWithResolvedMagicMcpSession magicMcpSessionId={connectionId}>
      {({ session }) => <SessionTracingScene session={session} />}
    </RenderWithResolvedMagicMcpSession>
  );
};
