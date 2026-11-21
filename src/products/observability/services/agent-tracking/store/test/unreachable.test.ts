import { getSentry, setSentry } from '@lowerdeck/sentry';
import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStoreUnreachableLog,
  storeFailureReason,
  StoreUnreachableError
} from '../src/unreachable';
import { isTransientStoreError } from '../src/writer';

let mongo = mongoose.mongo;

let selection = (serverError: Error, message = 'Server selection timed out after 5000 ms') =>
  Object.assign(new mongoose.Error.MongooseServerSelectionError(message), {
    reason: { servers: new Map([['db.internal:27017', { error: serverError }]]) }
  });

describe('storeFailureReason', () => {
  it('names the reason class of a connection that never succeeded', () => {
    expect(
      storeFailureReason(selection(new Error('connect ECONNREFUSED 10.0.0.1:27017')))
    ).toBe('connection_refused');
    expect(storeFailureReason(selection(new Error('getaddrinfo ENOTFOUND db.internal')))).toBe(
      'dns'
    );
    expect(
      storeFailureReason(selection(new Error('self-signed certificate in certificate chain')))
    ).toBe('tls');
    expect(
      storeFailureReason(
        new mongoose.Error.MongooseServerSelectionError(
          'Mongoose is connecting with SSL enabled, but the server is not accepting SSL connections.'
        )
      )
    ).toBe('tls');
    expect(
      storeFailureReason(
        new mongo.MongoServerError({ message: 'Authentication failed.', code: 18 })
      )
    ).toBe('authentication');
    expect(storeFailureReason(new mongo.MongoParseError('Invalid scheme'))).toBe(
      'configuration'
    );
    expect(storeFailureReason(selection(new Error('timed out')))).toBe('selection_timeout');
  });

  it('keeps the address out of the wrapped error and still counts it as transient', () => {
    let error = new StoreUnreachableError(
      'connection_refused',
      selection(new Error('connect ECONNREFUSED 10.0.0.1:27017'))
    );

    expect(error.message).toBe('The record store cannot be reached (connection_refused).');
    expect(error.message).not.toContain('10.0.0.1');
    expect(isTransientStoreError(error)).toBe(true);
  });
});

describe('createStoreUnreachableLog', () => {
  let sentry = getSentry();

  afterEach(() => {
    vi.restoreAllMocks();
    setSentry(sentry);
  });

  it('reports a store that never connected as an error, once a minute', () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let captureMessage = vi.fn();
    setSentry({ captureMessage } as never);

    let now = 0;
    let log = createStoreUnreachableLog({ hasConnected: () => false, now: () => now });
    let failure = new StoreUnreachableError('tls', new Error('secret://user:pass@host'));

    log(failure);
    now = 30_000;
    log(failure);
    now = 61_000;
    log(failure);

    expect(captureMessage.mock.calls.map(([, context]) => context)).toEqual([
      { level: 'error', tags: { reason: 'tls' } },
      { level: 'error', tags: { reason: 'tls' } }
    ]);
    expect(error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).not.toContain('pass@host');
  });

  it('keeps an outage after the first connection a warning', () => {
    let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let captureMessage = vi.fn();
    setSentry({ captureMessage } as never);

    let log = createStoreUnreachableLog({ hasConnected: () => true });
    log(selection(new Error('connect ECONNREFUSED 10.0.0.1:27017')));

    expect(warn).toHaveBeenCalledWith(
      '[agent-tracking] record store is not reachable (connection_refused)'
    );
    expect(error).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
