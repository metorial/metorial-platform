import { v, type ValidationError, type ValidationType } from '@lowerdeck/validation';
import type { AttributionRuleMatch } from '../types';

let maxDepth = 8;
let maxNodes = 100;
let maxChildren = 50;
let maxValueLength = 256;
let maxListValues = 100;
let maxTestedValueLength = 1024;
let maxCompiledPatterns = 1000;

export let matchOps = ['eq', 'in', 'glob', 'regex', 'exists'] as const;

export type MatchOp = (typeof matchOps)[number];

export let matchFields = [
  'user',
  'device',
  'agent',
  'team',
  'repo',
  'repo.owner',
  'branch',
  'workspace',
  'ticket',
  'client.family',
  'client.surface',
  'model',
  'mcp.server',
  'project',
  'instance'
] as const;

export type SessionFacts = Record<string, string[]>;

let tagFieldPattern = /^tag\.[a-z0-9][a-z0-9._:-]{0,63}$/i;

let fieldSet = new Set<string>(matchFields);

export let isMatchField = (field: string) =>
  fieldSet.has(field) || tagFieldPattern.test(field);

// A quantified group that itself contains a quantifier, e.g. `(a+)+` or `(.*)*`, is the classic
// catastrophic-backtracking shape; rules run for every settled session, so they are refused.
let nestedQuantifierPattern = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)[+*{]/;

export let checkRegexPattern = (pattern: string): string | null => {
  if (pattern.length > maxValueLength) {
    return `Regular expressions are limited to ${maxValueLength} characters.`;
  }
  if (nestedQuantifierPattern.test(pattern)) {
    return 'Nested quantifiers are not allowed in regular expressions.';
  }

  try {
    new RegExp(pattern, 'i');
  } catch {
    return 'The regular expression is invalid.';
  }

  return null;
};

let leafSchema = v.object({
  field: v.string({ modifiers: [v.minLength(1), v.maxLength(80)] }),
  op: v.enumOf(matchOps),
  value: v.optional(
    v.union([
      v.string({ modifiers: [v.minLength(1), v.maxLength(maxValueLength)] }),
      v.array(v.string({ modifiers: [v.minLength(1), v.maxLength(maxValueLength)] }), {
        modifiers: [v.minLength(1), v.maxLength(maxListValues)]
      })
    ])
  )
});

let fail = (message: string, path: string[]): ValidationError[] => [
  { code: 'invalid_match', message, path }
];

let checkLeaf = (
  leaf: { field: string; op: MatchOp; value?: string | string[] },
  path: string[]
): ValidationError[] => {
  if (!isMatchField(leaf.field)) {
    return fail(`Unknown match field "${leaf.field}".`, [...path, 'field']);
  }

  if (leaf.op == 'exists') {
    return leaf.value === undefined
      ? []
      : fail('The exists operator takes no value.', [...path, 'value']);
  }

  if (leaf.op == 'in') {
    return Array.isArray(leaf.value)
      ? []
      : fail('The in operator takes a list of values.', [...path, 'value']);
  }

  if (typeof leaf.value != 'string') {
    return fail(`The ${leaf.op} operator takes a single value.`, [...path, 'value']);
  }

  if (leaf.op == 'regex') {
    let problem = checkRegexPattern(leaf.value);
    if (problem) return fail(problem, [...path, 'value']);
  }

  return [];
};

let validateNode = (
  value: unknown,
  path: string[],
  depth: number,
  counter: { nodes: number }
): { errors: ValidationError[]; match?: AttributionRuleMatch } => {
  counter.nodes++;
  if (counter.nodes > maxNodes) {
    return { errors: fail(`A match may have at most ${maxNodes} conditions.`, path) };
  }
  if (depth > maxDepth) {
    return { errors: fail(`A match may be nested at most ${maxDepth} levels deep.`, path) };
  }

  if (typeof value != 'object' || value === null || Array.isArray(value)) {
    return { errors: fail('Expected a match object.', path) };
  }

  let keys = Object.keys(value);
  let record = value as Record<string, unknown>;

  for (let combinator of ['all', 'any'] as const) {
    if (!(combinator in record)) continue;
    if (keys.length != 1) {
      return { errors: fail(`"${combinator}" cannot be combined with other keys.`, path) };
    }

    let children = record[combinator];
    if (!Array.isArray(children) || !children.length || children.length > maxChildren) {
      return {
        errors: fail(`"${combinator}" takes a list of 1 to ${maxChildren} matches.`, [
          ...path,
          combinator
        ])
      };
    }

    let matches: AttributionRuleMatch[] = [];
    for (let [index, child] of children.entries()) {
      let result = validateNode(
        child,
        [...path, combinator, String(index)],
        depth + 1,
        counter
      );
      if (result.errors.length) return result;

      matches.push(result.match!);
    }

    return {
      errors: [],
      match: combinator == 'all' ? { all: matches } : { any: matches }
    };
  }

  if ('not' in record) {
    if (keys.length != 1) {
      return { errors: fail('"not" cannot be combined with other keys.', path) };
    }

    let result = validateNode(record.not, [...path, 'not'], depth + 1, counter);
    if (result.errors.length) return result;

    return { errors: [], match: { not: result.match! } };
  }

  let leaf = leafSchema.validate(value);
  if (!leaf.success) {
    return {
      errors: leaf.errors.map(error => ({ ...error, path: [...path, ...(error.path ?? [])] }))
    };
  }

  let errors = checkLeaf(leaf.value, path);
  if (errors.length) return { errors };

  return {
    errors: [],
    match: {
      field: leaf.value.field,
      op: leaf.value.op,
      ...(leaf.value.value === undefined ? {} : { value: leaf.value.value })
    }
  };
};

export let matchSchema: ValidationType<AttributionRuleMatch> = {
  type: 'object',
  name: 'AttributionRuleMatch',
  description:
    'A condition tree: { all: [...] }, { any: [...] }, { not: ... } or { field, op, value }.',
  examples: [{ field: 'repo.owner', op: 'eq', value: 'acme' }],
  validate: value => {
    let result = validateNode(value, [], 1, { nodes: 0 });
    if (result.errors.length) return { success: false, errors: result.errors };

    return { success: true, value: result.match! };
  }
};

export let validateMatch = (value: unknown) => matchSchema.validate(value);

let compiledPatterns = new Map<string, RegExp | null>();

let remember = (key: string, pattern: RegExp | null) => {
  if (compiledPatterns.size >= maxCompiledPatterns) compiledPatterns.clear();
  compiledPatterns.set(key, pattern);

  return pattern;
};

export let globToRegExp = (glob: string) => {
  let source = glob
    .split('')
    .map(char =>
      char == '*' ? '.*' : char == '?' ? '.' : char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    )
    .join('');

  return new RegExp(`^${source}$`, 'i');
};

let compiled = (op: 'glob' | 'regex', value: string) => {
  let key = `${op}\u0000${value}`;
  if (compiledPatterns.has(key)) return compiledPatterns.get(key)!;

  if (op == 'glob') return remember(key, globToRegExp(value));
  if (checkRegexPattern(value)) return remember(key, null);

  return remember(key, new RegExp(value, 'i'));
};

let matchesValue = (
  op: Exclude<MatchOp, 'exists'>,
  expected: string | string[] | undefined,
  actual: string
) => {
  let candidate = actual.slice(0, maxTestedValueLength);

  if (op == 'eq') {
    return typeof expected == 'string' && candidate.toLowerCase() == expected.toLowerCase();
  }
  if (op == 'in') {
    return (
      Array.isArray(expected) &&
      expected.some(value => value.toLowerCase() == candidate.toLowerCase())
    );
  }
  if (typeof expected != 'string') return false;

  return compiled(op, expected)?.test(candidate) ?? false;
};

export let evaluateMatch = (match: AttributionRuleMatch, facts: SessionFacts): boolean => {
  if ('all' in match) return match.all.every(child => evaluateMatch(child, facts));
  if ('any' in match) return match.any.some(child => evaluateMatch(child, facts));
  if ('not' in match) return !evaluateMatch(match.not, facts);

  let values = facts[match.field] ?? [];
  if (match.op == 'exists') return values.length > 0;

  return values.some(value =>
    matchesValue(match.op as Exclude<MatchOp, 'exists'>, match.value, value)
  );
};
