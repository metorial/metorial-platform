import {
  expectError,
  expectOk,
  expectPresented,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('magic MCP endpoint skill sharing', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createSkill = async (client = org.clients.instance) =>
    expectOk(await client.post('/skills', { name: uniqueId('Shared Skill') }));

  let createGroup = async (client = org.clients.instance) =>
    expectOk(await client.post('/skill-groups', { name: uniqueId('Shared Group') }));

  let createEndpoint = async (body: Record<string, unknown>) =>
    await org.clients.instance.post('/magic-mcp-endpoints', {
      name: uniqueId('Skills Endpoint'),
      ...body
    });

  it('creates, presents and updates skill resources and the skill selection', async () => {
    let api = org.clients.instance;
    let skill = await createSkill();
    let group = await createGroup();

    let created = expectOk(
      await createEndpoint({
        enable_skill_resources: true,
        skill_selection: {
          type: 'selected',
          skill_ids: [skill.id],
          skill_group_ids: [group.id]
        }
      })
    );

    expectPresented(created, 'magic_mcp.endpoint');
    expect(created.enable_skill_resources).toBe(true);
    expect(created.skill_selection).toEqual({
      type: 'selected',
      skill_ids: [skill.id],
      skill_group_ids: [group.id]
    });

    let fetched = expectOk(await api.get(`/magic-mcp-endpoints/${created.id}`));
    expect(fetched.skill_selection).toEqual(created.skill_selection);

    let updated = expectOk(
      await api.patch(`/magic-mcp-endpoints/${created.id}`, {
        skill_selection: { type: 'all' }
      })
    );
    expect(updated.skill_selection).toEqual({ type: 'all' });
    expect(updated.enable_skill_resources).toBe(true);

    let untouched = expectOk(
      await api.patch(`/magic-mcp-endpoints/${created.id}`, { name: uniqueId('Renamed') })
    );
    expect(untouched.skill_selection).toEqual({ type: 'all' });
  });

  it('accepts a selection with only skills or only skill groups', async () => {
    let skill = await createSkill();
    let group = await createGroup();

    let skillsOnly = expectOk(
      await createEndpoint({ skill_selection: { type: 'selected', skill_ids: [skill.id] } })
    );
    expect(skillsOnly.skill_selection).toEqual({
      type: 'selected',
      skill_ids: [skill.id],
      skill_group_ids: []
    });

    let groupsOnly = expectOk(
      await createEndpoint({
        skill_selection: { type: 'selected', skill_group_ids: [group.id] }
      })
    );
    expect(groupsOnly.skill_selection).toEqual({
      type: 'selected',
      skill_ids: [],
      skill_group_ids: [group.id]
    });
  });

  it('validates the skill selection on create and update', async () => {
    let api = org.clients.instance;

    expectError(await createEndpoint({ skill_selection: { type: 'selected' } }), 400);
    expectError(
      await createEndpoint({ skill_selection: { type: 'bogus' } }),
      400,
      'invalid_data'
    );
    expectError(await createEndpoint({ enable_skill_resources: 'yes' }), 400, 'invalid_data');
    expectError(
      await createEndpoint({
        skill_selection: { type: 'selected', skill_ids: ['sk_missing'] }
      }),
      404
    );

    let endpoint = expectOk(await createEndpoint({}));

    expectError(
      await api.patch(`/magic-mcp-endpoints/${endpoint.id}`, {
        skill_selection: { type: 'selected', skill_ids: [], skill_group_ids: [] }
      }),
      400
    );
  });

  it("rejects another organization's skills and skill groups", async () => {
    let foreignSkill = await createSkill(otherOrg.clients.instance);
    let foreignGroup = await createGroup(otherOrg.clients.instance);

    expectError(
      await createEndpoint({
        skill_selection: { type: 'selected', skill_ids: [foreignSkill.id] }
      }),
      404
    );
    expectError(
      await createEndpoint({
        skill_selection: { type: 'selected', skill_group_ids: [foreignGroup.id] }
      }),
      404
    );
  });
});
