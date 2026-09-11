import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsOutpostsAccessSetOutput = {
  items: {
    object: 'outpost_access';
    id: string;
    outpostId: string;
    projectId: string;
    instanceId: string;
    organizationId: string;
    services: ('mcp_connection_proxy' | 'outpost_registration_proxy')[];
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOutpostsAccessSetOutput =
  mtMap.object<DashboardOrganizationsOutpostsAccessSetOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          outpostId: mtMap.objectField('outpost_id', mtMap.passthrough()),
          projectId: mtMap.objectField('project_id', mtMap.passthrough()),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          services: mtMap.objectField(
            'services',
            mtMap.array(mtMap.passthrough())
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type DashboardOrganizationsOutpostsAccessSetBody = {
  grants: {
    instanceId: string;
    services: ('mcp_connection_proxy' | 'outpost_registration_proxy')[];
  }[];
};

export let mapDashboardOrganizationsOutpostsAccessSetBody =
  mtMap.object<DashboardOrganizationsOutpostsAccessSetBody>({
    grants: mtMap.objectField(
      'grants',
      mtMap.array(
        mtMap.object({
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          services: mtMap.objectField(
            'services',
            mtMap.array(mtMap.passthrough())
          )
        })
      )
    )
  });

