import { describe, expect, it, vitest } from 'vitest';
import { createLoader } from './index';

describe('createLoader', () => {
  it('should fetch data and update state', async () => {
    const fetchMock = vitest.fn().mockResolvedValue('data');
    const onSuccessMock = vitest.fn();
    const onErrorMock = vitest.fn();

    const loader = createLoader({
      name: 'testLoader',
      fetch: fetchMock,
      mutators: {},
      onSuccess: onSuccessMock,
      onError: onErrorMock,
      hash: () => 'testLoader'
    });

    const input = { id: 1 };
    const state = loader.getState(input);

    expect(state.input).toBe(input);
    expect(state.output).toBeNull();
    expect(state.error).toBeNull();

    await loader.fetch(input);

    expect(fetchMock).toHaveBeenCalledWith(input);
    expect(onErrorMock).not.toHaveBeenCalled();
  });
});
