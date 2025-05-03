import { normalizeCase } from './normalize';
import { titleWord, word } from './special';

export class Cases {
  #normalized: string[];

  constructor(input: string) {
    this.#normalized = normalizeCase(input);
  }

  static toCamelCase(input: string) {
    return new Cases(input).toCamelCase();
  }

  static toPascalCase(input: string) {
    return new Cases(input).toPascalCase();
  }

  static toKebabCase(input: string) {
    return new Cases(input).toKebabCase();
  }

  static toSnakeCase(input: string) {
    return new Cases(input).toSnakeCase();
  }

  static toTitleCase(input: string) {
    return new Cases(input).toTitleCase();
  }

  static toSentenceCase(input: string) {
    return new Cases(input).toSentenceCase();
  }

  toCamelCase() {
    return this.#normalized
      .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join('');
  }

  toPascalCase() {
    return this.#normalized.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }

  toKebabCase() {
    return this.#normalized.join('-');
  }

  toSnakeCase() {
    return this.#normalized.join('_');
  }

  toTitleCase() {
    return this.#normalized.map(w => titleWord(w)).join(' ');
  }

  toSentenceCase() {
    return this.#normalized.map((w, i) => (i === 0 ? titleWord(w) : word(w))).join(' ');
  }
}
