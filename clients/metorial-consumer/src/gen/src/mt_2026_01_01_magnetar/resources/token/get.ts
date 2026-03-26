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
  organization: {
    object: 'token.organization';
    id: string;
    name: string;
    slug: string;
  } | null;
  instance: {
    object: 'token.instance';
    id: string;
    name: string;
    slug: string;
    projectId: string;
  } | null;
  project: {
    object: 'token.project';
    id: string;
    name: string;
    slug: string;
  } | null;
  actor: {
    object: 'token.organization_actor';
    id: string;
    type: 'member' | 'machine_access';
    name: string;
  } | null;
  member: {
    object: 'token.organization_member';
    id: string;
    name: string;
  } | null;
  user: { object: 'token.user'; id: string; name: string } | null;
};

export let mapTokenGetOutput = mtMap.object<TokenGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  organization: mtMap.objectField(
    'organization',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      slug: mtMap.objectField('slug', mtMap.passthrough())
    })
  ),
  instance: mtMap.objectField(
    'instance',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      slug: mtMap.objectField('slug', mtMap.passthrough()),
      projectId: mtMap.objectField('project_id', mtMap.passthrough())
    })
  ),
  project: mtMap.objectField(
    'project',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      slug: mtMap.objectField('slug', mtMap.passthrough())
    })
  ),
  actor: mtMap.objectField(
    'actor',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough())
    })
  ),
  member: mtMap.objectField(
    'member',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough())
    })
  ),
  user: mtMap.objectField(
    'user',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough())
    })
  )
});

