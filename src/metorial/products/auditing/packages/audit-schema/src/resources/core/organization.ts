import { v } from '@lowerdeck/validation';
import { Organization } from '@metorial/db';
import { organizationPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let organizationResource = resource({
  name: 'organization',
  payload: v.typedAny<{ organization: Organization }>('organization'),
  presenter: organizationPresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
