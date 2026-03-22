import { mtMap } from '@metorial/util-resource-mapper';

export type TokenGetOutput = {
  object: 'token';
  type:
    | 'fine_grained_token'
    | 'oauth_access_token'
    | 'unknown_token'
    | 'user_auth_token'
    | 'organization_management_token'
    | 'instance_access_token_secret'
    | 'instance_access_token_publishable';
};

export let mapTokenGetOutput = mtMap.object<TokenGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough())
});

