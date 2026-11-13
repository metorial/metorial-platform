import { Service } from '@lowerdeck/service';
import { expireKnowledgeCheck, getKnowledge, resetKnowledgeCache } from '../lib/cache';
import { getDimensionMaps, resetDimensionMaps } from '../lib/dimensions';

class KnowledgeCacheServiceImpl {
  async getKnowledge() {
    return await getKnowledge();
  }

  async getDimensionMaps() {
    return await getDimensionMaps();
  }

  expire() {
    expireKnowledgeCheck();
  }

  reset() {
    resetKnowledgeCache();
    resetDimensionMaps();
  }
}

export let knowledgeCacheService = Service.create(
  'knowledgeCacheService',
  () => new KnowledgeCacheServiceImpl()
).build();
