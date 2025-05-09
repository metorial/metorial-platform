import { describe, expect, test } from 'vitest';
import { validationError } from './defaultErrors';

describe('validationError', () => {
  test("should return an error object with status 400 and code 'invalid_data'", () => {
    let error = validationError({ errors: [], entity: 'params' });
    expect(error.data.status).toBe(400);
    expect(error.data.code).toBe('invalid_data');
  });
});
