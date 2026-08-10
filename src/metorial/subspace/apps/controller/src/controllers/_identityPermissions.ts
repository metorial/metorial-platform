let permissionMap = {
  'provider:call': 'provider_call',
  'provider:read': 'provider_read'
} as const;

let reversePermissionMap = {
  provider_call: 'provider:call',
  provider_read: 'provider:read'
} as const;

export let identityPermissionValues = Object.keys(permissionMap) as [
  keyof typeof permissionMap,
  ...(keyof typeof permissionMap)[]
];

export let mapIdentityPermissionsToService = (permissions?: (keyof typeof permissionMap)[]) =>
  permissions?.map(permission => permissionMap[permission]);

export let mapIdentityPermissionsFromService = (
  permissions?: (keyof typeof reversePermissionMap)[]
) => permissions?.map(permission => reversePermissionMap[permission]);
