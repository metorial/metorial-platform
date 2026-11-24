import type { ClientBase } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ReadOnlyPrimaryError, withPoolDefaults } from './pool';

let clientInRecovery = (recovery: boolean) =>
  ({
    query: vi.fn(async () => ({ rows: [{ recovery }] }))
  }) as unknown as ClientBase;

describe('withPoolDefaults', () => {
  it('sets explicit pool bounds and a role-specific application name', () => {
    let config = withPoolDefaults(
      { connectionString: 'postgresql://localhost/core' },
      { environment: 'production', databaseName: 'core', role: 'replica' }
    );

    expect(config).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 30_000,
      keepAlive: true,
      maxLifetimeSeconds: 600,
      application_name: 'core:replica'
    });
    expect(config.onConnect).toBeUndefined();
  });

  it('lets callers override defaults', () => {
    let config = withPoolDefaults(
      { max: 3, application_name: 'custom' },
      { environment: 'production', databaseName: 'core', role: 'replica' }
    );

    expect(config).toMatchObject({ max: 3, application_name: 'custom' });
  });

  it('rejects primary connections to a read-only server', async () => {
    let config = withPoolDefaults(
      {},
      { environment: 'production', databaseName: 'core', role: 'primary' }
    );

    await expect(config.onConnect!(clientInRecovery(true))).rejects.toThrow(
      ReadOnlyPrimaryError
    );
    await expect(config.onConnect!(clientInRecovery(false))).resolves.toBeUndefined();
  });

  it('runs the caller onConnect after the primary check', async () => {
    let onConnect = vi.fn();
    let config = withPoolDefaults({ onConnect } as any, {
      environment: 'production',
      databaseName: 'core',
      role: 'primary'
    });

    await expect(config.onConnect!(clientInRecovery(true))).rejects.toThrow();
    expect(onConnect).not.toHaveBeenCalled();

    await config.onConnect!(clientInRecovery(false));
    expect(onConnect).toHaveBeenCalledOnce();
  });
});
