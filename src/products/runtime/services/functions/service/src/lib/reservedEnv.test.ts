import { describe, expect, it } from 'vitest';
import { assertNoReservedEnv, dropReservedEnv, isReservedEnvName } from './reservedEnv';

describe('reserved env names', () => {
  it.each([
    'NODE_OPTIONS',
    'NODE_PATH',
    'NODE_EXTRA_CA_CERTS',
    'LD_PRELOAD',
    'METORIAL_FUNCTION_ID',
    'CLUSTER_MANAGER_POD_ADDR',
    'EGRESS_GATEWAY_SERVER_NAME'
  ])('reserves %s', name => {
    expect(isReservedEnvName(name)).toBe(true);
  });

  it.each(['API_KEY', 'NODE_ENV', 'METORIAL', 'my_LD_VALUE'])('allows %s', name => {
    expect(isReservedEnvName(name)).toBe(false);
  });

  it('reports every reserved name in one validation error', () => {
    try {
      assertNoReservedEnv({ API_KEY: '1', NODE_OPTIONS: '2', LD_PRELOAD: '3' });
      expect.unreachable();
    } catch (err: any) {
      expect(err.data.code).toBe('invalid_data');
      expect(err.data.errors.map((e: any) => e.path)).toEqual([
        ['env', 'NODE_OPTIONS'],
        ['env', 'LD_PRELOAD']
      ]);
    }
  });

  it('drops reserved names and lists them', () => {
    expect(dropReservedEnv({ API_KEY: '1', METORIAL_X: '2' })).toEqual({
      env: { API_KEY: '1' },
      dropped: ['METORIAL_X']
    });
  });
});
