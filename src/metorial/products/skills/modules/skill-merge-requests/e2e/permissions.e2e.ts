import {
  expectServiceError,
  firstPage,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import {
  consumerSkillReadRoles,
  consumerSkillWriteRoles,
  createResourceAuthorization
} from '@metorial/module-access';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  skillForkSyncService,
  skillMergeRequestEventService,
  skillMergeRequestService,
  type SkillMergeRequestRecord
} from '../src';
import {
  addDocument,
  createForkPair,
  getItemByPath,
  getMergeRequest,
  mergeAndWait,
  openMergeRequest,
  readDocument,
  scopeOf,
  type SkillRecord,
  uniquePath
} from './_fixtures';

let createConsumer = async (fixture: OrganizationFixture) => {
  let surface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Skill Review Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let profile = await consumerProfileService.createConsumerProfile({
    surface,
    email: uniqueEmail('skill-reviewer'),
    name: 'E2E Skill Reviewer',
    auditScope: fixture.auditScope
  });
  let actor = await resourceActorService.ensureConsumerProfileActor({
    project: fixture.project,
    consumerProfile: profile
  });

  let accessTagOid = profile.personalConsumerGroup!.accessTagOid;

  return {
    actor,
    accessTagOid,
    authorization: createResourceAuthorization({
      restricted: true,
      resourceActor: actor,
      accessTags: [{ accessTagOid }],
      project: fixture.project,
      instance: fixture.instance,
      consumerProfile: profile
    })
  };
};

type Consumer = Awaited<ReturnType<typeof createConsumer>>;

let setAccess = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  consumer: Consumer,
  access: 'read' | 'write' | 'none'
) => {
  await db.accessTagEntity.deleteMany({
    where: { skillOid: skill.oid, accessTagOid: consumer.accessTagOid }
  });
  if (access === 'none') return;

  let policy = await db.accessTagPolicy.create({
    data: {
      id: await ID.generateId('accessTagPolicy'),
      name: uniqueId('e2e-merge-request-policy'),
      roles:
        access === 'write'
          ? [...consumerSkillReadRoles, ...consumerSkillWriteRoles]
          : [...consumerSkillReadRoles],
      organizationOid: fixture.organization.oid
    }
  });
  await db.accessTagEntity.create({
    data: {
      accessTagOid: consumer.accessTagOid,
      accessTagPolicyOid: policy.oid,
      skillOid: skill.oid
    }
  });
};

let visibleIds = async (
  fixture: OrganizationFixture,
  authorization: Consumer['authorization'],
  mergeRequest: SkillMergeRequestRecord
) =>
  (
    await firstPage(
      await skillMergeRequestService.listSkillMergeRequests({
        ...scopeOf(fixture),
        authorization,
        ids: [mergeRequest.id]
      })
    )
  ).map(row => row.id);

let openChangedFork = async (fixture: OrganizationFixture) => {
  let pair = await createForkPair(fixture);
  let path = uniquePath('proposal');
  await addDocument(fixture, pair.fork, path, 'proposed change');

  return { ...pair, path };
};

