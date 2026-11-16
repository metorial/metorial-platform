import type { MergeSuggestion } from '@mtsrc/agent-tracking-db';
import type { EntityWithRelations } from '@mtsrc/agent-tracking-module-entities';
import { entityPresenter } from './entity';

type EntityForPresenter = Omit<EntityWithRelations, 'mergedInto'>;

export let mergeSuggestionPresenter = (
  suggestion: MergeSuggestion & {
    discoveredEntity: EntityForPresenter;
    managedEntity: EntityForPresenter;
  }
) => ({
  object: 'agent_tracking#merge_suggestion',

  id: suggestion.id,
  status: suggestion.status,
  score: suggestion.score,
  reasons: suggestion.reasons,

  discoveredEntity: entityPresenter({ ...suggestion.discoveredEntity, mergedInto: null }),
  managedEntity: entityPresenter({ ...suggestion.managedEntity, mergedInto: null }),

  createdAt: suggestion.createdAt,
  updatedAt: suggestion.updatedAt
});
