import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectBrandType } from '../types';

let getProjectBrandImageUrl = (image: PrismaJson.EntityImage | null | undefined) => {
  if (image?.type === 'file') return image.fileUrl ?? image.url ?? null;
  if (image?.type === 'url') return image.url ?? null;
  return null;
};

export let v1ProjectBrandPresenter = Presenter.create(projectBrandType)
  .presenter(async ({ projectBrand }) => ({
    object: 'project.brand' as const,

    id: projectBrand.id,
    identifier: projectBrand.identifier,
    name: projectBrand.name,
    image_url: getProjectBrandImageUrl(projectBrand.image),
    project_id: projectBrand.project.id,
    created_at: projectBrand.createdAt,
    updated_at: projectBrand.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('project.brand'),
      id: v.string(),
      identifier: v.string(),
      name: v.string(),
      image_url: v.nullable(v.string()),
      project_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
