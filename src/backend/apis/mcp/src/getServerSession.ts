import { Context } from '@metorial/context';
import { SessionMcpConnectionType } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { accessLimiterService } from '@metorial/module-protect';
import { serverSessionService } from '@metorial/module-session';
import { SessionInfo } from './getSession';

export let getServerSession = async (
  d: SessionInfo,
  context: Context,
  deploymentId: string | null,
  serverSessionId: string | null,
  connectionType: SessionMcpConnectionType
) => {
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
    serverSession,
    sessionCreated: true
  };
};

let getServerSessionDeployment = async (
  d: SessionInfo,
  serverSessionOrDeploymentId: string | null
) => {
  if (!serverSessionOrDeploymentId) {
    if (d.session.connectionType == 'mcp' && d.session.serverDeployments.length == 1) {
      return d.session.serverDeployments[0];
    }

    throw new ServiceError(
      badRequestError({
        message: 'Missing server deployment ID',
        description: 'Please provide a server deployment ID in the URL.'
      })
    );
  }

  let deployment = d.session.serverDeployments.find(
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

  // // Add new deployment to session
  // let newDeployment = await serverDeploymentService.getServerDeploymentById({
  //   instance: d.instance,
  //   serverDeploymentId: serverSessionOrDeploymentId
  // });

  // // Update session with new deployment
  // Object.assign(
  //   d.session,
  //   await sessionService.addServerDeployments({
  //     session: d.session,
  //     serverDeployments: [newDeployment],

  //     performedBy: d.actor,
  //     instance: d.instance,
  //     organization: d.organization,

  //     ephemeralPermittedDeployments: new Set([])
  //   })
  // );

  // return d.session.serverDeployments.find(d => d.oid == newDeployment.oid)!;
};
