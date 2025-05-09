let machineAccessOrganizationManagementScopeRaw = [
  'organization:read' as const,
  'organization:write' as const,

  'organization.invite:read' as const,
  'organization.invite:write' as const,

  'organization.project:read' as const,
  'organization.project:write' as const,

  'organization.machine_access.api_key.organization:read' as const,
  'organization.machine_access.api_key.organization:write' as const,
  'organization.machine_access.api_key.instance:read' as const,
  'organization.machine_access.api_key.instance:write' as const
] as const satisfies readonly (`organization.${string}` | `organization:${string}`)[];

export type MachineAccessOrganizationManagementScope =
  (typeof machineAccessOrganizationManagementScopeRaw)[number];

export let machineAccessOrganizationManagementScopes: MachineAccessOrganizationManagementScope[] =
  [...machineAccessOrganizationManagementScopeRaw];
