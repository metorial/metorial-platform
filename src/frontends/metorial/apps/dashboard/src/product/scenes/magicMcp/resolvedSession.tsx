import {
  DashboardInstanceMagicMcpSessionsGetOutput,
  DashboardInstanceSessionsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useMagicMcpSession, useSession } from '@metorial/state';
import { ReactNode } from 'react';

let ResolvedMagicMcpSessionInner = ({
  magicMcpSession,
  children
}: {
  magicMcpSession: DashboardInstanceMagicMcpSessionsGetOutput;
  children: (d: {
    magicMcpSession: DashboardInstanceMagicMcpSessionsGetOutput;
    session: DashboardInstanceSessionsGetOutput;
  }) => ReactNode;
}) => {
  let instance = useCurrentInstance();
  let session = useSession(instance.data?.id, magicMcpSession.sessionId);

  return renderWithLoader({ session })(({ session }) =>
    children({ magicMcpSession, session: session.data })
  );
};

export let RenderWithResolvedMagicMcpSession = ({
  magicMcpSessionId,
  children
}: {
  magicMcpSessionId: string | null | undefined;
  children: (d: {
    magicMcpSession: DashboardInstanceMagicMcpSessionsGetOutput;
    session: DashboardInstanceSessionsGetOutput;
  }) => ReactNode;
}) => {
  let instance = useCurrentInstance();
  let magicMcpSession = useMagicMcpSession(instance.data?.id, magicMcpSessionId);

  return renderWithLoader({ magicMcpSession })(({ magicMcpSession }) => (
    <ResolvedMagicMcpSessionInner magicMcpSession={magicMcpSession.data}>
      {children}
    </ResolvedMagicMcpSessionInner>
  ));
};
