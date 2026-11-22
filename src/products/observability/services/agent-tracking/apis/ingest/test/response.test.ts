import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { caughtErrorResponse } from '../src/response';

describe('caughtErrorResponse', () => {
  it('asks the client to retry when the store cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let response = caughtErrorResponse(
      new mongoose.Error.MongooseServerSelectionError('connect ECONNREFUSED 127.0.0.1:9')
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(await response.json()).toMatchObject({ code: 'sink_busy' });
  });

  it('answers 500 for anything else that is not a service error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let response = caughtErrorResponse(new TypeError('x is undefined'));

    expect(response.status).toBe(500);
    expect(response.headers.get('retry-after')).toBeNull();
  });
});
