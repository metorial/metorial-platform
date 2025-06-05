import { describe, expect, it } from 'vitest';
import { MetorialSDKError } from './error';

describe('MetorialSDKError', () => {
  const response = {
    status: 400,
    code: 'INVALID_REQUEST',
    message: 'The request is invalid.',
    hint: 'Check the request parameters.',
    description: 'The request parameters are incorrect.',
    entity: 'User',
    reason: 'Invalid parameters',
    errors: [
      {
        code: 'REQUIRED_FIELD',
        message: 'The field is required.',
        path: ['username']
      }
    ]
  };

  it('should create an instance of MetorialSDKError', () => {
    const error = new MetorialSDKError(response);
    expect(error).toBeInstanceOf(MetorialSDKError);
    expect(error.message).toBe('[METORIAL ERROR]: INVALID_REQUEST - The request is invalid.');
  });

  it('should return the correct code', () => {
    const error = new MetorialSDKError(response);
    expect(error.code).toBe('INVALID_REQUEST');
  });

  it('should return the correct message', () => {
    const error = new MetorialSDKError(response);
    expect(error.message).toBe('[METORIAL ERROR]: INVALID_REQUEST - The request is invalid.');
  });

  it('should return the correct hint', () => {
    const error = new MetorialSDKError(response);
    expect(error.hint).toBe('Check the request parameters.');
  });

  it('should return the correct description', () => {
    const error = new MetorialSDKError(response);
    expect(error.description).toBe('The request parameters are incorrect.');
  });

  it('should return the correct reason', () => {
    const error = new MetorialSDKError(response);
    expect(error.reason).toBe('Invalid parameters');
  });

  it('should return the correct validation errors', () => {
    const error = new MetorialSDKError(response);
    expect(error.validationErrors).toEqual([
      {
        code: 'REQUIRED_FIELD',
        message: 'The field is required.',
        path: ['username']
      }
    ]);
  });

  it('should return the correct entity', () => {
    const error = new MetorialSDKError(response);
    expect(error.entity).toBe('User');
  });
});
