import { getKnowledge } from '../knowledge/cache';

export let loadModelFamilyResolver = async () => {
  let catalog = await getKnowledge();

  return (modelId: string | null) =>
    modelId ? (catalog?.modelInfo(modelId)?.familyId ?? modelId) : modelId;
};
