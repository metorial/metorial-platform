import type { MergeSuggestion } from '../../prisma/generated/client';
import type { EntityWithRelations } from '../services/entity';
import { entityPresenter } from './entity';

type EntityForPresenter = Omit<EntityWithRelations, 'mergedInto'>;

export let mergeSuggestionPresenter = (
  suggestion: MergeSuggestion & {
    discoveredEntity: EntityForPresenter;
    managedEntity: EntityForPresenter;
  }
) => ({
  object: 'groundstation#merge_suggestion',

  id: suggestion.id,
  status: suggestion.status,
  score: suggestion.score,
  reasons: suggestion.reasons,

  discoveredEntity: entityPresenter({ ...suggestion.discoveredEntity, mergedInto: null }),
  managedEntity: entityPresenter({ ...suggestion.managedEntity, mergedInto: null }),

  createdAt: suggestion.createdAt,
  updatedAt: suggestion.updatedAt
});
