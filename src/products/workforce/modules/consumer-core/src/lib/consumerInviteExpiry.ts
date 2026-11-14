import type { ConsumerInvite } from '@metorial/db';
import { addDays } from 'date-fns';

export let consumerInviteTtlDays = 14;

export let getNewConsumerInviteExpiry = () => addDays(new Date(), consumerInviteTtlDays);

export let getConsumerInviteExpiresAt = (
  invite: Pick<ConsumerInvite, 'expiresAt' | 'legacyGraceStartedAt'>
) => {
  if (!invite.legacyGraceStartedAt) return invite.expiresAt;

  let graceEndsAt = addDays(invite.legacyGraceStartedAt, consumerInviteTtlDays);

  return graceEndsAt > invite.expiresAt ? graceEndsAt : invite.expiresAt;
};

export let isConsumerInviteExpired = (
  invite: Pick<ConsumerInvite, 'expiresAt' | 'legacyGraceStartedAt'>
) => getConsumerInviteExpiresAt(invite) < new Date();
