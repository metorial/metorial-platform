import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { projectBrandType } from '../../types';

export let v1ProjectBrandPresenter = Presenter.create(projectBrandType)
  .presenter(async ({ projectBrand }) => ({
    object: 'project.brand' as const,

    id: projectBrand.id,
    identifier: projectBrand.identifier,
    name: projectBrand.name,
    image_url: await getImageUrl(projectBrand),
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
      image_url: v.string(),
      project_id: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
