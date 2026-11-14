export type AssignedGroup = {
  id: string;
  value: string;
  displayName: string | null;
};

export type AssignedRole = {
  id: string;
  value: string;
  displayName: string | null;
};

export type SsoUserProfileSnapshot = {
  id: string;
  connectionId: string;
  status: string;
  email: string;
  uid: string;
  sub: string | null;
  firstName: string;
  lastName: string;
  ownerDirectoryId: string | null;
  groups: AssignedGroup[];
  roles: AssignedRole[];
};

export type SsoUserChangeSnapshot = {
  user: {
    id: string;
    oid: string;
    tenantOid: string;
    status: string;
    email: string;
    firstName: string;
    lastName: string;
    ownerProfileOid: string | null;
  };
  ownerProfile: {
    id: string;
    oid: string;
    status: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  assignedGroups: AssignedGroup[];
  assignedRoles: AssignedRole[];
  profiles?: SsoUserProfileSnapshot[];
};

export let byValueThenId = <T extends { id: string; value: string }>(a: T, b: T) => {
  let byValue = a.value.localeCompare(b.value);
  if (byValue !== 0) return byValue;

  return a.id.localeCompare(b.id);
};

export let byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

let stableJson = (value: unknown) => JSON.stringify(value);

let profileAttributesOf = (profiles: SsoUserProfileSnapshot[]) =>
  profiles.map(({ groups, roles, ...attributes }) => attributes);

let profileMembershipsOf = (profiles: SsoUserProfileSnapshot[]) =>
  profiles.map(({ id, groups, roles }) => ({ id, groups, roles }));

export let getChangedSsoUserFields = (
  prev: SsoUserChangeSnapshot | null,
  next: SsoUserChangeSnapshot
) => {
  if (!prev) {
    return [
      'status',
      'email',
      'firstName',
      'lastName',
      'ownerProfile',
      'profiles',
      'assignedGroups',
      'assignedRoles',
      'profileMemberships'
    ];
  }

  let changedFields: string[] = [];

  for (let field of ['status', 'email', 'firstName', 'lastName'] as const) {
    if (prev.user[field] !== next.user[field]) changedFields.push(field);
  }

  if (prev.user.ownerProfileOid !== next.user.ownerProfileOid) {
    changedFields.push('ownerProfile');
  } else if (stableJson(prev.ownerProfile) !== stableJson(next.ownerProfile)) {
    changedFields.push('ownerProfile');
  }

  let prevProfiles = prev.profiles ?? [];
  let nextProfiles = next.profiles ?? [];

  if (stableJson(profileAttributesOf(prevProfiles)) !== stableJson(profileAttributesOf(nextProfiles))) {
    changedFields.push('profiles');
  }

  if (stableJson(prev.assignedGroups) !== stableJson(next.assignedGroups)) {
    changedFields.push('assignedGroups');
  }

  if (stableJson(prev.assignedRoles) !== stableJson(next.assignedRoles)) {
    changedFields.push('assignedRoles');
  }

  if (
    stableJson(profileMembershipsOf(prevProfiles)) !== stableJson(profileMembershipsOf(nextProfiles))
  ) {
    changedFields.push('profileMemberships');
  }

  return changedFields;
};
