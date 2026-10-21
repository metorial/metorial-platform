import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { magicMcpGroupService, magicMcpTokenService } from '../src';

let createGroup = async (fixture: OrganizationFixture, name = uniqueId('Magic Group')) =>
  await magicMcpGroupService.createMagicMcpGroup({
    organization: fixture.organization,
    performedBy: fixture.actor,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name, description: 'Created by the e2e suite', metadata: { source: 'e2e' } }
  });

describe('module-magic', () => {
  let org = useOrganization();

  it('creates, gets, lists, updates and deletes a magic MCP group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Magic Group');

    let group = await createGroup(fixture, name);
    expect(group.name).toBe(name);
    expect(group.status).toBe('active');
    expect(group.slug).toMatch(/^magic-group-/);
    expect(group.metadata).toEqual({ source: 'e2e' });
    expect(group.servers).toEqual([]);

    let fetched = await magicMcpGroupService.getMagicMcpGroupById({
      instance: fixture.instance,
      magicMcpGroupId: group.id
    });
    expect(fetched.id).toBe(group.id);

    let listed = await firstPage(
      await magicMcpGroupService.listMagicMcpGroups({ instance: fixture.instance })
    );
    expect(listed.map(item => item.id)).toContain(group.id);

    let updated = await magicMcpGroupService.updateMagicMcpGroup({
      group: fetched,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed Magic Group', description: null }
    });
    expect(updated.name).toBe('Renamed Magic Group');
    expect(updated.description).toBeNull();
    expect(updated.metadata).toEqual({ source: 'e2e' });

    let deleted = await magicMcpGroupService.deleteMagicMcpGroup({
      group: updated,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');

    let active = await firstPage(
      await magicMcpGroupService.listMagicMcpGroups({ instance: fixture.instance })
    );
    expect(active.map(item => item.id)).not.toContain(group.id);

    let error = await rejectionOf(
      magicMcpGroupService.updateMagicMcpGroup({
        group: deleted,
        auditScope: fixture.auditScope,
        input: { name: 'Too Late' }
      })
    );
    expect(error.data.code).toBe('gone');
  });

  it('creates a group-locked token and resolves it by secret', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let group = await createGroup(fixture);

    let token = await magicMcpTokenService.createMagicMcpToken({
      instance: fixture.instance,
      groups: [group],
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Magic Token'), metadata: { source: 'e2e' } }
    });
    expect(token.status).toBe('active');
    expect(token.isGroupLocked).toBe(true);
    expect(token.secret).toBeTruthy();
    expect(token.groups.map(link => link.magicMcpGroup.id)).toEqual([group.id]);

    let fetched = await magicMcpTokenService.getMagicMcpTokenById({
      instance: fixture.instance,
      magicMcpTokenId: token.id
    });
    expect(fetched.id).toBe(token.id);

    let bySecret = await magicMcpTokenService.getMagicMcpTokenBySecret({
      instance: fixture.instance,
      secret: token.secret
    });
    expect(bySecret.id).toBe(token.id);

    let byGroup = await firstPage(
      await magicMcpTokenService.listMagicMcpTokens({
        instance: fixture.instance,
        groupIds: [group.id]
      })
    );
    expect(byGroup.map(item => item.id)).toEqual([token.id]);

    await magicMcpGroupService.deleteMagicMcpGroup({ group, auditScope: fixture.auditScope });
    let unlocked = await db.magicMcpToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(unlocked.isGroupLocked).toBe(false);
  });

  it('updates, rotates and deletes a token', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let token = await magicMcpTokenService.createMagicMcpToken({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Magic Token') }
    });
    expect(token.isGroupLocked).toBe(false);

    let updated = await magicMcpTokenService.updateMagicMcpToken({
      token,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed Magic Token', description: 'Updated by the e2e suite' }
    });
    expect(updated.name).toBe('Renamed Magic Token');
    expect(updated.description).toBe('Updated by the e2e suite');

    let rotated = await magicMcpTokenService.rotateMagicMcpTokenSecret({
      token: updated,
      auditScope: fixture.auditScope
    });
    expect(rotated.secret).not.toBe(token.secret);
    expect(
      await magicMcpTokenService.getMagicMcpTokenBySecretSafe({
        instance: fixture.instance,
        secret: token.secret
      })
    ).toBeNull();

    let deleted = await magicMcpTokenService.deleteMagicMcpToken({
      token: rotated,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toBeTruthy();

    await expect(
      magicMcpTokenService.getMagicMcpTokenBySecret({
        instance: fixture.instance,
        secret: rotated.secret
      })
    ).rejects.toThrow();

    let error = await rejectionOf(
      magicMcpTokenService.deleteMagicMcpToken({
        token: deleted,
        auditScope: fixture.auditScope
      })
    );
    expect(error.data.code).toBe('precondition_failed');
  });
});
