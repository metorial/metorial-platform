import { UnifiedApiKey } from '@metorial/api-keys';
import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { machineAccessAuthService } from '../src/services/machineAccessAuth';

vi.mock('@metorial/db', () => ({
  db: {
    apiKeySecret: {
      findUnique: vi.fn()
    },
    apiKey: {
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    from: vi.fn()
  }
}));

const context = {} as any;

describe('MachineAccessAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for unsupported organization_app_access_token', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'organization_app_access_token' });
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({ token: 'tok', context })
    ).rejects.toThrow(ServiceError);
  });

  it('throws for invalid API key', async () => {
    (UnifiedApiKey.from as any).mockReturnValue(null);
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({ token: 'bad', context })
    ).rejects.toThrow(ServiceError);
  });

  it('throws if secret not found', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    (db.apiKeySecret.findUnique as any).mockResolvedValue(null);
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: 'notfound',
        context
      })
    ).rejects.toThrow(ServiceError);
  });

  it('throws if apiKey or machineAccess is not active', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    (db.apiKeySecret.findUnique as any).mockResolvedValue({
      apiKey: { status: 'inactive', machineAccess: { status: 'active' } }
    });
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: 'inactive',
        context
      })
    ).rejects.toThrow(ServiceError);

    (db.apiKeySecret.findUnique as any).mockResolvedValue({
      apiKey: { status: 'active', machineAccess: { status: 'inactive' } }
    });
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: 'inactive2',
        context
      })
    ).rejects.toThrow(ServiceError);
  });

  it('throws if secret or apiKey is expired', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    (db.apiKeySecret.findUnique as any).mockResolvedValue({
      apiKey: { status: 'active', machineAccess: { status: 'active' }, expiresAt: null },
      expiresAt: new Date(Date.now() - 1000)
    });
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: 'expired',
        context
      })
    ).rejects.toThrow(ServiceError);

    (db.apiKeySecret.findUnique as any).mockResolvedValue({
      apiKey: {
        status: 'active',
        machineAccess: { status: 'active' },
        expiresAt: new Date(Date.now() - 1000)
      },
      expiresAt: null
    });
    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: 'expired2',
        context
      })
    ).rejects.toThrow(ServiceError);
  });

  it('updates lastUsedAt if more than 30 minutes ago', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    const lastUsedAt = new Date(Date.now() - 31 * 60 * 1000);
    const secret = {
      apiKey: {
        id: 1,
        status: 'active',
        lastUsedAt,
        machineAccess: { status: 'active' },
        expiresAt: null
      },
      expiresAt: null
    };
    (db.apiKeySecret.findUnique as any).mockResolvedValue(secret);
    (db.apiKey.update as any).mockResolvedValue({});
    const result = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: 'ok',
      context
    });
    expect(result).toBe(secret);
    expect(db.apiKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lastUsedAt: expect.any(Date) }
    });
  });

  it('does not update lastUsedAt if used within 30 minutes', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    const lastUsedAt = new Date(Date.now() - 10 * 60 * 1000);
    const secret = {
      apiKey: {
        id: 2,
        status: 'active',
        lastUsedAt,
        machineAccess: { status: 'active' },
        expiresAt: null
      },
      expiresAt: null
    };
    (db.apiKeySecret.findUnique as any).mockResolvedValue(secret);
    const result = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: 'recent',
      context
    });
    expect(result).toBe(secret);
    expect(db.apiKey.update).not.toHaveBeenCalled();
  });

  it('updates lastUsedAt if never used', async () => {
    (UnifiedApiKey.from as any).mockReturnValue({ type: 'machine_access_token' });
    const secret = {
      apiKey: {
        id: 3,
        status: 'active',
        lastUsedAt: null,
        machineAccess: { status: 'active' },
        expiresAt: null
      },
      expiresAt: null
    };
    (db.apiKeySecret.findUnique as any).mockResolvedValue(secret);
    (db.apiKey.update as any).mockResolvedValue({});
    const result = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: 'never',
      context
    });
    expect(result).toBe(secret);
    expect(db.apiKey.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { lastUsedAt: expect.any(Date) }
    });
  });
});
