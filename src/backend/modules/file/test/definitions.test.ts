import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  ensureFilePurpose: vi.fn((factory: any) => {
    const purpose = factory();
    return Promise.resolve({ ...purpose, oid: `oid_${purpose.slug}` });
  })
}));

// Import after mocking
import { purposes, purposeSlugs } from '../src/definitions';

describe('definitions', () => {
  it('exports purposes object with user_image', async () => {
    expect(purposes).toBeDefined();
    expect(purposes.user_image).toBeDefined();

    const userImagePurpose = await purposes.user_image;
    expect(userImagePurpose).toMatchObject({
      name: 'User Image',
      slug: 'user_image',
      ownerType: 'user',
      oid: 'oid_user_image'
    });
  });

  it('exports purposes object with organization_image', async () => {
    expect(purposes.organization_image).toBeDefined();

    const orgImagePurpose = await purposes.organization_image;
    expect(orgImagePurpose).toMatchObject({
      name: 'Organization Image',
      slug: 'organization_image',
      ownerType: 'organization',
      oid: 'oid_organization_image'
    });
  });

  it('exports purposeSlugs array with all purpose keys', () => {
    expect(Array.isArray(purposeSlugs)).toBe(true);
    expect(purposeSlugs).toContain('user_image');
    expect(purposeSlugs).toContain('organization_image');
    expect(purposeSlugs.length).toBe(2);
  });

  it('all purposes have correct structure', async () => {
    for (const key of Object.keys(purposes)) {
      const purpose = await purposes[key as keyof typeof purposes];
      expect(purpose).toHaveProperty('name');
      expect(purpose).toHaveProperty('slug');
      expect(purpose).toHaveProperty('ownerType');
      expect(purpose).toHaveProperty('oid');
      expect(typeof purpose.name).toBe('string');
      expect(typeof purpose.slug).toBe('string');
      expect(['user', 'organization', 'instance']).toContain(purpose.ownerType);
    }
  });
});
