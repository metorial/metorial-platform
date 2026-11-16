import {
  authClients,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('api-core dashboard: organization configs', () => {
  let org = useOrganization();
  let member = useMember(org);

  let configPath = () =>
    `/dashboard/organizations/${org.ids.organizationId}/configs/skills.pinned`;

  let reset = async () =>
    expectOk(await org.clients.rest.put(configPath(), { value: { instances: {} } }));

  it('serves the declared default and replaces the whole value with PUT', async () => {
    await reset();

    let config = expectOk(await org.clients.rest.get(configPath()));
    expectPresented(config, 'organization.config');
    expect(config).toMatchObject({
      identifier: 'skills.pinned',
      ownership: 'user_organization',
      value: { instances: {} }
    });

    let replaced = expectOk(
      await org.clients.rest.put(configPath(), {
        value: { instances: { ins_a: ['skill_1'] } }
      })
    );
    expect(replaced.value).toEqual({ instances: { ins_a: ['skill_1'] } });
  });

  it('applies set, add, remove and unset operations in order', async () => {
    await reset();

    let added = expectOk(
      await org.clients.rest.patch(configPath(), {
        operations: [
          { op: 'add', path: ['instances', 'ins_a'], value: 'skill_1' },
          { op: 'add', path: ['instances', 'ins_a'], value: 'skill_2' },
          { op: 'add', path: ['instances', 'ins_a'], value: 'skill_1' },
          { op: 'set', path: ['instances', 'ins_b'], value: ['skill_3'] }
        ]
      })
    );
    expectPresented(added, 'organization.config');
    expect(added.value).toEqual({
      instances: { ins_a: ['skill_1', 'skill_2'], ins_b: ['skill_3'] }
    });

    let removed = expectOk(
      await org.clients.rest.patch(configPath(), {
        operations: [
          { op: 'remove', path: ['instances', 'ins_a'], value: 'skill_1' },
          { op: 'unset', path: ['instances', 'ins_b'] }
        ]
      })
    );
    expect(removed.value).toEqual({ instances: { ins_a: ['skill_2'] } });

    let fetched = expectOk(await org.clients.rest.get(configPath()));
    expect(fetched.value).toEqual(removed.value);
  });

  it('keeps every write when patches arrive concurrently', async () => {
    await reset();

    let skillIds = Array.from({ length: 12 }, () => uniqueId('skill'));

    let responses = await Promise.all(
      skillIds.map(skillId =>
        org.clients.rest.patch(configPath(), {
          operations: [{ op: 'add', path: ['instances', 'ins_a'], value: skillId }]
        })
      )
    );
    for (let response of responses) expectOk(response);

    let fetched = expectOk(await org.clients.rest.get(configPath()));
    expect([...fetched.value.instances.ins_a].sort()).toEqual([...skillIds].sort());
  });

  it('rejects patches that are malformed, impossible or produce an invalid value', async () => {
    await reset();

    expectError(
      await org.clients.rest.patch(configPath(), { operations: [{ op: 'move', path: [] }] }),
      400,
      'invalid_data'
    );

    expectError(
      await org.clients.rest.patch(configPath(), {
        operations: [{ op: 'add', path: ['instances'], value: 'skill_1' }]
      }),
      400,
      'invalid_data'
    );

    expectError(
      await org.clients.rest.patch(configPath(), {
        operations: [{ op: 'set', path: ['instances', 'ins_a'], value: 'not-an-array' }]
      }),
      400,
      'invalid_data'
    );

    expectError(
      await org.clients.rest.patch(configPath(), {
        operations: Array.from({ length: 51 }, () => ({
          op: 'add',
          path: ['instances', 'ins_a'],
          value: 'skill_1'
        }))
      }),
      400,
      'invalid_data'
    );

    expectError(
      await org.clients.rest.patch(configPath(), {
        operations: [{ op: 'set', path: ['__proto__', 'x'], value: 1 }]
      }),
      400,
      'invalid_data'
    );

    let fetched = expectOk(await org.clients.rest.get(configPath()));
    expect(fetched.value).toEqual({ instances: {} });
  });

  it('keeps user-scoped values separate between members', async () => {
    await reset();

    expectOk(
      await org.clients.rest.patch(configPath(), {
        operations: [{ op: 'add', path: ['instances', 'ins_a'], value: 'admin_skill' }]
      })
    );

    let memberConfig = expectOk(await member.clients.rest.get(configPath()));
    expect(memberConfig.value).toEqual({ instances: {} });

    expectOk(
      await member.clients.rest.patch(configPath(), {
        operations: [{ op: 'add', path: ['instances', 'ins_a'], value: 'member_skill' }]
      })
    );

    let adminConfig = expectOk(await org.clients.rest.get(configPath()));
    expect(adminConfig.value).toEqual({ instances: { ins_a: ['admin_skill'] } });
  });

  it('only allows dashboard sessions to patch', async () => {
    await expectAuthMatrix(
      authClients(org),
      client => client.patch(configPath(), { operations: [] }),
      { none: 401, session: 200, management: 403, instance: 404 }
    );
  });
});
