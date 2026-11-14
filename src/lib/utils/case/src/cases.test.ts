import { describe, expect, it, vi } from 'vitest';
import { Cases } from './cases';
import { normalizeCase } from './normalize';
import { titleWord, word } from './special';

vi.mock('./normalize', () => ({
  normalizeCase: vi.fn((input: string) => input.toLowerCase().split(/[\s_-]+/)),
}));

vi.mock('./special', () => ({
  titleWord: vi.fn((input: string) => input.charAt(0).toUpperCase() + input.slice(1)),
  word: vi.fn((input: string) => input.toLowerCase()),
}));

describe('Cases', () => {
  describe('Static methods', () => {
    it('toCamelCase should convert input to camelCase', () => {
      const result = Cases.toCamelCase('hello world');
      expect(result).toBe('helloWorld');
    });

    it('toPascalCase should convert input to PascalCase', () => {
      const result = Cases.toPascalCase('hello world');
      expect(result).toBe('HelloWorld');
    });

    it('toKebabCase should convert input to kebab-case', () => {
      const result = Cases.toKebabCase('hello world');
      expect(result).toBe('hello-world');
    });

    it('toSnakeCase should convert input to snake_case', () => {
      const result = Cases.toSnakeCase('hello world');
      expect(result).toBe('hello_world');
    });

    it('toTitleCase should convert input to Title Case', () => {
      const result = Cases.toTitleCase('hello world');
      expect(result).toBe('Hello World');
    });

    it('toSentenceCase should convert input to Sentence case', () => {
      const result = Cases.toSentenceCase('hello world');
      expect(result).toBe('Hello world');
    });
  });

  describe('Instance methods', () => {
    it('toCamelCase should convert normalized input to camelCase', () => {
      const cases = new Cases('hello world');
      const result = cases.toCamelCase();
      expect(result).toBe('helloWorld');
    });

    it('toPascalCase should convert normalized input to PascalCase', () => {
      const cases = new Cases('hello world');
      const result = cases.toPascalCase();
      expect(result).toBe('HelloWorld');
    });

    it('toKebabCase should convert normalized input to kebab-case', () => {
      const cases = new Cases('hello world');
      const result = cases.toKebabCase();
      expect(result).toBe('hello-world');
    });

    it('toSnakeCase should convert normalized input to snake_case', () => {
      const cases = new Cases('hello world');
      const result = cases.toSnakeCase();
      expect(result).toBe('hello_world');
    });

    it('toTitleCase should convert normalized input to Title Case', () => {
      const cases = new Cases('hello world');
      const result = cases.toTitleCase();
      expect(result).toBe('Hello World');
    });

    it('toSentenceCase should convert normalized input to Sentence case', () => {
      const cases = new Cases('hello world');
      const result = cases.toSentenceCase();
      expect(result).toBe('Hello world');
    });
  });

  it('should call normalizeCase during initialization', () => {
    new Cases('hello world');
    expect(normalizeCase).toHaveBeenCalledWith('hello world');
  });

  it('should call titleWord and word in toSentenceCase', () => {
    const cases = new Cases('hello world');
    cases.toSentenceCase();
    expect(titleWord).toHaveBeenCalledWith('hello');
    expect(word).toHaveBeenCalledWith('world');
  });
});