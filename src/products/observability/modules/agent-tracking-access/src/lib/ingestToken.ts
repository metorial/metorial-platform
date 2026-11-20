import { db, type AgentTrackingIngestToken } from '@metorial/db';
import { ignoreNotFound, type AgentTracking } from '@metorial/module-agent-tracking-sync';

export let revokeAgentTrackingIngestToken = async (d: {
  agentTracking: AgentTracking;
  ingestToken: AgentTrackingIngestToken;
}) => {
  if (d.ingestToken.status != 'active') return d.ingestToken;

  let instance = await db.instance.findUniqueOrThrow({
    where: { oid: d.ingestToken.instanceOid },
    include: { organization: true }
  });

  await ignoreNotFound(
    d.agentTracking.ingestToken.revoke({
      organizationId: instance.organization.id,
      ingestTokenId: d.ingestToken.serviceIngestTokenId
    })
  );

  return await db.agentTrackingIngestToken.update({
    where: { oid: d.ingestToken.oid },
    data: { status: 'revoked', revokedAt: new Date() }
  });
};
