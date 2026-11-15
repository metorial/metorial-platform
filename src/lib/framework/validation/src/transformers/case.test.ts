import { describe, expect, test } from 'vitest';
import { lowerCase, upperCase } from './case';

describe('case transformers', () => {
  describe('upperCase', () => {
    test('should transform a string to uppercase', () => {
      let input = 'hello world';
      let expectedOutput = 'HELLO WORLD';
      let output = upperCase(input);
      expect(output).toEqual(expectedOutput);
    });

    test('should return an empty string if input is empty', () => {
      let input = '';
      let expectedOutput = '';
      let output = upperCase(input);
      expect(output).toEqual(expectedOutput);
    });
  });

  describe('lowerCase', () => {
    test('should transform a string to lowercase', () => {
      let input = 'HELLO WORLD';
      let expectedOutput = 'hello world';
      let output = lowerCase(input);
      expect(output).toEqual(expectedOutput);
    });

    test('should return an empty string if input is empty', () => {
      let input = '';
      let expectedOutput = '';
      let output = lowerCase(input);
      expect(output).toEqual(expectedOutput);
    });
  });
});
