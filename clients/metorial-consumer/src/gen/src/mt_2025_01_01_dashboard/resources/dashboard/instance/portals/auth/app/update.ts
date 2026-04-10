import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsAuthAppUpdateOutput = {
  object: 'portal.auth.app';
  id: string;
  clientId: string;
  slug: string | null;
  defaultRedirectUrl: string;
  redirectDomains: string[];
  emailWhitelist: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsAuthAppUpdateOutput =
  mtMap.object<DashboardInstancePortalsAuthAppUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    clientId: mtMap.objectField('client_id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    defaultRedirectUrl: mtMap.objectField(
      'default_redirect_url',
      mtMap.passthrough()
    ),
    redirectDomains: mtMap.objectField(
      'redirect_domains',
      mtMap.array(mtMap.passthrough())
    ),
    emailWhitelist: mtMap.objectField(
      'email_whitelist',
      mtMap.array(mtMap.passthrough())
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstancePortalsAuthAppUpdateBody = {
  emailWhitelist?: string[] | undefined;
};

export let mapDashboardInstancePortalsAuthAppUpdateBody =
  mtMap.object<DashboardInstancePortalsAuthAppUpdateBody>({
    emailWhitelist: mtMap.objectField(
      'email_whitelist',
      mtMap.array(mtMap.passthrough())
    )
  });

