import { v } from '@lowerdeck/validation';
import type { Organization } from '@metorial/db';
import { organizationPresenter } from '@metorial/presenters';
import { event } from '../../_lib/event';

export let organizationCreatedEvent = event({
  name: 'organization.created',
  payload: v.typedAny<{ organization: Organization }>('organization'),
  presenter: organizationPresenter
});
