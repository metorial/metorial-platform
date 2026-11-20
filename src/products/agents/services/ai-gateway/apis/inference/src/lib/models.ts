export type ListedModel = {
  slug: string;
  name: string;
  labSlug: string;
  releaseDate: Date | null;
  createdAt: Date;
};

let createdAtOf = (model: ListedModel) => model.releaseDate ?? model.createdAt;

export let openaiModel = (model: ListedModel) => ({
  id: model.slug,
  object: 'model' as const,
  created: Math.floor(createdAtOf(model).getTime() / 1000),
  owned_by: model.labSlug
});

export let anthropicModel = (model: ListedModel) => ({
  type: 'model' as const,
  id: model.slug,
  display_name: model.name,
  created_at: createdAtOf(model).toISOString()
});

export let openaiModelList = (models: ListedModel[]) => ({
  object: 'list' as const,
  data: models.map(openaiModel)
});

export let anthropicModelList = (models: ListedModel[]) => ({
  data: models.map(anthropicModel),
  has_more: false,
  first_id: models[0]?.slug ?? null,
  last_id: models[models.length - 1]?.slug ?? null
});
