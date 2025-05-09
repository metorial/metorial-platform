import { describe, expect, test } from 'vitest';
import { ServiceError, createError } from './error';

describe('createError', () => {
  test('should create an error record with the provided data', () => {
    let data = {
      code: '404',
      message: 'Not Found',
      status: 404
    };
    let errorRecord = createError(data);
    expect(errorRecord.data).toEqual(data);
  });

  test('should create an error record with a response function', () => {
    let data = {
      code: '404',
      message: 'Not Found',
      status: 404
    };
    let errorRecord = createError(data);
    let response = errorRecord.toResponse();
    expect(response).toEqual({ ...data, __typename: 'error', ok: false });
  });

  test('should create an error record with a response function that can be extended', () => {
    let data = {
      code: '404',
      message: 'Not Found',
      status: 404
    };
    let errorRecord = createError(data);
    let response = errorRecord({ hint: 'This is a hint' }).toResponse();
    expect(response).toEqual({
      ...data,
      __typename: 'error',
      ok: false,
      hint: 'This is a hint'
    });
  });
});

describe('ServiceError', () => {
  test('should create an ServiceError with the provided error', () => {
    let errorRecord = createError({
      code: '404',
      message: 'Not Found',
      status: 404
    });
    let apiError = new ServiceError(errorRecord);
    expect(apiError.data).toEqual(errorRecord.data);
  });

  test('should create an ServiceError with the provided error message', () => {
    let errorRecord = createError({
      code: '404',
      message: 'Not Found',
      status: 404
    });
    let apiError = new ServiceError(errorRecord);
    expect(apiError.message).toEqual(errorRecord.data.message);
  });

  test('should return the error response', () => {
    let errorRecord = createError({
      code: '404',
      message: 'Not Found',
      status: 404
    });
    let apiError = new ServiceError(errorRecord);
    let response = apiError.toResponse();
    expect(response).toEqual({ ...errorRecord.data, __typename: 'error', ok: false });
  });
});
