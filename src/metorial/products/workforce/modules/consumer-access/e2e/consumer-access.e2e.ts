import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { consumerGroupService, consumerSurfaceService } from '@metorial/module-consumer-core';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { consumerAccessListingService, consumerAccessService } from '../src';

let setup = async (fixture: OrganizationFixture) => {
  let consumerSurface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Access Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let consumerGroup = await consumerGroupService.createConsumerGroup({
    consumerSurface,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Access Group') }
  });
  let skill = await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: createResourceAuthorization({ restricted: false }),
      name: uniqueId('access-skill'),
      description: 'Created by the e2e suite'
    }
  });

  return { consumerSurface, consumerGroup, skill };
};

describe('module-consumer-access', () => {
  let org = useOrganization();

  it('grants a consumer group access to a skill and lists it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { consumerSurface, consumerGroup, skill } = await setup(fixture);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface,
      consumerGroup,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill }
    });
    expect(access.type).toBe('skill');
    expect(access.skill?.id).toBe(skill.id);
    expect(access.consumerGroup.id).toBe(consumerGroup.id);
    expect(access.listing?.name).toBe(skill.name);

    let fetched = await consumerAccessService.getConsumerAccessById({
      consumerSurface,
      consumerAccessId: access.id
    });
    expect(fetched.id).toBe(access.id);

    let byGroup = await firstPage(
      await consumerAccessService.listConsumerAccesses({
        consumerSurface,
        consumerGroupIds: [consumerGroup.id]
      })
    );
    expect(byGroup.map(item => item.id)).toEqual([access.id]);

    let bySkill = await firstPage(
      await consumerAccessService.listConsumerAccesses({
        consumerSurface,
        skillIds: [skill.id],
        types: ['skill']
      })
    );
    expect(bySkill.map(item => item.id)).toContain(access.id);

    let again = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface,
      consumerGroup,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill }
    });
    expect(again.id).toBe(access.id);
  });

  it('updates the shared listing and deletes the access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { consumerSurface, consumerGroup, skill } = await setup(fixture);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface,
      consumerGroup,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill },
      input: { name: 'E2E Listing' }
    });

    let updated = await consumerAccessService.updateConsumerAccess({
      consumerAccess: access,
      auditScope: fixture.auditScope,
      input: { name: 'E2E Listing Renamed', description: 'Shared with the e2e group' }
    });
    expect(updated.listing?.name).toBe('E2E Listing Renamed');
    expect(updated.listing?.description).toBe('Shared with the e2e group');

    let listing = await consumerAccessListingService.getById({
      consumerSurface,
      consumerAccessListingId: updated.listing!.id
    });
    expect(listing.skill?.id).toBe(skill.id);

    let deleted = await consumerAccessService.deleteConsumerAccess({
      organization: fixture.organization,
      consumerAccess: updated,
      auditScope: fixture.auditScope
    });
    expect(deleted.id).toBe(access.id);
    expect(await db.consumerAccess.findUnique({ where: { id: access.id } })).toBeNull();

    await expect(
      consumerAccessService.getConsumerAccessById({
        consumerSurface,
        consumerAccessId: access.id
      })
    ).rejects.toThrow();
  });

  it('manages standalone access listings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { consumerSurface, skill } = await setup(fixture);

    let listing = await consumerAccessListingService.create({
      consumerSurface,
      auditScope: fixture.auditScope,
      input: {
        name: 'E2E Standalone Listing',
        access: { type: 'skill', skillId: skill.id }
      }
    });
    expect(listing.name).toBe('E2E Standalone Listing');
    expect(listing.skill?.id).toBe(skill.id);

    let listed = await firstPage(
      await consumerAccessListingService.list({ consumerSurface, skillIds: [skill.id] })
    );
    expect(listed.map(item => item.id)).toContain(listing.id);

    let updated = await consumerAccessListingService.update({
      consumerAccessListing: listing,
      auditScope: fixture.auditScope,
      input: { readme: '# Readme' }
    });
    expect(updated.readme).toBe('# Readme');

    await consumerAccessListingService.delete({
      organization: fixture.organization,
      consumerAccessListing: updated,
      auditScope: fixture.auditScope
    });
    expect(
      await db.consumerAccessListing.findUnique({ where: { id: listing.id } })
    ).toBeNull();
  });

  it('rejects access for a group from another surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await setup(fixture);
    let second = await setup(fixture);

    let error = await rejectionOf(
      consumerAccessService.createConsumerAccess({
        organization: fixture.organization,
        consumerSurface: first.consumerSurface,
        consumerGroup: second.consumerGroup,
        auditScope: fixture.auditScope,
        access: { type: 'skill', skill: first.skill }
      })
    );
    expect(error.data.code).toBe('not_found');
  });
});
