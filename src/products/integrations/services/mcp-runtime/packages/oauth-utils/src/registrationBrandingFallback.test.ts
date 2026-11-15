import { describe, expect, it, vi } from 'vitest';
import { withBrandingFallback } from './registrationBrandingFallback';

describe('withBrandingFallback', () => {
  it('sends branding on the first attempt and does not retry on success', async () => {
    let attempt = vi.fn().mockResolvedValue('registered');
    let onFallback = vi.fn();

    let result = await withBrandingFallback(attempt, onFallback);

    expect(result).toBe('registered');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(true);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('retries once without branding when the first attempt fails', async () => {
    let error = new Error('invalid_client_metadata');
    let attempt = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('registered');
    let onFallback = vi.fn();

    let result = await withBrandingFallback(attempt, onFallback);

    expect(result).toBe('registered');
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(attempt).toHaveBeenNthCalledWith(1, true);
    expect(attempt).toHaveBeenNthCalledWith(2, false);
    expect(onFallback).toHaveBeenCalledWith(error);
  });

  it('throws the error from the second attempt when both attempts fail', async () => {
    let attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'));

    await expect(withBrandingFallback(attempt)).rejects.toThrow('second');
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
