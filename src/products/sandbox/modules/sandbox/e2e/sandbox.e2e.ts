import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  sandboxDiskService,
  sandboxImageService,
  sandboxImageVersionService,
  sandboxMachineService,
  sandboxMachineUsageService,
  sandboxSpecIdentifier,
  sandboxSpecService
} from '../src';

describe('module-sandbox', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates, renames and deletes an own machine image', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('image');

    let image = await sandboxImageService.create({
      instance,
      auditScope,
      input: { name, metadata: { e2e: true } }
    });
    expect(image.name).toBe(name);
    expect(image.status).toBe('pending');
    expect(image.instanceOid).toBe(instance.oid);

    let fetched = await sandboxImageService.get({ instance, imageId: image.id });
    expect(fetched.id).toBe(image.id);

    let own = await firstPage(
      await sandboxImageService.list({ instance, imageIds: [image.id], owners: ['own'] })
    );
    expect(own.map(item => item.id)).toEqual([image.id]);
    expect(
      await firstPage(
        await sandboxImageService.list({ instance, imageIds: [image.id], owners: ['global'] })
      )
    ).toEqual([]);
    expect(await firstPage(await sandboxImageVersionService.list({ image: fetched }))).toEqual(
      []
    );

    let renamed = uniqueId('renamed');
    let updated = await sandboxImageService.update({
      instance,
      auditScope,
      image: fetched,
      input: { name: renamed }
    });
    expect(updated.name).toBe(renamed);

    let deleted = await sandboxImageService.delete({ instance, auditScope, image: updated });
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toBeTruthy();

    expect(
      await firstPage(await sandboxImageService.list({ instance, imageIds: [image.id] }))
    ).toEqual([]);
    await expect(
      sandboxImageService.update({ instance, auditScope, image: deleted, input: { name } })
    ).rejects.toThrow(/could not be found/);
  });

  it('hides images from other instances and lists no machines or disks', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let image = await sandboxImageService.create({
      instance,
      auditScope,
      input: { name: uniqueId('image') }
    });

    await expect(
      sandboxImageService.get({ instance: other.instance, imageId: image.id })
    ).rejects.toThrow(/could not be found/);
    expect(
      await firstPage(
        await sandboxImageService.list({ instance: other.instance, imageIds: [image.id] })
      )
    ).toEqual([]);
    await sandboxImageService.delete({ instance, auditScope, image });

    expect(await firstPage(await sandboxMachineService.list({ instance }))).toEqual([]);
    expect(await firstPage(sandboxDiskService.list({ instance }))).toEqual([]);

    await expect(
      sandboxMachineService.get({ instance, machineId: uniqueId('missing-machine') })
    ).rejects.toThrow(/could not be found/);
    await expect(
      sandboxDiskService.get({ instance, diskId: uniqueId('missing-disk') })
    ).rejects.toThrow(/could not be found/);
  });

  it('validates spec selectors and usage windows before reaching Genesis', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(sandboxSpecIdentifier({ memoryGib: 2, cpus: 1 })).toBe('m2048-c1000');
    await expect(sandboxSpecService.select({ selector: {} })).rejects.toThrow(/exactly one/);
    await expect(
      sandboxSpecService.select({
        selector: { specIdentifier: 'm1-c1', memoryGib: 1, cpus: 1 }
      })
    ).rejects.toThrow(/exactly one/);
    await expect(sandboxSpecService.select({ selector: { memoryGib: 1 } })).rejects.toThrow(
      /must be provided together/
    );
    await expect(
      sandboxSpecService.getByIdentifier({ identifier: uniqueId('missing-spec') })
    ).rejects.toThrow(/no machine spec/);

    let now = Date.now();
    await expect(
      sandboxMachineUsageService.summary({
        instance,
        machineId: uniqueId('machine'),
        from: new Date(now - 1000),
        to: new Date(now - 2000)
      })
    ).rejects.toThrow(/must be after/);
    await expect(
      sandboxMachineUsageService.summary({
        instance,
        machineId: uniqueId('machine'),
        from: new Date(now - 60_000),
        to: new Date(now - 1000)
      })
    ).rejects.toThrow(/could not be found/);
  });
});