describe('module-skill-merge-requests consumer permissions', () => {
  let org = useOrganization();

  it('keeps private skills and their merge requests away from consumers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let { fork, path } = await openChangedFork(fixture);
    let mergeRequest = await openMergeRequest(fixture, fork);
    let item = await getItemByPath(mergeRequest, path);
    let scope = { ...scopeOf(fixture), authorization: consumer.authorization };

    expect(await visibleIds(fixture, consumer.authorization, mergeRequest)).toEqual([]);
    await expectServiceError(
      skillMergeRequestService.getSkillMergeRequestById({
        ...scope,
        skillMergeRequestId: mergeRequest.id
      }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestEventService.listEvents({ ...scope, mergeRequest }),
      'forbidden'
    );
    await expectServiceError(
      openMergeRequest(fixture, fork, { authorization: consumer.authorization }),
      'forbidden'
    );
    await expectServiceError(
      skillForkSyncService.createSkillForkSync({ ...scope, forkSkillId: fork.id }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestService.saveSkillMergeRequestItemResolution({
        ...scope,
        mergeRequest,
        itemId: item.id,
        resolutionType: 'skip'
      }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestService.performSkillMergeRequest({ ...scope, mergeRequest }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestService.closeSkillMergeRequest({
        ...scope,
        auditScope: fixture.auditScope,
        mergeRequest
      }),
      'forbidden'
    );

    let row = await db.skillMergeRequest.findUniqueOrThrow({ where: { id: mergeRequest.id } });
    expect(row.status).toBe('open');
    expect(await getItemByPath(mergeRequest, path)).toMatchObject({ status: 'resolved' });
  });

  it('lets a consumer propose and close changes to a read-only upstream but not merge them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let bystander = await createConsumer(fixture);
    let { upstream, fork, path } = await openChangedFork(fixture);
    await setAccess(fixture, upstream, consumer, 'read');
    await setAccess(fixture, fork, consumer, 'write');
    let scope = { ...scopeOf(fixture), authorization: consumer.authorization };

    let mergeRequest = await openMergeRequest(fixture, fork, {
      authorization: consumer.authorization
    });
    expect(mergeRequest.createdByResourceActorOid).toBe(consumer.actor.oid);
    expect(await visibleIds(fixture, consumer.authorization, mergeRequest)).toEqual([
      mergeRequest.id
    ]);
    expect(
      (
        await skillMergeRequestService.getSkillMergeRequestById({
          ...scope,
          skillMergeRequestId: mergeRequest.id
        })
      ).id
    ).toBe(mergeRequest.id);

    let item = await getItemByPath(mergeRequest, path);
    await expectServiceError(
      skillMergeRequestService.saveSkillMergeRequestItemResolution({
        ...scope,
        mergeRequest,
        itemId: item.id,
        resolutionType: 'skip'
      }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestService.performSkillMergeRequest({ ...scope, mergeRequest }),
      'forbidden'
    );
    await expectServiceError(
      skillMergeRequestService.closeSkillMergeRequest({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: bystander.authorization,
        mergeRequest
      }),
      'forbidden'
    );
    expect(
      (await db.skillMergeRequest.findUniqueOrThrow({ where: { id: mergeRequest.id } })).status
    ).toBe('open');

    let closed = await skillMergeRequestService.closeSkillMergeRequest({
      ...scope,
      auditScope: fixture.auditScope,
      mergeRequest
    });
    expect(closed).toMatchObject({
      status: 'closed',
      closedByResourceActorOid: consumer.actor.oid
    });
    expect(await readDocument(fixture, upstream, path)).toBeUndefined();
  });

  it('lets a consumer merge into an upstream that is publicly writable', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let { upstream, fork, path } = await openChangedFork(fixture);
    await setAccess(fixture, upstream, consumer, 'write');
    await setAccess(fixture, fork, consumer, 'read');

    let mergeRequest = await openMergeRequest(fixture, fork, {
      authorization: consumer.authorization
    });
    let merged = await mergeAndWait(fixture, mergeRequest, consumer.authorization);

    expect(merged).toMatchObject({
      status: 'merged',
      mergeStartedByResourceActorOid: consumer.actor.oid,
      mergedByResourceActorOid: consumer.actor.oid
    });
    expect(await readDocument(fixture, upstream, path)).toBe('proposed change');

    let started = await db.skillMergeRequestEvent.findFirstOrThrow({
      where: { skillMergeRequestOid: mergeRequest.oid, type: 'merge_started' }
    });
    expect(started.resourceActorOid).toBe(consumer.actor.oid);
  });

  it('requires upstream read and fork write access to synchronize a fork', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let { upstream, fork } = await createForkPair(fixture);
    let scope = { ...scopeOf(fixture), authorization: consumer.authorization };
    let sync = () =>
      skillForkSyncService.createSkillForkSync({ ...scope, forkSkillId: fork.id });

    await setAccess(fixture, upstream, consumer, 'read');
    await setAccess(fixture, fork, consumer, 'read');
    await expectServiceError(sync(), 'forbidden');

    await setAccess(fixture, upstream, consumer, 'none');
    await setAccess(fixture, fork, consumer, 'write');
    await expectServiceError(sync(), 'forbidden');
    expect(await db.skillForkSync.count({ where: { forkSkillOid: fork.oid } })).toBe(0);

    await setAccess(fixture, upstream, consumer, 'read');
    let created = await sync();
    expect(created.createdByResourceActorOid).toBe(consumer.actor.oid);

    let fetched = await skillForkSyncService.getSkillForkSyncById({
      ...scope,
      skillForkSyncId: created.id
    });
    expect(fetched.id).toBe(created.id);

    await setAccess(fixture, fork, consumer, 'none');
    await expectServiceError(
      skillForkSyncService.getSkillForkSyncById({ ...scope, skillForkSyncId: created.id }),
      'forbidden'
    );
  });

  it('stops listing merge requests once their skills are private again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let { upstream, fork } = await openChangedFork(fixture);
    await setAccess(fixture, upstream, consumer, 'read');
    await setAccess(fixture, fork, consumer, 'read');

    let mergeRequest = await openMergeRequest(fixture, fork);
    expect(
      (
        await skillMergeRequestService.getSkillMergeRequestById({
          ...scopeOf(fixture),
          authorization: consumer.authorization,
          skillMergeRequestId: mergeRequest.id
        })
      ).id
    ).toBe(mergeRequest.id);

    await setAccess(fixture, upstream, consumer, 'none');
    await setAccess(fixture, fork, consumer, 'none');

    await expectServiceError(
      skillMergeRequestService.getSkillMergeRequestById({
        ...scopeOf(fixture),
        authorization: consumer.authorization,
        skillMergeRequestId: mergeRequest.id
      }),
      'forbidden'
    );
    expect(await visibleIds(fixture, consumer.authorization, mergeRequest)).toEqual([]);
    expect((await getMergeRequest(fixture, mergeRequest.id)).status).toBe('open');
  });
});
