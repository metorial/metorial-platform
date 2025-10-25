import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ServerDeployment } from '@metorial/db';

// Mock the dependencies
vi.mock('@metorial/config', () => ({
  getFullConfig: vi.fn()
}));

vi.mock('../src/queues/discoverServer', () => ({
  addServerDeploymentDiscovery: vi.fn()
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

const { getFullConfig } = await import('@metorial/config');
const { addServerDeploymentDiscovery } = await import('../src/queues/discoverServer');
const { engineServerDiscoveryService } = await import('../src/services/discovery');

describe('engineServerDiscoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add server deployment discovery when sessionRunner is engine', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'deployment-oid',
      id: 'deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockResolvedValue({
      sessionRunner: 'engine'
    } as any);

    await engineServerDiscoveryService.discoverServerAsync({
      serverDeployment: mockDeployment
    });

    expect(addServerDeploymentDiscovery).toHaveBeenCalledWith({
      serverDeploymentId: 'deployment-id'
    });
  });

  it('should not add server deployment discovery when sessionRunner is not engine', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'deployment-oid',
      id: 'deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockResolvedValue({
      sessionRunner: 'local'
    } as any);

    await engineServerDiscoveryService.discoverServerAsync({
      serverDeployment: mockDeployment
    });

    expect(addServerDeploymentDiscovery).not.toHaveBeenCalled();
  });

  it('should handle null sessionRunner config', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'deployment-oid',
      id: 'deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockResolvedValue({
      sessionRunner: null
    } as any);

    await engineServerDiscoveryService.discoverServerAsync({
      serverDeployment: mockDeployment
    });

    expect(addServerDeploymentDiscovery).not.toHaveBeenCalled();
  });

  it('should handle undefined sessionRunner config', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'deployment-oid',
      id: 'deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockResolvedValue({} as any);

    await engineServerDiscoveryService.discoverServerAsync({
      serverDeployment: mockDeployment
    });

    expect(addServerDeploymentDiscovery).not.toHaveBeenCalled();
  });

  it('should use correct server deployment ID', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'different-oid',
      id: 'specific-deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockResolvedValue({
      sessionRunner: 'engine'
    } as any);

    await engineServerDiscoveryService.discoverServerAsync({
      serverDeployment: mockDeployment
    });

    expect(addServerDeploymentDiscovery).toHaveBeenCalledWith({
      serverDeploymentId: 'specific-deployment-id'
    });
  });

  it('should handle getFullConfig errors', async () => {
    const mockDeployment: ServerDeployment = {
      oid: 'deployment-oid',
      id: 'deployment-id'
    } as ServerDeployment;

    vi.mocked(getFullConfig).mockRejectedValue(new Error('Config error'));

    await expect(
      engineServerDiscoveryService.discoverServerAsync({
        serverDeployment: mockDeployment
      })
    ).rejects.toThrow('Config error');

    expect(addServerDeploymentDiscovery).not.toHaveBeenCalled();
  });
});
