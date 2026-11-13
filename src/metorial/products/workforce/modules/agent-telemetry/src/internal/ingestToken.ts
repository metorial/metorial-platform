import { db, type AgentTelemetryIngestToken } from '@metorial/db';
import { ignoreNotFound, type Groundstation } from './groundstation';

export let revokeAgentTelemetryIngestToken = async (d: {
  groundstation: Groundstation;
  ingestToken: AgentTelemetryIngestToken;
}) => {
  if (d.ingestToken.status != 'active') return d.ingestToken;

  let instance = await db.instance.findUniqueOrThrow({
    where: { oid: d.ingestToken.instanceOid },
    include: { organization: true }
  });

  await ignoreNotFound(
    d.groundstation.ingestToken.revoke({
      organizationId: instance.organization.id,
      ingestTokenId: d.ingestToken.groundstationIngestTokenId
    })
  );

  return await db.agentTelemetryIngestToken.update({
    where: { oid: d.ingestToken.oid },
    data: { status: 'revoked', revokedAt: new Date() }
  });
};
