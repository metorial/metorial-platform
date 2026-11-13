import type { PendingMembership } from '@mtsrc/agent-tracking-db';
import type { MembershipCsvError } from '@mtsrc/agent-tracking-module-entities';
import type { LinkWithEntities } from '@mtsrc/agent-tracking-module-entities';
import type { MembershipImportTeam } from '@mtsrc/agent-tracking-module-entities';
import { entityReferencePresenter } from './entity';
import { linkPresenter } from './link';

let pendingMembershipPresenter = (membership: PendingMembership) => ({
  object: 'agent_tracking#pending_membership',

  id: membership.id,
  email: membership.email,
  type: membership.type,
  weight: membership.weight,
  validFrom: membership.validFrom
});

export let membershipChangePresenter = (change: {
  added: LinkWithEntities[];
  removed: LinkWithEntities[];
  kept: LinkWithEntities[];
  changed: LinkWithEntities[];
  pending: PendingMembership[];
  pendingRemoved: string[];
}) => ({
  object: 'agent_tracking#membership_change',

  added: change.added.map(linkPresenter),
  removed: change.removed.map(linkPresenter),
  changed: change.changed.map(linkPresenter),
  kept: change.kept.map(linkPresenter),

  pending: change.pending.map(pendingMembershipPresenter),
  pendingRemoved: change.pendingRemoved
});

export let membershipImportPresenter = (result: {
  dryRun: boolean;
  teams: MembershipImportTeam[];
  unknownTeams: string[];
  errors: MembershipCsvError[];
}) => ({
  object: 'agent_tracking#membership_import',

  dryRun: result.dryRun,

  teams: result.teams.map(team => ({
    target: entityReferencePresenter(team.target),
    added: team.added,
    pending: team.pending,
    removed: team.removed,
    changed: team.changed,
    unchanged: team.unchanged
  })),

  unknownTeams: result.unknownTeams,
  errors: result.errors
});
