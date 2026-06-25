import { describe, expect, test } from 'vitest';
import { createIdGenerator, idType } from './id';

describe('id', () => {
  test('generateId', async () => {
    let fact = createIdGenerator({
      test: idType.sorted('test', 25)
    });

    expect((await fact.generateId('test')).startsWith('test_')).toBeTruthy();
    expect((await fact.generateId('test')).length).toBe(30);
  });
});
