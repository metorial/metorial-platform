import { mtMap } from '@metorial/util-resource-mapper';

export type ScmProvidersGetOutput = {
  object: 'scm.provider';
  id: string;
  type: 'github' | 'github_enterprise' | 'gitlab' | 'gitlab_selfhosted';
  name: string;
  description: string | null;
  apiUrl: string | null;
  webUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export let mapScmProvidersGetOutput = mtMap.object<ScmProvidersGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  apiUrl: mtMap.objectField('api_url', mtMap.passthrough()),
  webUrl: mtMap.objectField('web_url', mtMap.passthrough()),
  isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

