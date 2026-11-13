import { getCatalog } from '../catalog';

export let loadModelFamilyResolver = async () => {
  let catalog = await getCatalog();

  return (modelId: string | null) =>
    modelId ? (catalog?.modelInfo(modelId)?.familyId ?? modelId) : modelId;
};
