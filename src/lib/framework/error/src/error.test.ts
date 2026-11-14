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
    expect(response).toEqual({ ...data, object: 'error', ok: false });
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
      object: 'error',
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
    expect(apiError.message.includes(errorRecord.data.message)).toBe(true);
  });

  test('should return the error response', () => {
    let errorRecord = createError({
      code: '404',
      message: 'Not Found',
      status: 404
    });
    let apiError = new ServiceError(errorRecord);
    let response = apiError.toResponse();
    expect(response).toEqual({ ...errorRecord.data, object: 'error', ok: false });
  });

  test('should not mutate response payload in fromResponse', () => {
    let payload = {
      code: 'bad_request',
      message: 'Bad Request',
      status: 400,
      ok: false,
      object: 'error'
    };

    ServiceError.fromResponse(payload);

    expect(payload).toEqual({
      code: 'bad_request',
      message: 'Bad Request',
      status: 400,
      ok: false,
      object: 'error'
    });
  });
});
