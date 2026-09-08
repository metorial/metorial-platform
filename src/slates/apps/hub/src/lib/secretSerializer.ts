let PLACEHOLDER_PREFIX = '$$MT$secret$authConfig$';

export let containsSecretPlaceholder = (value: unknown): boolean => {
  if (typeof value === 'string') return value.startsWith(PLACEHOLDER_PREFIX);
  if (Array.isArray(value)) return value.some(containsSecretPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(containsSecretPlaceholder);
  return false;
};

export class AuthConfigSecretSerializer {
  private readonly secretToPlaceholder = new Map<string, string>();
  private readonly placeholderToSecret = new Map<string, string>();

  public constructor(authConfig: Record<string, unknown>) {
    this.buildSecretMap(authConfig);
  }

  public serialize<T>(value: T): T {
    return this.transform(value, stringValue => {
      return this.secretToPlaceholder.get(stringValue) ?? stringValue;
    });
  }

  public deserialize<T>(value: T): T {
    return this.transform(value, stringValue => {
      return this.placeholderToSecret.get(stringValue) ?? stringValue;
    });
  }

  private buildSecretMap(value: unknown, path: string[] = []): void {
    if (typeof value === 'string') {
      // Never register "" -- it would replace every empty header/query value with a placeholder.
      if (value.length === 0) return;

      let placeholder = `${PLACEHOLDER_PREFIX}${path.join('.')}`;

      this.secretToPlaceholder.set(value, placeholder);
      this.placeholderToSecret.set(placeholder, value);

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        this.buildSecretMap(item, [...path, String(index)]);
      });

      return;
    }

    if (this.isPlainObject(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        this.buildSecretMap(nestedValue, [...path, key]);
      });
    }
  }

  private transform<T>(value: T, transformString: (value: string) => string): T {
    if (typeof value === 'string') {
      return transformString(value) as T;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.transform(item, transformString)) as T;
    }

    if (this.isPlainObject(value)) {
      let result: Record<string, unknown> = {};

      Object.entries(value).forEach(([key, nestedValue]) => {
        result[key] = this.transform(nestedValue, transformString);
      });

      return result as T;
    }

    return value;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
