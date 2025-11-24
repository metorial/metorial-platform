import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSsoTenantsUsersGetOutput = {
  object: 'sso.tenant';
  id: string;
  ssoTenant: {
    object: 'sso.tenant';
    id: string;
    name: string;
    ssoTenantId: string;
    ssoTenantClientId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  ssoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  profiles: {
    object: 'sso.user_profile';
    id: string;
    ssoConnectionId: string;
    ssoTenant: {
      object: 'sso.tenant';
      id: string;
      name: string;
      ssoTenantId: string;
      ssoTenantClientId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    email: string;
    uid: string;
    sub: string;
    firstName: string;
    lastName: string;
    roles: string[];
    groups: string[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSsoTenantsUsersGetOutput =
  mtMap.object<ManagementInstanceSsoTenantsUsersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    ssoTenant: mtMap.objectField(
      'sso_tenant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough()),
        ssoTenantClientId: mtMap.objectField(
          'sso_tenant_client_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    ssoUserId: mtMap.objectField('sso_user_id', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    firstName: mtMap.objectField('first_name', mtMap.passthrough()),
    lastName: mtMap.objectField('last_name', mtMap.passthrough()),
    profiles: mtMap.objectField(
      'profiles',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          ssoConnectionId: mtMap.objectField(
            'sso_connection_id',
            mtMap.passthrough()
          ),
          ssoTenant: mtMap.objectField(
            'sso_tenant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              ssoTenantId: mtMap.objectField(
                'sso_tenant_id',
                mtMap.passthrough()
              ),
              ssoTenantClientId: mtMap.objectField(
                'sso_tenant_client_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          email: mtMap.objectField('email', mtMap.passthrough()),
          uid: mtMap.objectField('uid', mtMap.passthrough()),
          sub: mtMap.objectField('sub', mtMap.passthrough()),
          firstName: mtMap.objectField('first_name', mtMap.passthrough()),
          lastName: mtMap.objectField('last_name', mtMap.passthrough()),
          roles: mtMap.objectField('roles', mtMap.array(mtMap.passthrough())),
          groups: mtMap.objectField('groups', mtMap.array(mtMap.passthrough())),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

