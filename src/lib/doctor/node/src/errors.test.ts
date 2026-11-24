import { describe, expect, it } from 'vitest';
import { describeError, errorCodeKinds, errorKindHints, httpStatusKinds } from './errors';
import { readFixture } from './test/fixtures';

let table = readFixture<{
  codes: Record<string, string>;
  httpStatus: Record<string, string>;
  hints: Record<string, string>;
}>('error-codes.json');

let withProps = (message: string, props: Record<string, unknown>) =>
  Object.assign(new Error(message), props);

describe('error tables', () => {
  it('match the spec fixture', () => {
    expect(errorCodeKinds).toEqual(table.codes);
    expect(httpStatusKinds).toEqual(table.httpStatus);
    expect(errorKindHints).toEqual(table.hints);
  });
});

describe('describeError', () => {
  it('classifies node network errors', () => {
    expect(
      describeError(withProps('connect ECONNREFUSED 10.0.0.1:5432', { code: 'ECONNREFUSED' }))
    ).toEqual({
      kind: 'connection_refused',
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 10.0.0.1:5432',
      hint: table.hints.connection_refused
    });
    expect(
      describeError(withProps('getaddrinfo ENOTFOUND db', { code: 'ENOTFOUND' })).kind
    ).toBe('dns');
  });

  it('follows causes, as fetch wraps its errors', () => {
    let error = new TypeError('fetch failed', {
      cause: withProps('certificate has expired', { code: 'CERT_HAS_EXPIRED' })
    });

    expect(describeError(error)).toMatchObject({
      kind: 'tls',
      code: 'CERT_HAS_EXPIRED',
      message: 'fetch failed'
    });
  });

  it('classifies database errors', () => {
    expect(
      describeError(withProps('password authentication failed', { code: '28P01' })).kind
    ).toBe('authentication');
    expect(
      describeError(withProps('database "x" does not exist', { code: '3D000' })).kind
    ).toBe('not_found');
    expect(
      describeError(withProps("Can't reach database server", { errorCode: 'P1001' })).kind
    ).toBe('connection_refused');
    expect(describeError(new Error('WRONGPASS invalid username-password pair')).kind).toBe(
      'authentication'
    );
    expect(
      describeError(
        withProps('Authentication failed.', { code: 18, codeName: 'AuthenticationFailed' })
      ).kind
    ).toBe('authentication');
  });

  it('classifies cloud provider errors', () => {
    let aws = withProps('User is not authorized to perform: kms:GenerateDataKey', {
      name: 'AccessDeniedException',
      $metadata: { httpStatusCode: 400 }
    });
    expect(describeError(aws)).toMatchObject({
      kind: 'permission',
      code: 'AccessDeniedException'
    });

    let gcp = withProps('7 PERMISSION_DENIED: denied', { code: 7, details: 'denied' });
    expect(describeError(gcp)).toMatchObject({
      kind: 'permission',
      code: 'PERMISSION_DENIED'
    });

    let azure = withProps('This request is not authorized', {
      code: 'AuthorizationPermissionMismatch',
      statusCode: 403
    });
    expect(describeError(azure).kind).toBe('permission');
  });

  it('falls back to the HTTP status', () => {
    expect(describeError(withProps('Too many', { status: 429 }))).toMatchObject({
      kind: 'limit',
      code: 'HTTP 429'
    });
  });

  it('redacts the message', () => {
    expect(describeError(new Error('redis://u:p@h failed')).message).toBe(
      'redis://u:***@h failed'
    );
  });

  it('handles values that are not errors', () => {
    expect(describeError('boom')).toEqual({
      kind: 'unknown',
      code: null,
      message: 'boom',
      hint: null
    });
    expect(describeError({ weird: true }).message).toBe('{"weird":true}');
  });
});
