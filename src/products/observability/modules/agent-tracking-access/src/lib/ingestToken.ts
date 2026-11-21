import { db, type AgentTrackingIngestToken, type Organization } from '@metorial/db';
import {
  ignoreNotFound,
  type AgentTracking,
  type AgentTrackingCallOpts
} from '@metorial/module-agent-tracking-sync';

let unmirroredRevokeCallOpts: AgentTrackingCallOpts = { timeoutMs: 3_000 };

export let mirrorIngestToken = async <T>(
  d: {
    agentTracking: AgentTracking;
    organization: Pick<Organization, 'id'>;
    serviceIngestTokenId: string;
  },
  mirror: () => Promise<T>
) => {
  try {
    return await mirror();
  } catch (error) {
    try {
      await ignoreNotFound(
        d.agentTracking.ingestToken.revoke(
          { organizationId: d.organization.id, ingestTokenId: d.serviceIngestTokenId },
          unmirroredRevokeCallOpts
        )
      );
    } catch {}

    throw error;
  }
};

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
