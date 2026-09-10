import { eventSet } from '../../_lib/event';
import { organizationCreatedEvent } from './organization';

export let coreEvents = eventSet({
  'organization.created': organizationCreatedEvent
});
