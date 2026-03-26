import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsServiceAccountsCreateOutput = {
  object: 'machine_access.service_account';
  id: string;
  status: 'active' | 'archived';
  name: string;
  description: string | null;
  scopes: { identifier: string; name: string; description: string }[];
  clientId: string;
  policies: {
    object: 'management.access_policy#preview';
    id: string;
    type: 'everyone' | 'admin' | 'custom';
    name: string;
    slug: string;
  }[];
  clientSecrets: {
    object: 'machine_access.oauth_application_client_secret';
    id: string;
    preview: string;
    secret: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }[];
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsServiceAccountsCreateOutput =
  mtMap.object<DashboardOrganizationsServiceAccountsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    scopes: mtMap.objectField(
      'scopes',
      mtMap.array(
        mtMap.object({
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough())
        })
      )
    ),
    clientId: mtMap.objectField('client_id', mtMap.passthrough()),
    policies: mtMap.objectField(
      'policies',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough())
        })
      )
    ),
    clientSecrets: mtMap.objectField(
      'client_secrets',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          preview: mtMap.objectField('preview', mtMap.passthrough()),
          secret: mtMap.objectField('secret', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date())
        })
      )
    ),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsServiceAccountsCreateBody = {
  name: string;
  description?: string | undefined;
  scopes: string[];
};

export let mapDashboardOrganizationsServiceAccountsCreateBody =
  mtMap.object<DashboardOrganizationsServiceAccountsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
  });

