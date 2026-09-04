import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { organizationScopesType } from '../../types';

export let v1OrganizationScopesPresenter = Presenter.create(organizationScopesType)
  .presenter(async ({ scopes }) => ({
    object: 'organization_scopes',
    scopes
  }))
  .schema(
    v.object({
      object: v.literal('organization_scopes'),
      scopes: v.array(v.string())
    })
  )
  .build();
