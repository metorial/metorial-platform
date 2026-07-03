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
};

export let byValueThenId = <T extends { id: string; value: string }>(a: T, b: T) => {
  let byValue = a.value.localeCompare(b.value);
  if (byValue !== 0) return byValue;

  return a.id.localeCompare(b.id);
};

let stableJson = (value: unknown) => JSON.stringify(value);

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
      'assignedGroups',
      'assignedRoles'
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

  if (stableJson(prev.assignedGroups) !== stableJson(next.assignedGroups)) {
    changedFields.push('assignedGroups');
  }

  if (stableJson(prev.assignedRoles) !== stableJson(next.assignedRoles)) {
    changedFields.push('assignedRoles');
  }

  return changedFields;
};
