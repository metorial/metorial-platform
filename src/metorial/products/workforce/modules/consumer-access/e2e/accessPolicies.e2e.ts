import { useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { consumerMagicMcpReadRoles } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import { consumerAccessPolicyService } from '../src';
import {
  accessTagsFor,
  canReadMagicServer,
  canWriteMagicServer,
  countGrants,
  createGroup,
  createMagicServer,
  createProfile,
  createSkill,
  createSurface
} from './_fixtures';

describe('module-consumer-access access policies', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('grants a group permission idempotently and evaluates it by access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let otherGroup = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let grant = {
      organization: fixture.organization,
      permission: 'magic_mcp_read' as const,
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    };

    let policy = await consumerAccessPolicyService.grantAccess(grant);
    expect(policy).toMatchObject({
      systemIdentifier: 'consumer_magic_mcp_read',
      organizationOid: fixture.organization.oid
    });
    expect(policy.roles).toEqual([...consumerMagicMcpReadRoles]);

    let again = await consumerAccessPolicyService.grantAccess(grant);
    expect(again.oid).toBe(policy.oid);
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(1);

    expect(await canReadMagicServer(server, [{ accessTagOid: group.accessTagOid }])).toBe(
      true
    );
    expect(await canReadMagicServer(server, [{ accessTagOid: otherGroup.accessTagOid }])).toBe(
      false
    );
    expect(await canReadMagicServer(server, [])).toBe(false);

    await consumerAccessPolicyService.revokeAccess(grant);
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(0);
    expect(await canReadMagicServer(server, [{ accessTagOid: group.accessTagOid }])).toBe(
      false
    );

    await consumerAccessPolicyService.revokeAccess(grant);
  });

  it('grants only the roles of the requested permission', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let tags = [{ accessTagOid: group.accessTagOid }];

    await consumerAccessPolicyService.grantAccess({
      organization: fixture.organization,
      permission: 'magic_mcp_connect',
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    });
    expect(await canReadMagicServer(server, tags)).toBe(false);
    expect(await canWriteMagicServer(server, tags)).toBe(false);

    await consumerAccessPolicyService.grantAccess({
      organization: fixture.organization,
      permission: 'magic_mcp_write',
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    });
    expect(await canWriteMagicServer(server, tags)).toBe(true);
    expect(await canReadMagicServer(server, tags)).toBe(false);
  });

  it('keeps scoped policies separate and revokes them by scope', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let base = {
      organization: fixture.organization,
      permission: 'magic_mcp_read' as const,
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    };
    let policyScope = { type: 'consumer_access' as const, consumerAccessId: 'e2e-scope' };

    let unscoped = await consumerAccessPolicyService.grantAccess(base);
    let scoped = await consumerAccessPolicyService.grantAccess({ ...base, policyScope });
    expect(scoped.oid).not.toBe(unscoped.oid);
    expect(scoped.systemIdentifier).toBe('consumer_access:e2e-scope:magic_mcp_read');
    expect(scoped.name).toContain('(e2e-scope)');
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(2);

    await consumerAccessPolicyService.revokeAccessByPolicyScope({
      organization: fixture.organization,
      permission: 'magic_mcp_read',
      subject: { consumerGroup: group },
      policyScope
    });
    let remaining = await db.accessTagEntity.findMany({
      where: { accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid }
    });
    expect(remaining.map(entity => entity.accessTagPolicyOid)).toEqual([unscoped.oid]);
    expect(await canReadMagicServer(server, [{ accessTagOid: group.accessTagOid }])).toBe(
      true
    );
  });

  it('grants through the personal group of a consumer profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let otherProfile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);

    await consumerAccessPolicyService.grantAccess({
      organization: fixture.organization,
      permission: 'magic_mcp_read',
      subject: { personalConsumerGroupForProfile: profile },
      resource: { magicMcpServer: server }
    });

    expect(
      await countGrants({
        accessTagOid: profile.personalConsumerGroup.accessTagOid,
        magicMcpServerOid: server.oid
      })
    ).toBe(1);
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(true);
    expect(await canReadMagicServer(server, await accessTagsFor(otherProfile))).toBe(false);
  });

  it('revokes only skill participant grants of a personal group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let skill = await createSkill(fixture);
    let base = {
      organization: fixture.organization,
      permission: 'skill_read' as const,
      subject: { personalConsumerGroupForProfile: profile },
      resource: { skill }
    };

    let participantPolicy = await consumerAccessPolicyService.grantAccess({
      ...base,
      policyScope: { type: 'skill_participant', skillParticipantId: 'e2e-participant' }
    });
    expect(participantPolicy.systemIdentifier).toBe(
      'skill_participant:e2e-participant:skill_read'
    );
    let accessPolicy = await consumerAccessPolicyService.grantAccess({
      ...base,
      policyScope: { type: 'consumer_access', consumerAccessId: 'e2e-access' }
    });

    await consumerAccessPolicyService.revokeSkillParticipantAccessForPersonalGroup({
      organization: fixture.organization,
      consumerProfile: profile,
      skill
    });

    let remaining = await db.accessTagEntity.findMany({
      where: { accessTagOid: profile.personalConsumerGroup.accessTagOid, skillOid: skill.oid }
    });
    expect(remaining.map(entity => entity.accessTagPolicyOid)).toEqual([accessPolicy.oid]);
  });

  it('rejects permissions that do not fit the resource', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let skill = await createSkill(fixture);
    let base = { organization: fixture.organization, subject: { consumerGroup: group } };

    await expect(
      consumerAccessPolicyService.grantAccess({
        ...base,
        permission: 'provider_template_read',
        resource: { magicMcpServer: server }
      })
    ).rejects.toThrow(/Provider template permissions/);
    await expect(
      consumerAccessPolicyService.grantAccess({
        ...base,
        permission: 'skill_read',
        resource: { magicMcpServer: server }
      })
    ).rejects.toThrow(/Skill permissions/);
    await expect(
      consumerAccessPolicyService.grantAccess({
        ...base,
        permission: 'magic_mcp_read',
        resource: { skill }
      })
    ).rejects.toThrow(/Non-skill permissions/);
    await expect(
      consumerAccessPolicyService.grantAccess({
        ...base,
        permission: 'skill_plugin_write',
        resource: { skill }
      })
    ).rejects.toThrow(/Skill plugin write permissions/);

    expect(await countGrants({ accessTagOid: group.accessTagOid })).toBe(0);
  });

  it('keeps policies per organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let otherSurface = await createSurface(other);
    let group = await createGroup(fixture, surface);
    let otherGroup = await createGroup(other, otherSurface);
    let server = await createMagicServer(fixture);
    let otherServer = await createMagicServer(other);

    let policy = await consumerAccessPolicyService.grantAccess({
      organization: fixture.organization,
      permission: 'magic_mcp_read',
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    });
    let otherPolicy = await consumerAccessPolicyService.grantAccess({
      organization: other.organization,
      permission: 'magic_mcp_read',
      subject: { consumerGroup: otherGroup },
      resource: { magicMcpServer: otherServer }
    });

    expect(otherPolicy.oid).not.toBe(policy.oid);
    expect(otherPolicy.organizationOid).toBe(other.organization.oid);
    expect(await canReadMagicServer(server, [{ accessTagOid: otherGroup.accessTagOid }])).toBe(
      false
    );
    expect(await canReadMagicServer(otherServer, [{ accessTagOid: group.accessTagOid }])).toBe(
      false
    );

    await consumerAccessPolicyService.revokeAccess({
      organization: other.organization,
      permission: 'magic_mcp_read',
      subject: { consumerGroup: group },
      resource: { magicMcpServer: server }
    });
    expect(await canReadMagicServer(server, [{ accessTagOid: group.accessTagOid }])).toBe(
      true
    );
  });
});
