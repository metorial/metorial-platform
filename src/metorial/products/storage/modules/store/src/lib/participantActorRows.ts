import type { Prisma, StoreParticipantActor } from '@metorial/db';

// Rows created only to record participation carry the storeParticipantActor id prefix and no
// permissions. Legacy permission semantics must not see them until Deploy B drops permissions.
let participationOnlyIdPrefix = 'stpa_';

export let isParticipationOnlyActorRow = (
  row: Pick<StoreParticipantActor, 'id' | 'permissions'>
) => row.id.startsWith(participationOnlyIdPrefix) && row.permissions.length == 0;

export let legacyStoreParticipantActorWhere = {
  NOT: {
    id: { startsWith: participationOnlyIdPrefix },
    permissions: { isEmpty: true }
  }
} satisfies Prisma.StoreParticipantActorWhereInput;
