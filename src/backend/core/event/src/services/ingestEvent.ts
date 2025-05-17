import { Instance, Organization, OrganizationActor } from '@metorial/db';
import { Service } from '@metorial/service';
import { EventTypes } from '../definitions';

class IngestEventServiceImpl {
  async ingest<T extends keyof EventTypes>(
    event: T,
    payload: EventTypes[T] & {
      performedBy?: OrganizationActor;
      organization: Organization;
      instance: Instance;
    }
  ) {}
}

export let ingestEventService = Service.create(
  'ingestEvent',
  () => new IngestEventServiceImpl()
).build();
