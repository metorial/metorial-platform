import { db, ID, Instance, Organization, ServerSession, ServerVersion } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { EngineRunStatus, EngineSessionRun } from '@metorial/mcp-engine-generated';
import { getEngineRunType } from '../connection/util';

export let createEngineRun = async (d: {
  run: EngineSessionRun;
  serverSession: ServerSession;
  version: ServerVersion;
  instance: Instance & { organization: Organization };
}) => {
  let engineRun = await db.engineRun.create({
    data: {
      id: d.run.id,
      type: getEngineRunType(d.run),
      hasEnded: d.run.status != EngineRunStatus.run_status_active,
      lastSyncAt: new Date(0),
      createdAt: new Date(d.run.createdAt.toNumber()),
      serverSessionOid: d.serverSession.oid,
      engineSessionId: d.run.sessionId
    }
  });

  await Fabric.fire('server.server_run.created:before', {
    organization: d.instance.organization,
    instance: d.instance
  });

  let serverRun = await db.serverRun.create({
    data: {
      id: ID.normalizeUUID('serverRun', d.run.id),
      status: 'active',
      type: d.version.sourceType == 'remote' ? 'external' : 'hosted',
      serverVersionOid: d.version.oid,
      serverDeploymentOid: d.serverSession.serverDeploymentOid,
      instanceOid: d.serverSession.instanceOid,
      serverSessionOid: d.serverSession.oid,
      engineRunId: d.run.id
    }
  });

  await Fabric.fire('server.server_run.created:after', {
    serverRun,
    organization: d.instance.organization,
    instance: d.instance
  });

  return {
    serverRun,
    engineRun
  };
};
