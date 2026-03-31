import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceScmProvidersCreateOutput = {
  object: 'scm.provider.setup_session';
  id: string;
  type: 'github' | 'github_enterprise' | 'gitlab' | 'gitlab_selfhosted';
  url: string;
  status: 'pending' | 'completed' | 'expired';
  provider: {
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
  } | null;
  createdAt: Date;
  expiresAt: Date;
};

export let mapManagementInstanceScmProvidersCreateOutput =
  mtMap.object<ManagementInstanceScmProvidersCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
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
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceScmProvidersCreateBody = {
  type: 'github_enterprise' | 'gitlab_selfhosted';
};

export let mapManagementInstanceScmProvidersCreateBody =
  mtMap.object<ManagementInstanceScmProvidersCreateBody>({
    type: mtMap.objectField('type', mtMap.passthrough())
  });

