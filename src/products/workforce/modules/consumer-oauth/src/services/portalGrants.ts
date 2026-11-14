import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { db, Prisma, type ConsumerProfile } from '@metorial/db';
import { magicMcpTokenService } from '@metorial/module-magic';
import type { ConsumerPortalGrantStatus, ConsumerPortalGrantView } from './_types';

let grantInclude = {
  consumerAuthClient: true,
  magicMcpToken: {
    include: {
      uses: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } }
    }
  }
} satisfies Prisma.ConsumerAuthAttemptInclude;

type PortalGrant = Prisma.ConsumerAuthAttemptGetPayload<{ include: typeof grantInclude }>;

let grantStatuses: ConsumerPortalGrantStatus[] = ['active', 'revoked'];

export let toConsumerPortalGrantView = (grant: PortalGrant): ConsumerPortalGrantView => ({
  id: grant.id,
  status: grant.status == 'revoked' ? 'revoked' : 'active',
  scopes: [],
  oauthApplication: {
    id: grant.consumerAuthClient.id,
    name: grant.consumerAuthClient.name,
    description: null,
    websiteUrl: grant.consumerAuthClient.clientUri,
    image: grant.consumerAuthClient.logoUri
      ? { type: 'url', url: grant.consumerAuthClient.logoUri }
      : null
  },
  lastUsedAt: grant.magicMcpToken?.uses[0]?.createdAt ?? null,
  revokedAt: grant.revokedAt,
  createdAt: grant.authorizedAt ?? grant.createdAt
});

class ConsumerPortalGrantService {
  async listGrants(d: {
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    statuses?: ConsumerPortalGrantStatus[];
  }) {
    let grants = await db.consumerAuthAttempt.findMany({
      where: {
        consumerProfileOid: d.consumerProfile.oid,
        status: { in: d.statuses ?? grantStatuses }
      },
      include: grantInclude,
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    return grants.map(toConsumerPortalGrantView);
  }

  async findGrantById(d: { consumerProfile: Pick<ConsumerProfile, 'oid'>; grantId: string }) {
    let grant = await db.consumerAuthAttempt.findFirst({
      where: {
        id: d.grantId,
        consumerProfileOid: d.consumerProfile.oid,
        status: { in: grantStatuses }
      },
      include: grantInclude
    });

    return grant ? toConsumerPortalGrantView(grant) : null;
  }

  async revokeGrant(d: {
    consumerProfile: Pick<ConsumerProfile, 'oid' | 'id' | 'organizationOid' | 'instanceOid'>;
    grantId: string;
    context: AuditScope['context'];
  }) {
    let grant = await this.findGrant(d);
    if (grant.status == 'revoked') return toConsumerPortalGrantView(grant);

    let revoked = await db.consumerAuthAttempt.update({
      where: { oid: grant.oid },
      data: { status: 'revoked', revokedAt: new Date() },
      include: grantInclude
    });

    if (grant.magicMcpToken && grant.magicMcpToken.status != 'deleted') {
      await magicMcpTokenService.deleteMagicMcpToken({
        token: grant.magicMcpToken,
        auditScope: {
          organizationOid: d.consumerProfile.organizationOid,
          instanceOid: d.consumerProfile.instanceOid,
          actor: { type: 'consumer_profile', id: d.consumerProfile.id },
          context: d.context
        }
      });
    }

    return toConsumerPortalGrantView(revoked);
  }

  private async findGrant(d: {
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    grantId: string;
  }) {
    let grant = await db.consumerAuthAttempt.findFirst({
      where: {
        id: d.grantId,
        consumerProfileOid: d.consumerProfile.oid,
        status: { in: grantStatuses }
      },
      include: grantInclude
    });

    if (!grant) throw new ServiceError(notFoundError('oauth_authorization', d.grantId));

    return grant;
  }
}

export let consumerPortalGrantService = Service.create(
  'consumerPortalGrantService',
  () => new ConsumerPortalGrantService()
).build();
