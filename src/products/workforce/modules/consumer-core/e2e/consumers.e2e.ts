import {
  expectServiceError,
  firstPage,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerInviteService, consumerService } from '../src';
import { captureFabric, createConsumerProfile, createConsumerSurface } from './_fixtures';

describe('module-consumer-core consumers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createManualConsumer = async (
    fixture: OrganizationFixture,
    email = uniqueEmail('cons')
  ) =>
    await consumerService.createConsumer({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      flags: { isManuallyCreated: true },
      input: { name: 'E2E Consumer', email }
    });

  it('creates an organization consumer with an instance identity and fires the identity event', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('identity');
    let created = captureFabric('consumer.identity.created:after');

    let consumer = await createManualConsumer(fixture, `  ${email.toUpperCase()} `);
    created.stop();

    expect(consumer.email).toBe(email);
    expect(consumer.instanceOid).toBe(fixture.instance.oid);

    let root = await db.consumer.findUniqueOrThrow({ where: { oid: consumer.consumerOid } });
    expect(root).toMatchObject({
      email,
      name: 'E2E Consumer',
      organizationOid: fixture.organization.oid,
      isManuallyCreated: true,
      isPortalConsumer: false,
      isOrganizationMember: false,
      isServiceAccount: false
    });

    expect(created.events.map(event => event.instanceConsumer.id)).toEqual([consumer.id]);

    let byRootId = await consumerService.getConsumerById({
      instance: fixture.instance,
      consumerId: root.id
    });
    expect(byRootId.id).toBe(consumer.id);

    let listed = await firstPage(
      await consumerService.listConsumers({
        instance: fixture.instance,
        emails: [email.toUpperCase()]
      })
    );
    expect(listed.map(item => item.id)).toEqual([consumer.id]);

    let byId = await firstPage(
      await consumerService.listConsumers({ instance: fixture.instance, id: root.id })
    );
    expect(byId.map(item => item.id)).toEqual([consumer.id]);
  });

  it('upserts an existing consumer case-insensitively instead of creating a second root', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('upsert');
    let consumer = await createManualConsumer(fixture, email);
    let updated = captureFabric('consumer.identity.updated:after');

    let same = await consumerService.upsertConsumer({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: 'E2E Consumer', email: email.toUpperCase() }
    });
    expect(same.id).toBe(consumer.id);
    expect(updated.events).toHaveLength(0);

    let renamed = await consumerService.upsertConsumer({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: 'E2E Consumer Renamed', email }
    });
    updated.stop();

    expect(renamed.id).toBe(consumer.id);
    expect(renamed.name).toBe('E2E Consumer Renamed');
    expect(updated.events.map(event => event.previousInstanceConsumer.name)).toEqual([
      'E2E Consumer'
    ]);
    expect(
      await db.consumer.count({
        where: {
          organizationOid: fixture.organization.oid,
          email: { equals: email, mode: 'insensitive' }
        }
      })
    ).toBe(1);
  });

  it('propagates name and email updates to the consumer root and its profiles', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createConsumerSurface(fixture);
    let profile = await createConsumerProfile(fixture, surface);
    let newEmail = uniqueEmail('moved');

    let consumer = await consumerService.getConsumerById({
      instance: fixture.instance,
      consumerId: profile.instanceConsumer!.id
    });
    let updated = await consumerService.updateConsumer({
      consumer,
      auditScope: fixture.auditScope,
      input: { name: 'Moved Consumer', email: newEmail.toUpperCase() }
    });

    expect(updated).toMatchObject({ name: 'Moved Consumer', email: newEmail });
    expect(
      await db.consumer.findUniqueOrThrow({ where: { oid: consumer.consumerOid } })
    ).toMatchObject({ name: 'Moved Consumer', email: newEmail });
    expect(
      await db.consumerProfile.findUniqueOrThrow({ where: { oid: profile.oid } })
    ).toMatchObject({ name: 'Moved Consumer', email: newEmail });
  });

  it('refuses to move a consumer onto an email another consumer of the organization uses', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let taken = await createManualConsumer(fixture);
    let consumer = await createManualConsumer(fixture);

    await expectServiceError(
      consumerService.updateConsumer({
        consumer,
        auditScope: fixture.auditScope,
        input: { email: taken.email.toUpperCase() }
      }),
      'conflict'
    );
    expect(
      (await db.consumer.findUniqueOrThrow({ where: { oid: consumer.consumerOid } })).email
    ).toBe(consumer.email);

    let recased = await consumerService.updateConsumer({
      consumer,
      auditScope: fixture.auditScope,
      input: { email: consumer.email.toUpperCase() }
    });
    expect(recased.email).toBe(consumer.email);
  });

  it('keeps a consumer whose only profile is an invite pending until it has an active profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let email = uniqueEmail('pending');
    let invite = await consumerInviteService.inviteConsumer({
      consumerSurface: await createConsumerSurface(fixture),
      performedBy: fixture.actor,
      auditScope: fixture.auditScope,
      input: { name: 'Pending Consumer', email }
    });
    let root = await db.consumer.findUniqueOrThrow({ where: { oid: invite.consumerOid } });

    expect(
      await consumerService.syncPendingStatus({ consumer: root, instance: fixture.instance })
    ).toEqual({ isConsumerPending: true, isInstancePending: true });
    expect(
      await firstPage(
        await consumerService.listConsumers({ instance: fixture.instance, emails: [email] })
      )
    ).toEqual([]);

    await createConsumerProfile(fixture, await createConsumerSurface(fixture), { email });

    expect(
      await consumerService.syncPendingStatus({ consumer: root, instance: fixture.instance })
    ).toEqual({ isConsumerPending: false, isInstancePending: false });
    let listed = await firstPage(
      await consumerService.listConsumers({ instance: fixture.instance, emails: [email] })
    );
    expect(listed.map(item => item.consumerOid)).toEqual([root.oid]);
  });

  it('never treats a manually created consumer as pending', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createManualConsumer(fixture);

    expect(
      await consumerService.syncPendingStatus({
        consumer: consumer.consumer,
        instance: fixture.instance
      })
    ).toEqual({ isConsumerPending: false, isInstancePending: false });
  });

  it('isolates consumers per organization and instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let email = uniqueEmail('isolated');
    let consumer = await createManualConsumer(fixture, email);

    for (let consumerId of [consumer.id, consumer.consumer.id]) {
      await expectServiceError(
        consumerService.getConsumerById({ instance: other.instance, consumerId }),
        'not_found'
      );
    }
    await expectServiceError(
      consumerService.getConsumerById({
        instance: fixture.instance,
        consumerId: uniqueId('missing-consumer')
      }),
      'not_found'
    );

    expect(
      await consumerService.findConsumersById({
        instance: other.instance,
        consumerIds: [consumer.id, consumer.consumer.id]
      })
    ).toEqual([]);
    expect(
      await firstPage(
        await consumerService.listConsumers({ instance: other.instance, emails: [email] })
      )
    ).toEqual([]);

    let otherConsumer = await createManualConsumer(other, email);
    expect(otherConsumer.consumer.id).not.toBe(consumer.consumer.id);
    expect(otherConsumer.consumer.organizationOid).toBe(other.organization.oid);
    expect(
      (await db.consumer.findUniqueOrThrow({ where: { oid: consumer.consumerOid } }))
        .organizationOid
    ).toBe(fixture.organization.oid);
  });
});
