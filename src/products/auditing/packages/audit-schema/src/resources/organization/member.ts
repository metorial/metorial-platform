import { v } from '@lowerdeck/validation';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Team,
  TeamMember
} from '@metorial/db';
import { organizationMemberPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let organizationMemberResource = resource({
  name: 'organization_member',
  payload: v.typedAny<{
    organizationMember: OrganizationMember & {
      organization: Organization;
      actor: OrganizationActor & {
        teams: (TeamMember & { team: Team })[];
      };
      policies?: (AccessPolicyAssignment & {
        accessPolicy: AccessPolicy;
      })[];
      user: { id: string; email: string; name: string; image: PrismaJson.EntityImage };
    };
  }>('organization_member'),
  presenter: organizationMemberPresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
