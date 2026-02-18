import { Context } from '@metorial/context';
import { SessionMcpConnectionType } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { accessLimiterService } from '@metorial/module-protect';
import { serverSessionService } from '@metorial/module-session';
import { SessionInfo } from './getSession';

export type ProviderSessionResult = {
  type: 'provider';
  sessionId: string;
  providerDeploymentId: string | null;
};

export type LegacySessionResult = {
  type: 'legacy';
  serverSession: Awaited<
    ReturnType<typeof serverSessionService.getServerSessionById>
  >;
  sessionCreated: boolean;
};

export type ServerSessionResult = ProviderSessionResult | LegacySessionResult;

export let getServerSession = async (
  d: SessionInfo,
  context: Context,
  deploymentId: string | null,
  serverSessionId: string | null,
  connectionType: SessionMcpConnectionType
): Promise<ServerSessionResult> => {
  // Provider (Subspace) sessions are not handled via the local engine.
  // Return early so the caller can route to the provider proxy handler.
  if (d.type === 'subspace_session_client_secret') {
    return {
      type: 'provider',
      sessionId: d.sessionId,
      providerDeploymentId: d.providerDeploymentId ?? null
    };
  }

  if (serverSessionId) {
    let serverSession = await serverSessionService.getServerSessionById({
      session: d.session,
      serverSessionId
    });

    if (serverSession.serverDeployment.accessLimiter) {
      await accessLimiterService.checkAccessLimiter({
        accessLimiter: serverSession.serverDeployment.accessLimiter,
        ip: context.ip,
        ua: context.ua ?? 'unknown'
      });
    }

    return {
      type: 'legacy',
      serverSession,
      sessionCreated: false
    };
  }

  let { serverDeployment } = await getServerSessionDeployment(d, deploymentId);

  let serverSession = await serverSessionService.createServerSession({
    session: d.session,
    serverDeployment,
    context,
    connectionType
  });

  if (serverSession.serverDeployment.accessLimiter) {
    await accessLimiterService.checkAccessLimiter({
      accessLimiter: serverSession.serverDeployment.accessLimiter,
      ip: context.ip,
      ua: context.ua ?? 'unknown'
    });
  }

  return {
    type: 'legacy',
    serverSession,
    sessionCreated: true
  };
};

let getServerSessionDeployment = async (
  d: SessionInfo,
  serverSessionOrDeploymentId: string | null
) => {
  if (d.type === 'subspace_session_client_secret') {
    throw new ServiceError(
      badRequestError({
        message: 'Server session lookup is not supported for provider sessions'
      })
    );
  }

  let session = d.session;

  if (!serverSessionOrDeploymentId) {
    if (session.connectionType == 'mcp' && session.serverDeployments.length == 1) {
      return session.serverDeployments[0];
    }

    throw new ServiceError(
      badRequestError({
        message: 'Missing server deployment ID',
        description: 'Please provide a server deployment ID in the URL.'
      })
    );
  }

  let deployment = session.serverDeployments.find(
    d =>
      d.serverDeployment.id == serverSessionOrDeploymentId ||
      d.serverDeployment.server.id == serverSessionOrDeploymentId ||
      d.serverDeployment.serverVariant.id == serverSessionOrDeploymentId ||
      d.serverDeployment.serverVariant.identifier == serverSessionOrDeploymentId
  );
  if (deployment) return deployment;

  if (d.type == 'session_client_secret') {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid server deployment ID',
        description: `The server deployment ID "${serverSessionOrDeploymentId}" is not associated with this session.`
      })
    );
  }

  throw new ServiceError(
    badRequestError({
      message: 'Invalid server deployment ID',
      description: `The server deployment ID "${serverSessionOrDeploymentId}" is not associated with this session. If you want to add a new deployment to the session, please use the session update API.`
    })
  );
};
