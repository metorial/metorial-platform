import { resolveOrganizationOidForInstance } from '@metorial-subspace/module-tenant/src/lib/systemAuditScope';
import type { AuditActor, AuditScope } from '@metorial/audit-scope';

export let getParticipantAuditActor = (participant: {
  id: string;
  type: string;
  name: string;
  identityOid: bigint | null;
  identityActorOid: bigint | null;
  identity?: { id: string } | null;
  identityActor?: { id: string } | null;
}): AuditActor => ({
  type: 'resource_actor',
  id: participant.identityActor?.id ?? participant.id,
  metadata: {
    participantId: participant.id,
    participantType: participant.type,
    participantName: participant.name,
    identityId: participant.identity?.id ?? null,
    identityActorId: participant.identityActor?.id ?? null
  }
});

export let getDataPlaneAuditScope = async (d: {
  instanceOid: bigint | null;
  actor: AuditActor;
}): Promise<AuditScope | null> => {
  if (d.instanceOid === null) return null;

  let organizationOid = await resolveOrganizationOidForInstance(d.instanceOid);
  if (organizationOid === null) return null;

  return {
    organizationOid,
    instanceOid: d.instanceOid,
    actor: d.actor,
    context: { ip: '' }
  };
};
