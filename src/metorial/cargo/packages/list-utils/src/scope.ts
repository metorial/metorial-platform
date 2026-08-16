export type CargoScope = {
  project: { oid: bigint };
  instance: { oid: bigint };
};

export type CargoOwnerScope =
  | { user: { oid: bigint } }
  | { organization: { oid: bigint } }
  | CargoScope;

export type CargoFileScope = {
  userOid: bigint | null;
  organizationOid: bigint | null;
  instanceOid: bigint | null;
};

export let cargoFileScope = (scope: CargoOwnerScope): CargoFileScope => ({
  userOid: 'user' in scope ? scope.user.oid : null,
  organizationOid: 'organization' in scope ? scope.organization.oid : null,
  instanceOid: 'instance' in scope ? scope.instance.oid : null
});

export let cargoOwnerScopeInstance = (scope: CargoOwnerScope) =>
  'instance' in scope ? scope.instance : null;

export let cargoOwnerScopeProject = (scope: CargoOwnerScope) =>
  'project' in scope ? scope.project : undefined;
