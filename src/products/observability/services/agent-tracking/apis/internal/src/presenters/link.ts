import type { LinkWithEntities } from '@mtsrc/agent-tracking-module-entities';
import { entityReferencePresenter } from './entity';

export let linkPresenter = (link: LinkWithEntities) => ({
  object: 'agent_tracking#entity_link',

  id: link.id,
  type: link.type,
  origin: link.origin,
  weight: link.weight,

  from: entityReferencePresenter(link.from),
  to: entityReferencePresenter(link.to),

  validFrom: link.validFrom,
  validTo: link.validTo,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt
});
