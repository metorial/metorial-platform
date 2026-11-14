import { describe, expect, test } from 'vitest';
import { defineFactory } from './factories';

type User = {
  name: string;
  role: string;
  id?: string;
};

describe('defineFactory', () => {
  test('build merges overrides', () => {
    const factory = defineFactory<User>(() => ({ name: 'Ada', role: 'engineer' }));

    expect(factory.build({ role: 'lead' })).toEqual({
      name: 'Ada',
      role: 'lead'
    });
  });

  test('create uses persist when provided', async () => {
    const factory = defineFactory<User>(
      () => ({ name: 'Ada', role: 'engineer' }),
      {
        persist: async value => ({ ...value, id: 'user_1' })
      }
    );

    await expect(factory.create({ role: 'admin' })).resolves.toEqual({
      name: 'Ada',
      role: 'admin',
      id: 'user_1'
    });
  });

  test('supports custom merge logic', () => {
    const factory = defineFactory<User>(
      { name: 'Ada', role: 'engineer' },
      {
        merge: (base, overrides) => ({
          ...base,
          ...overrides,
          role: overrides.role ? `role:${overrides.role}` : base.role
        })
      }
    );

    expect(factory.build({ role: 'admin' })).toEqual({
      name: 'Ada',
      role: 'role:admin'
    });
  });
});
