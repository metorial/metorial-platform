import type { DatasetDef } from '../catalog';
import { always, type Predicate, toQuery } from './predicate';
import type { TimeRange } from './types';

export type EffectiveScope = {
  organizationId: string;
  projectIds?: string[];
  instanceIds?: string[];
};

export type Stage = Record<string, unknown>;

export class ScopeViolationError extends Error {}

let allowedStages = new Set([
  '$match',
  '$project',
  '$addFields',
  '$set',
  '$unwind',
  '$group',
  '$sort',
  '$limit',
  '$skip',
  '$count'
]);

// The only way to start a pipeline: tenancy and range come first, as literals (11 §8.2).
export let scan = (d: {
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  predicate?: Predicate;
  extra?: Record<string, unknown>;
}): Stage[] => {
  let { dataset, scope } = d;

  if (scope.projectIds && !dataset.scopePaths.project) {
    throw new ScopeViolationError(`"${dataset.name}" can only be scoped by instance.`);
  }

  let match: Record<string, unknown> = {
    organizationId: scope.organizationId,
    ...(scope.projectIds ? { [dataset.scopePaths.project!]: { $in: scope.projectIds } } : {}),
    ...(scope.instanceIds
      ? { [dataset.scopePaths.instance]: { $in: scope.instanceIds } }
      : {}),
    [dataset.timeField]: { $gte: d.range.from, $lt: d.range.to },
    ...(dataset.baseMatch ?? {}),
    ...(d.extra ?? {})
  };

  let predicate = d.predicate ?? always;
  if (!(predicate.t == 'const' && predicate.value)) match.$and = [toQuery(predicate)];

  return [{ $match: match }];
};

let isSubset = (values: unknown, allowed: string[]) =>
  Array.isArray(values) &&
  values.every(value => typeof value == 'string' && allowed.includes(value));

export let assertScoped = (pipeline: Stage[], dataset: DatasetDef, scope: EffectiveScope) => {
  let fail = (reason: string): never => {
    throw new ScopeViolationError(`Unscoped ${dataset.name} pipeline: ${reason}`);
  };

  let first = pipeline[0];
  if (!first || Object.keys(first).length != 1 || !first.$match)
    fail('the first stage is not $match');

  let match = first!.$match as Record<string, unknown>;
  if (match.organizationId !== scope.organizationId) fail('organizationId does not match');

  let checkList = (path: string | undefined, allowed: string[] | undefined, name: string) => {
    if (!allowed) return;
    if (!path) fail(`${name} scope without a path`);

    let condition = match[path!] as { $in?: unknown } | undefined;
    if (
      !condition ||
      Object.keys(condition).length != 1 ||
      !isSubset(condition.$in, allowed)
    ) {
      fail(`${name} ids are not a subset of the scope`);
    }
  };

  checkList(dataset.scopePaths.project, scope.projectIds, 'project');
  checkList(dataset.scopePaths.instance, scope.instanceIds, 'instance');

  for (let stage of pipeline) {
    let keys = Object.keys(stage);
    if (keys.length != 1 || !allowedStages.has(keys[0]!))
      fail(`stage ${keys.join(',')} is not allowed`);
  }

  return pipeline;
};
