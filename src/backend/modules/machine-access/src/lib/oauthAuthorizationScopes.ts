import { db, OAuthApplication, Organization, OrganizationMember } from '@metorial/db';

export let normalizeScopes = (scopes: string[]) => Array.from(new Set(scopes)).sort();

export let intersectScopes = (...scopeSets: Array<string[] | undefined | null>) => {
  let normalizedSets = scopeSets
    .filter((scopeSet): scopeSet is string[] => !!scopeSet)
    .map(scopeSet => normalizeScopes(scopeSet));

  if (normalizedSets.length == 0) return [];

  return normalizedSets[0].filter(scope =>
    normalizedSets.every(scopeSet => scopeSet.includes(scope))
  );
};

export let getUserEffectiveScopes = async (d: {
  organization: Organization;
  member: OrganizationMember;
  oauthApplication: OAuthApplication;
  requestedScopes: string[];
}) => {
  if (d.member.role == 'admin' || !d.organization.enforceTeamAccess) {
    return intersectScopes(d.oauthApplication.scopes, d.requestedScopes);
  }

  let teamScopes = await db.teamMember.findMany({
    where: {
      organizationActorOid: d.member.actorOid,
      team: {
        organizationOid: d.organization.oid
      }
    },
    include: {
      team: {
        include: {
          projects: {
            include: {
              roles: {
                include: {
                  teamRole: true
                }
              }
            }
          }
        }
      }
    }
  });

  let memberScopes = normalizeScopes(
    teamScopes.flatMap(teamMember =>
      teamMember.team.projects.flatMap(teamProject =>
        teamProject.roles.flatMap(role => role.teamRole.scopes)
      )
    )
  );

  return intersectScopes(memberScopes, d.oauthApplication.scopes, d.requestedScopes);
};
