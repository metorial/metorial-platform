import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Entity, Organization } from '../../prisma/generated/client';
import { eraseUserQueue, revokeUserTokens } from '../queues/eraseUser';

class UserErasureServiceImpl {
  // Tokens are revoked before the job is queued, so nothing new arrives for the user while the
  // erasure runs.
  async eraseUser(d: { organization: Organization; user: Entity }) {
    if (d.user.kind != 'user') {
      throw new ServiceError(
        badRequestError({ message: `The entity ${d.user.id} is not a user.` })
      );
    }

    await revokeUserTokens({ userEntityOid: d.user.oid });

    await eraseUserQueue.add({
      organizationId: d.organization.id,
      userId: d.user.id,
      phase: 'registry'
    });
  }
}

export let userErasureService = Service.create(
  'userErasureService',
  () => new UserErasureServiceImpl()
).build();
