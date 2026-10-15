import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsAccessSetOutput = {
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

export let mapManagementOrganizationOutpostsAccessSetOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsAccessSetOutput>(
    [
      7,
      [
        1,
        [
          'outpost_id',
          'project_id',
          'instance_id',
          'organization_id',
          'created_at'
        ]
      ]
    ],
    1
  );

export type ManagementOrganizationOutpostsAccessSetBody = {
  grants: {
    instanceId: string;
    services: ('mcp_connection_proxy' | 'outpost_registration_proxy')[];
  }[];
};

export let mapManagementOrganizationOutpostsAccessSetBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsAccessSetBody>([
    ['grants', 0, [2, [1, ['instance_id']]]]
  ]);
