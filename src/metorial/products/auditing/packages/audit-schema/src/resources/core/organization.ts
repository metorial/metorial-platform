import { v } from '@lowerdeck/validation';
import { Organization } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let organizationResource = resource({
  name: 'organization',
  payload: v.typedAny<Organization>('organization'),
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
