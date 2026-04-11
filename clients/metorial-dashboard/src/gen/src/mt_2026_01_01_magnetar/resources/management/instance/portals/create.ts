import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsCreateOutput = {
  object: 'portal';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  slug: string;
  description: string | null;
  auth: {
    object: 'portal.auth';
    sessionExpiryTimeInSeconds: number;
    allowedRedirectUrlFilters: { url: string }[];
  };
  urls: { type: 'default'; url: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsCreateOutput =
  mtMap.object<ManagementInstancePortalsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    auth: mtMap.objectField(
      'auth',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        sessionExpiryTimeInSeconds: mtMap.objectField(
          'session_expiry_time_in_seconds',
          mtMap.passthrough()
        ),
        allowedRedirectUrlFilters: mtMap.objectField(
          'allowed_redirect_url_filters',
          mtMap.array(
            mtMap.object({ url: mtMap.objectField('url', mtMap.passthrough()) })
          )
        )
      })
    ),
    urls: mtMap.objectField(
      'urls',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          url: mtMap.objectField('url', mtMap.passthrough())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsCreateBody = {
  name: string;
  description?: string | undefined;
  allowedRedirectUrlFilters?: { url: string }[] | undefined;
  sessionExpiryTimeInSeconds?: number | undefined;
};

export let mapManagementInstancePortalsCreateBody =
  mtMap.object<ManagementInstancePortalsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    allowedRedirectUrlFilters: mtMap.objectField(
      'allowed_redirect_url_filters',
      mtMap.array(
        mtMap.object({ url: mtMap.objectField('url', mtMap.passthrough()) })
      )
    ),
    sessionExpiryTimeInSeconds: mtMap.objectField(
      'session_expiry_time_in_seconds',
      mtMap.passthrough()
    )
  });

