import { v } from '@lowerdeck/validation';
import { Organization, OrganizationActor, OrganizationInvite } from '@metorial/db';
import { organizationInvitePresenter } from '@metorial/presenters';
import { resource, type ResourcePresenter } from '../../_lib/resource';

let auditOrganizationInvitePresenter: ResourcePresenter<
  typeof organizationInvitePresenter.type
> = {
  type: organizationInvitePresenter.type,
  present: input => context => {
    let result = organizationInvitePresenter.present(input)(context);

    return {
      ...result,
      run: async (...args: Parameters<typeof result.run>) => {
        let presented: any = await result.run(...args);
        if (!presented?.invite_link) return presented;

        return {
          ...presented,
          invite_link: { ...presented.invite_link, key: null, url: null }
        };
      }
    };
  }
};

export let organizationInviteResource = resource({
  name: 'organization_invite',
  payload: v.typedAny<{
    organizationInvite: OrganizationInvite & {
      organization: Organization;
      invitedBy: OrganizationActor;
    };
  }>('organization_invite'),
  presenter: auditOrganizationInvitePresenter,
  actions: {
    create: true,
    update: true,
    delete: true,
    accept: true,
    reject: true
  }
});
