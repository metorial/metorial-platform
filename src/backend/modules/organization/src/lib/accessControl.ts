import { badRequestError, ServiceError } from '@lowerdeck/error';
import { scopeDefinitions } from '@metorial/module-access/src/definitions/scopeDefinitions';
import { Scope, scopes } from '@metorial/module-access/src/definitions/scopeValues';

export type PolicyDocument = PrismaJson.PolicyDocument;

let allScopes = new Set(scopes);
let scopeDependencyMap = new Map(
  scopeDefinitions.map(scope => [scope.identifier, scope.dependencies])
);

export let getMissingScopeDependencies = (permissionSet: string[]) => {
  let permissionSetLookup = new Set(permissionSet);
  let missingDependencies = new Set<string>();

  permissionSet.forEach(permission => {
    let dependencies = scopeDependencyMap.get(permission as Scope) || [];
    dependencies.forEach(dependency => {
      if (!permissionSetLookup.has(dependency)) {
        missingDependencies.add(dependency);
      }
    });
  });

  return [...missingDependencies];
};

export let normalizeScopes = (input: string[] | undefined) => {
  let normalized = [...new Set(input || [])];
  if (normalized.some(scope => !allScopes.has(scope as Scope))) {
    throw new ServiceError(
      badRequestError({
        message: 'One or more scopes are invalid'
      })
    );
  }

  let missingDependencies = getMissingScopeDependencies(normalized);
  if (missingDependencies.length > 0) {
    throw new ServiceError(
      badRequestError({
        message: `Missing scope dependencies: ${missingDependencies.join(', ')}`
      })
    );
  }

  return normalized;
};

export let normalizePolicyDocument = (document: PolicyDocument): PolicyDocument => ({
  access: document.access.map(entry => ({
    target: entry.target,
    scopes: entry.scopes ? normalizeScopes(entry.scopes) : undefined,
    roles: entry.roles ? [...new Set(entry.roles)] : undefined
  }))
});
