import { describe, expect, it } from 'vitest';
import { getSentryHttpErrorDetails, shouldIgnoreSentryHttpError } from './index';

describe('@lowerdeck/sentry filters', () => {
  it('extracts client error details from wrapped lowerdeck errors', () => {
    let hint = {
      originalException: new Error(
        '[@lowerdeck/error]: You are not authorized to access this resource. ({"status":401,"code":"unauthorized","message":"You are not authorized to access this resource."})'
      )
    };

    expect(getSentryHttpErrorDetails(hint)).toEqual({
      status: 401,
      code: 'unauthorized'
    });
    expect(shouldIgnoreSentryHttpError(hint)).toBe(true);
  });

  it('ignores nested client response errors', () => {
    expect(
      shouldIgnoreSentryHttpError({
        object: 'ServiceError',
        response: {
          status: 404
        }
      })
    ).toBe(true);
  });

  it('keeps upstream http errors reportable when they are not lowerdeck errors', () => {
    expect(
      shouldIgnoreSentryHttpError({
        response: {
          status: 404
        }
      })
    ).toBe(false);
  });

  it('keeps server-side failures reportable', () => {
    expect(
      shouldIgnoreSentryHttpError({
        originalException: {
          response: {
            status: 500
          },
          code: 'internal_error'
        }
      })
    ).toBe(false);
  });
});
