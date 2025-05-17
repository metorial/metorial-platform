import { badRequestError, ServiceError } from '@metorial/error';
import { serverDeploymentService } from '@metorial/module-server-deployment';
import { serverSessionService, sessionService } from '@metorial/module-session';
import { SessionInfo } from './getSession';

export let getServerSession = async (
  d: SessionInfo,
  serverSessionOrDeploymentId: string | null
) => {
  let serverSession = serverSessionOrDeploymentId
    ? d.session.serverSessions.find(s => s.id == serverSessionOrDeploymentId)
    : undefined;

  if (!serverSession) {
    let deployment = await getServerSessionDeployment(d, serverSessionOrDeploymentId);

    serverSession = d.session.serverSessions.find(
      s => s.serverDeploymentOid == deployment.oid
    );
    if (!serverSession) {
      serverSession = await serverSessionService.ensureServerSession({
        session: d.session,
        serverDeployment: deployment
      });
    }
  }

  // if (!serverSession) throw new ServiceError(notFoundError('server_deployment'));

  return serverSession;
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
      d.id == serverSessionOrDeploymentId ||
      d.server.id == serverSessionOrDeploymentId ||
      d.serverVariant.id == serverSessionOrDeploymentId ||
      d.serverVariant.identifier == serverSessionOrDeploymentId
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

  // Add new deployment to session
  let newDeployment = await serverDeploymentService.getServerDeploymentById({
    instance: d.instance,
    serverDeploymentId: serverSessionOrDeploymentId
  });

  // Update session with new deployment
  Object.assign(
    d.session,
    await sessionService.addServerDeployments({
      session: d.session,
      serverDeployments: [newDeployment],

      performedBy: d.actor,
      instance: d.instance,
      organization: d.organization
    })
  );

  return d.session.serverDeployments.find(d => d.oid == newDeployment.oid)!;
};
