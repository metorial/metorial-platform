import { v } from '@lowerdeck/validation';
import {
  Organization,
  OrganizationActor,
  OrganizationMember,
  Team,
  TeamMember
} from '@metorial/db';
import { organizationActorPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let organizationActorResource = resource({
  name: 'organization_actor',
  payload: v.typedAny<{
    organizationActor: OrganizationActor & {
      organization: Organization;
      teams?: (TeamMember & { team: Team })[] | null | undefined;
      member?: OrganizationMember | null;
    };
  }>('organization_actor'),
  presenter: organizationActorPresenter,
  actions: {
    create: true,
    update: true
  }
});
