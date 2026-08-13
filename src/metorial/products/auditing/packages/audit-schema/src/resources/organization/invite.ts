import { v } from '@lowerdeck/validation';
import { Organization, OrganizationActor, OrganizationInvite } from '@metorial/db';
import { organizationInvitePresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let organizationInviteResource = resource({
  name: 'organization_invite',
  payload: v.typedAny<{
    organizationInvite: OrganizationInvite & {
      organization: Organization;
      invitedBy: OrganizationActor;
    };
  }>('organization_invite'),
  presenter: organizationInvitePresenter,
  actions: {
    create: true,
    update: true,
    delete: true,
    accept: true,
    reject: true
  }
});
