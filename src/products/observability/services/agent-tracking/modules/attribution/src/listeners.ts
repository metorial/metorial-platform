import { Events, reattributionEvents } from '@mtsrc/agent-tracking-events';
import { invalidateAttributionContext } from './lib/context';

for (let event of reattributionEvents) {
  Events.listen(event, d => invalidateAttributionContext(d.organizationId));
}

Events.listen('entities.entity.merged:after', d =>
  invalidateAttributionContext(d.organizationId)
);
