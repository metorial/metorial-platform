import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsLayoutsSetOutput = {
  object: 'organization.layout';
  id: string;
  layoutTypeId: string;
  identifier: string;
  name: string;
  ownership: 'user' | 'organization' | 'user_organization';
  userId: string | null;
  organizationId: string | null;
  value: any;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsLayoutsSetOutput =
  mtMap.object<DashboardOrganizationsLayoutsSetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    layoutTypeId: mtMap.objectField('layout_type_id', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    ownership: mtMap.objectField('ownership', mtMap.passthrough()),
    userId: mtMap.objectField('user_id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    value: mtMap.objectField('value', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsLayoutsSetBody = { value: any };

export let mapDashboardOrganizationsLayoutsSetBody =
  mtMap.object<DashboardOrganizationsLayoutsSetBody>({
    value: mtMap.objectField('value', mtMap.passthrough())
  });

