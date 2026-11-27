import { describe, expect, it } from 'vitest';
import { v1SandboxImagePresenter } from './image';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let present = (versions: { id: string; versionNumber: number; createdAt: Date }[]) =>
  v1SandboxImagePresenter
    .present(
      {
        image: {
          id: 'image',
          metadata: { app: 'test' },
          instanceOid: 1n,
          status: 'active',
          name: 'Image',
          identifier: null,
          regions: [],
          versions,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null
        } as any
      },
      context
    )
    .run();

describe('image current version', () => {
  it('returns the number and ID of the newest active version together', async () => {
    let image = await present([
      { id: 'new', versionNumber: 3, createdAt: new Date('2026-10-14') },
      { id: 'old', versionNumber: 2, createdAt: new Date('2026-10-13') }
    ]);

    expect(image.latest_version_id).toBe('new');
    expect(image.latest_version_number).toBe(3);
  });

  it('returns null when there is no active version', async () => {
    let image = await present([]);

    expect(image.latest_version_id).toBeNull();
    expect(image.latest_version_number).toBeNull();
  });
});

it('returns image metadata', async () => {
  expect((await present([])).metadata).toEqual({ app: 'test' });
});
