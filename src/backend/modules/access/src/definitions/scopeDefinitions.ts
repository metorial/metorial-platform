import { getScopeDefinition, ScopeDefinition } from './scopeMetadata';
import { scopes } from './scopeValues';

export let scopeDefinitions: ScopeDefinition[] = scopes.map(getScopeDefinition);

let scopeIdentifierSet = new Set(scopes);
let invalidScopeDependencies = scopeDefinitions.flatMap(scope =>
  scope.dependencies
    .filter(dependency => !scopeIdentifierSet.has(dependency))
    .map(dependency => ({ scope: scope.identifier, dependency }))
);

if (invalidScopeDependencies.length > 0) {
  let details = invalidScopeDependencies
    .map(item => `${item.scope} -> ${item.dependency}`)
    .join(', ');
  throw new Error(`Invalid scope dependencies detected: ${details}`);
}

export let instanceScopeDefinitions: ScopeDefinition[] = scopeDefinitions.filter(scope =>
  scope.identifier.startsWith('instance.')
);
