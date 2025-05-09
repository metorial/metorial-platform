export class Cases {
  private normalized: string[] = [];

  constructor(stringInAnyCase: string) {
    this.normalized = normalizeCase(stringInAnyCase);
  }

  toCamelCase(): string {
    return this.normalized
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }

  toPascalCase(): string {
    return this.normalized.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }

  toSnakeCase(): string {
    return this.normalized.join('_');
  }

  toKebabCase(): string {
    return this.normalized.join('-');
  }

  static toCamelCase(stringInAnyCase: string): string {
    return new Cases(stringInAnyCase).toCamelCase();
  }

  static toPascalCase(stringInAnyCase: string): string {
    return new Cases(stringInAnyCase).toPascalCase();
  }

  static toSnakeCase(stringInAnyCase: string): string {
    return new Cases(stringInAnyCase).toSnakeCase();
  }

  static toKebabCase(stringInAnyCase: string): string {
    return new Cases(stringInAnyCase).toKebabCase();
  }
}

let normalizeCase = (input: string): string[] =>
  input
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .split(/\s+/)
    .map(word => word.toLowerCase());
