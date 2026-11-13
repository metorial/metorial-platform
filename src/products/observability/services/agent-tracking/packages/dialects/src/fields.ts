let numberPattern = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export type FieldSource = Record<string, unknown>;

export let withCoerced = <T extends { draft: { coerced?: string[] } }>(
  mapped: T[],
  fields: { coerced: string[] }
): T[] => {
  let coerced = fields.coerced;
  if (coerced.length == 0) return mapped;

  return mapped.map(entry => ({
    ...entry,
    draft: {
      ...entry.draft,
      coerced: [...new Set([...(entry.draft.coerced ?? []), ...coerced])]
    }
  }));
};

export class FieldReader {
  private coercedKeys = new Set<string>();

  constructor(
    private source: FieldSource,
    private label: string
  ) {}

  get coerced() {
    return [...this.coercedKeys];
  }

  has(...keys: string[]) {
    return this.pick(keys) !== undefined;
  }

  raw(...keys: string[]): unknown {
    return this.pick(keys)?.value;
  }

  str(...keys: string[]): string | undefined {
    let value = this.pick(keys)?.value;

    return typeof value == 'string' && value.length > 0 ? value : undefined;
  }

  text(...keys: string[]): string | undefined {
    let found = this.pick(keys);
    if (!found) return undefined;

    if (typeof found.value == 'string')
      return found.value.length > 0 ? found.value : undefined;

    if (typeof found.value == 'number' && Number.isFinite(found.value)) {
      this.coercedKeys.add(this.label + found.key);
      return String(found.value);
    }

    return undefined;
  }

  num(...keys: string[]): number | undefined {
    let found = this.pick(keys);
    if (!found) return undefined;

    let { value, key } = found;

    if (typeof value == 'number') return Number.isFinite(value) ? value : undefined;

    if (typeof value == 'string' && numberPattern.test(value.trim())) {
      let parsed = Number(value);

      if (Number.isFinite(parsed)) {
        this.coercedKeys.add(this.label + key);
        return parsed;
      }
    }

    return undefined;
  }

  int(...keys: string[]): number | undefined {
    let value = this.num(...keys);
    if (value === undefined) return undefined;

    let truncated = Math.trunc(value);

    return Number.isSafeInteger(truncated) ? truncated : undefined;
  }

  count(...keys: string[]): number | undefined {
    let value = this.int(...keys);

    return value !== undefined && value >= 0 ? value : undefined;
  }

  bool(...keys: string[]): boolean | undefined {
    let found = this.pick(keys);
    if (!found) return undefined;

    if (typeof found.value == 'boolean') return found.value;

    if (found.value == 'true' || found.value == 'false') {
      this.coercedKeys.add(this.label + found.key);
      return found.value == 'true';
    }

    return undefined;
  }

  obj(...keys: string[]): FieldSource | undefined {
    let value = this.pick(keys)?.value;

    return value !== null && typeof value == 'object' && !Array.isArray(value)
      ? (value as FieldSource)
      : undefined;
  }

  private pick(keys: string[]): { key: string; value: unknown } | undefined {
    for (let key of keys) {
      let value = this.source[key];
      if (value !== undefined && value !== null) return { key, value };
    }

    return undefined;
  }
}

export let readFields = (source: FieldSource, label: string) => new FieldReader(source, label);
