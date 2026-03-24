import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Organization, OrganizationActor, Prisma } from '@metorial/db';

let oauthAuthorizationLogInclude = {
  oauthApplication: {
    include: {
      organization: true
    }
  },
  organization: true,
  user: true
} as const;

type OAuthAuthorizationLogBase = Prisma.OAuthAuthorizationFlowGetPayload<{
  include: typeof oauthAuthorizationLogInclude;
}>;

export type OAuthAuthorizationLogWithRelations = OAuthAuthorizationLogBase & {
  actor: (OrganizationActor & { organization: Organization }) | null;
};

class OAuthAuthorizationLogService {
  private async attachActors(d: {
    organization: Organization;
    logs: OAuthAuthorizationLogBase[];
  }): Promise<OAuthAuthorizationLogWithRelations[]> {
    let userOids = d.logs
      .map(log => log.userOid)
      .filter((userOid): userOid is bigint => Boolean(userOid));

    if (userOids.length === 0) {
      return d.logs.map(log => ({
        ...log,
        actor: null
      }));
    }

    let members = await db.organizationMember.findMany({
      where: {
        organizationOid: d.organization.oid,
        userOid: {
          in: userOids
        }
      },
      include: {
        actor: true
      }
    });

    let actorByUserOid = new Map(
      members.map(member => [
        member.userOid.toString(),
        {
          ...member.actor,
          organization: d.organization
        }
      ])
    );

    return d.logs.map(log => ({
      ...log,
      actor: log.userOid ? (actorByUserOid.get(log.userOid.toString()) ?? null) : null
    }));
  }

  async listOAuthAuthorizationLogs(d: {
    organization: Organization;
    oauthApplicationIds?: string[];
    userIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let logs = await db.oAuthAuthorizationFlow.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid,
            oauthApplication: d.oauthApplicationIds
              ? {
                  id: {
                    in: d.oauthApplicationIds
                  }
                }
              : undefined,
            user: d.userIds
              ? {
                  id: {
                    in: d.userIds
                  }
                }
              : undefined
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: oauthAuthorizationLogInclude
        });

        return this.attachActors({
          organization: d.organization,
          logs
        });
      })
    );
  }
}

export let oauthAuthorizationLogService = Service.create(
  'oauthAuthorizationLogService',
  () => new OAuthAuthorizationLogService()
).build();
