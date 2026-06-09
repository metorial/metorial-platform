import { describe, expect, it } from 'vitest';
import { normalizeCase } from './normalize';

describe('normalizeCase', () => {
  it('should replace underscores and hyphens with spaces', () => {
    expect(normalizeCase('hello_world-test')).toEqual(['hello', 'world', 'test']);
  });

  it('should insert spaces between lowercase-to-uppercase transitions', () => {
    expect(normalizeCase('camelCaseExample')).toEqual(['camel', 'case', 'example']);
    expect(normalizeCase('PascalCaseExample')).toEqual(['pascal', 'case', 'example']);
  });

  it('should insert spaces between number-letter transitions', () => {
    expect(normalizeCase('test123Example')).toEqual(['test', '123', 'example']);
    expect(normalizeCase('123testExample')).toEqual(['123', 'test', 'example']);
  });

  it('should normalize all words to lowercase', () => {
    expect(normalizeCase('HelloWorld')).toEqual(['hello', 'world']);
    expect(normalizeCase('HELLO-WORLD')).toEqual(['hello', 'world']);
  });

  it('should handle mixed cases and separators', () => {
    expect(normalizeCase('helloWorld_test-123Example')).toEqual(['hello', 'world', 'test', '123', 'example']);
  });

  it('should handle empty strings', () => {
    expect(normalizeCase('')).toEqual([]);
  });

  it('should handle strings with only separators', () => {
    expect(normalizeCase('___---')).toEqual([]);
  });

  it('should handle strings with spaces', () => {
    expect(normalizeCase('hello   world')).toEqual(['hello', 'world']);
  });
});