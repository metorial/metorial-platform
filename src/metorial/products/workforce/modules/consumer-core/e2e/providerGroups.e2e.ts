import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import type { ConsumerSurface } from '@metorial/db';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerSurfaceProviderGroupService } from '../src';
import { captureFabric, createAccessListing, createConsumerSurface } from './_fixtures';

describe('module-consumer-core surface provider groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createGroups = async (fixture: OrganizationFixture, surface: ConsumerSurface) => {
    let groups = [];
    for (let name of ['First', 'Second', 'Third']) {
      groups.push(
        await consumerSurfaceProviderGroupService.create({
          consumerSurface: surface,
          auditScope: fixture.auditScope,
          input: { name, description: `${name} group` }
        })
      );
    }
    return groups;
  };

  let orderedNames = async (surface: ConsumerSurface) =>
    (
      await db.consumerSurfaceProviderGroup.findMany({
        where: { consumerSurfaceOid: surface.oid },
        orderBy: { index: 'asc' }
      })
    ).map(group => `${group.index}:${group.name}`);

  let move = async (
    fixture: OrganizationFixture,
    surface: ConsumerSurface,
    groupId: string,
    index: number
  ) =>
    await consumerSurfaceProviderGroupService.update({
      consumerSurface: surface,
      consumerSurfaceProviderGroup: await consumerSurfaceProviderGroupService.get({
        consumerSurface: surface,
        consumerSurfaceProviderGroupId: groupId
      }),
      auditScope: fixture.auditScope,
      input: { index }
    });

  it('creates provider groups with consecutive indexes and lists them in order', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let created = captureFabric('consumer.surface_provider_group.created:after');

    let groups = await createGroups(fixture, surface);
    created.stop();

    expect(groups.map(group => group.index)).toEqual([0, 1, 2]);
    expect(created.events.map(event => event.consumerSurfaceProviderGroup.id)).toEqual(
      groups.map(group => group.id)
    );

    let listed = await firstPage(
      await consumerSurfaceProviderGroupService.list({ consumerSurface: surface })
    );
    expect(listed.map(group => group.id)).toEqual(groups.map(group => group.id));
  });

  it('reorders provider groups and keeps the indexes contiguous', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let [first, , third] = await createGroups(fixture, surface);

    await move(fixture, surface, third!.id, 0);
    expect(await orderedNames(surface)).toEqual(['0:Third', '1:First', '2:Second']);

    await move(fixture, surface, third!.id, 2);
    expect(await orderedNames(surface)).toEqual(['0:First', '1:Second', '2:Third']);

    let renamed = await consumerSurfaceProviderGroupService.update({
      consumerSurface: surface,
      consumerSurfaceProviderGroup: first!,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed' }
    });
    expect(renamed).toMatchObject({ name: 'Renamed', index: 0, description: 'First group' });
  });

  it('clamps a target index outside the existing range', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let [first, , third] = await createGroups(fixture, surface);

    await move(fixture, surface, first!.id, 99);
    expect(await orderedNames(surface)).toEqual(['0:Second', '1:Third', '2:First']);

    await move(fixture, surface, third!.id, -5);
    expect(await orderedNames(surface)).toEqual(['0:Third', '1:Second', '2:First']);
  });

  it('deletes a provider group, closes the gap and appends new groups at the end', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let [, second] = await createGroups(fixture, surface);
    let deleted = captureFabric('consumer.surface_provider_group.deleted:after');

    await consumerSurfaceProviderGroupService.delete({
      consumerSurface: surface,
      consumerSurfaceProviderGroup: second!,
      auditScope: fixture.auditScope
    });
    deleted.stop();

    expect(deleted.events.map(event => event.consumerSurfaceProviderGroup.id)).toEqual([
      second!.id
    ]);
    expect(await orderedNames(surface)).toEqual(['0:First', '1:Third']);
    await expectServiceError(
      consumerSurfaceProviderGroupService.get({
        consumerSurface: surface,
        consumerSurfaceProviderGroupId: second!.id
      }),
      'not_found'
    );

    let appended = await consumerSurfaceProviderGroupService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { name: 'Fourth' }
    });
    expect(appended.index).toBe(2);
  });

  it('links access listings of the same surface idempotently and unlinks them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let [group] = await createGroups(fixture, surface);
    let listing = await createAccessListing(surface);
    let foreignListing = await createAccessListing(await createConsumerSurface(fixture));
    let added = captureFabric('consumer.surface_provider_group.listing.added:after');
    let input = {
      consumerSurfaceProviderGroup: group!,
      consumerAccessListing: listing,
      auditScope: fixture.auditScope
    };
    let links = () =>
      db.consumerSurfaceProviderGroupListing.count({
        where: { consumerSurfaceProviderGroupOid: group!.oid }
      });

    await consumerSurfaceProviderGroupService.addListing(input);
    await consumerSurfaceProviderGroupService.addListing(input);
    added.stop();

    expect(await links()).toBe(1);
    expect(added.events.map(event => event.consumerAccessListing.id)).toEqual([
      listing.id,
      listing.id
    ]);

    let foreignInput = { ...input, consumerAccessListing: foreignListing };
    await expectServiceError(
      consumerSurfaceProviderGroupService.addListing(foreignInput),
      'not_found'
    );
    await expectServiceError(
      consumerSurfaceProviderGroupService.removeListing(foreignInput),
      'not_found'
    );
    expect(await links()).toBe(1);

    await consumerSurfaceProviderGroupService.removeListing(input);
    expect(await links()).toBe(0);
  });

  it('does not resolve or list provider groups through another surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createConsumerSurface(fixture);
    let [group] = await createGroups(fixture, surface);

    for (let consumerSurface of [
      await createConsumerSurface(fixture),
      await createConsumerSurface(other)
    ]) {
      await expectServiceError(
        consumerSurfaceProviderGroupService.get({
          consumerSurface,
          consumerSurfaceProviderGroupId: group!.id
        }),
        'not_found'
      );
      expect(
        await firstPage(await consumerSurfaceProviderGroupService.list({ consumerSurface }))
      ).toEqual([]);
    }

    await expectServiceError(
      consumerSurfaceProviderGroupService.get({
        consumerSurface: surface,
        consumerSurfaceProviderGroupId: uniqueId('missing-group')
      }),
      'not_found'
    );
  });
});
