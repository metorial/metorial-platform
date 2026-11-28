export type Filter = Record<string, unknown>;

let valueAt = (document: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (current, part) =>
        current && typeof current == 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      document
    );

let isOperator = (condition: unknown): condition is Filter =>
  !!condition &&
  typeof condition == 'object' &&
  !Array.isArray(condition) &&
  !(condition instanceof Date) &&
  Object.keys(condition).every(key => key.startsWith('$'));

let satisfies = (value: unknown, operator: string, operand: unknown) => {
  if (operator == '$exists') return (value !== undefined) == operand;
  if (operator == '$in') return Array.isArray(operand) && operand.includes(value);

  return false;
};

export let matchesFilter = (document: unknown, filter: Filter): boolean =>
  Object.entries(filter).every(([key, condition]) => {
    if (key == '$or') {
      return (condition as Filter[]).some(branch => matchesFilter(document, branch));
    }

    let value = valueAt(document, key);

    if (isOperator(condition)) {
      return Object.entries(condition).every(([operator, operand]) =>
        satisfies(value, operator, operand)
      );
    }

    return value === condition;
  });
