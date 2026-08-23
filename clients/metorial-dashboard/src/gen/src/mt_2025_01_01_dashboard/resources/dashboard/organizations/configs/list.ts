import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsConfigsListOutput = {
  items: {
    object: 'organization.config';
    id: string;
    configTypeId: string;
    identifier: string;
    name: string;
    ownership: 'user' | 'organization' | 'user_organization';
    userId: string | null;
    organizationId: string | null;
    value: any;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsConfigsListOutput =
  mtMap.object<DashboardOrganizationsConfigsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          configTypeId: mtMap.objectField(
            'config_type_id',
            mtMap.passthrough()
          ),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          ownership: mtMap.objectField('ownership', mtMap.passthrough()),
          userId: mtMap.objectField('user_id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          value: mtMap.objectField('value', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

