import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { oauthScopePermissionsType } from '../types';

export let v1OAuthScopePermissionsPresenter = Presenter.create(oauthScopePermissionsType)
  .presenter(async ({ permissions }) => ({
    object: 'management.oauth.scopes',
    permissions
  }))
  .schema(
    v.object({
      object: v.literal('management.oauth.scopes', {
        description: "String representing the object's type"
      }),
      permissions: v.array(
        v.object({
          identifier: v.string({
            name: 'identifier',
            description: 'The scope identifier'
          }),
          name: v.string({
            name: 'name',
            description: "The scope's name"
          }),
          description: v.string({
            name: 'description',
            description: 'A short description of what the scope allows'
          }),
          dependencies: v.array(v.string())
        })
      )
    })
  )
  .build();
