import { ID } from '@metorial/db';
import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  dispatchSystemEventDelivery,
  eventDeliveryAttemptService,
  eventDeliveryService,
  resolveAttemptDetails
} from '../src';
import { eventDeliveryAttemptFlushSingleQueue } from '../src/queues/attemptDetailFlush';
import {
  createDestination,
  createListener,
  createSystemEvent,
  expectedSignature,
  headerValue,
  useRecordingReceiver,
  waitForDelivery,
  waitForDestinations
} from './_fixtures';

let ping = (fixture: OrganizationFixture, eventDestination: { id: string }) =>
  db.eventDestination
    .findUniqueOrThrow({ where: { id: eventDestination.id } })
    .then(destination =>
      eventDeliveryService.pingEventDestination({
        organization: fixture.organization,
        eventDestination: destination,
        auditScope: fixture.auditScope
      })
    );

let attemptsOf = (eventDeliveryId: string) =>
  db.eventDeliveryAttempt.findMany({
    where: { intent: { id: eventDeliveryId } },
    orderBy: { attemptNumber: 'asc' }
  });

let recordedRequest = (attempt: {
  detailsJson: PrismaJson.EventDeliveryAttemptDetails | null;
}) => {
  expect(attempt.detailsJson).not.toBeNull();
  return attempt.detailsJson!.request;
};

describe('module-event-delivery: attempts', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let receiver = useRecordingReceiver();

  it('never reaches a loopback receiver, whatever form its address takes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let sanity = await fetch(`http://127.0.0.1:${receiver.port}/sanity`, { method: 'POST' });
    expect(sanity.status).toBe(200);
    expect(receiver.requests.map(request => request.path)).toEqual(['/sanity']);
    receiver.clear();

    let literalUrls = [
      `http://127.0.0.1:${receiver.port}/literal`,
      `http://2130706433:${receiver.port}/decimal`,
      `http://0.0.0.0:${receiver.port}/unspecified`,
      `http://[::ffff:127.0.0.1]:${receiver.port}/mapped`
    ];
    let literalDeliveries = [];
    for (let url of literalUrls) {
      let destination = await createDestination(fixture, { url, retry: { maxAttempts: 3 } });
      literalDeliveries.push(await ping(fixture, destination));
    }

    let hostname = await createDestination(fixture, {
      url: `http://localhost:${receiver.port}/hostname`,
      retry: { maxAttempts: 2 }
    });
    let hostnameDelivery = await ping(fixture, hostname);

    for (let delivery of literalDeliveries) {
      let failed = await waitForDelivery(fixture, delivery.id, {
        status: 'failed',
        attemptCount: 1
      });
      expect(failed.errorCode).toBe('url_not_allowed');
      expect(failed.attempts[0]).toMatchObject({
        status: 'failed',
        isRetryable: false,
        errorCode: 'url_not_allowed',
        responseStatusCode: null
      });
    }

    let hostnameFailed = await waitForDelivery(fixture, hostnameDelivery.id, {
      status: 'failed',
      attemptCount: 2
    });
    for (let attempt of hostnameFailed.attempts) {
      expect(attempt).toMatchObject({
        isRetryable: true,
        errorCode: 'request_failed',
        responseStatusCode: null
      });
      expect(attempt.errorMessage).toContain('Private or internal IP blocked');
    }

    expect(receiver.requests).toEqual([]);
  }, 120_000);

  it('records the signed request it sends, with the documented payload and headers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let eventType = uniqueId('e2e.signed');
    let payload = { object: 'e2e.thing', id: uniqueId('thing'), nested: { count: 2 } };

    let destination = await createDestination(fixture);
    await createListener(fixture, destination, { eventTypes: [eventType] });

    let systemEvent = await createSystemEvent(fixture, { eventType, payload });
    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });

    let [intent] = await waitForDestinations(systemEvent, [destination.id]);
    await waitForDelivery(fixture, intent!.id, { status: 'failed', attemptCount: 1 });
    let [attempt] = await attemptsOf(intent!.id);
    let request = recordedRequest(attempt!);

    expect(request).toMatchObject({
      url: destination.webhookDestination!.url,
      method: 'POST'
    });
    expect(attempt!.detailsJson!.response).toBeNull();
    expect(headerValue(request.headers, 'content-type')).toBe('application/json');
    expect(headerValue(request.headers, 'user-agent')).toBe('Metorial (https://metorial.com)');
    expect(headerValue(request.headers, 'metorial-event-id')).toBe(systemEvent.id);
    expect(headerValue(request.headers, 'metorial-event-type')).toBe(eventType);
    expect(headerValue(request.headers, 'metorial-delivery-id')).toBe(intent!.id);
    expect(headerValue(request.headers, 'metorial-delivery-attempt')).toBe('1');
    expect(headerValue(request.headers, 'metorial-destination-id')).toBe(destination.id);

    let timestamp = headerValue(request.headers, 'metorial-timestamp')!;
    expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(300);
    expect(headerValue(request.headers, 'metorial-signature')).toBe(
      expectedSignature({
        body: request.body!,
        timestamp,
        signingSecret: destination.webhookDestination!.signingSecret
      })
    );
    expect(headerValue(request.headers, 'metorial-signature')).not.toBe(
      expectedSignature({
        body: request.body!,
        timestamp,
        signingSecret: await ID.generateId('webhookSigningSecret')
      })
    );

    expect(JSON.parse(request.body!)).toEqual({
      object: 'event',
      id: systemEvent.id,
      source: 'resource',
      event_type: eventType,
      compartments: [
        {
          type: 'instance',
          organization_id: org.ids.organizationId,
          instance_id: org.ids.instanceId
        }
      ],
      callback_id: null,
      callback_trigger_key: null,
      chat_event_id: null,
      chat_connection_id: null,
      occurred_at: systemEvent.createdAt.toISOString(),
      payload
    });
  });

  it('signs pings with the current secret after a rotation and scopes them to the organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);
    let originalSecret = destination.webhookDestination!.signingSecret;

    let firstPing = await ping(fixture, destination);
    expect(firstPing).toMatchObject({ status: 'pending', instanceOid: null });
    await waitForDelivery(fixture, firstPing.id, { status: 'failed', attemptCount: 1 });

    let rotatedSecret = await ID.generateId('webhookSigningSecret');
    await db.webhookDestination.update({
      where: { oid: destination.webhookDestinationOid! },
      data: { signingSecret: rotatedSecret }
    });

    let secondPing = await ping(fixture, destination);
    await waitForDelivery(fixture, secondPing.id, { status: 'failed', attemptCount: 1 });

    let [firstAttempt] = await attemptsOf(firstPing.id);
    let [secondAttempt] = await attemptsOf(secondPing.id);

    for (let [attempt, secret, staleSecret] of [
      [firstAttempt!, originalSecret, rotatedSecret],
      [secondAttempt!, rotatedSecret, originalSecret]
    ] as const) {
      let request = recordedRequest(attempt);
      let timestamp = headerValue(request.headers, 'metorial-timestamp')!;
      let signature = headerValue(request.headers, 'metorial-signature');
      expect(signature).toBe(
        expectedSignature({ body: request.body!, timestamp, signingSecret: secret })
      );
      expect(signature).not.toBe(
        expectedSignature({ body: request.body!, timestamp, signingSecret: staleSecret })
      );
    }

    let body = JSON.parse(recordedRequest(secondAttempt!).body!);
    expect(body).toMatchObject({
      object: 'event',
      source: 'ping',
      event_type: 'ping',
      compartments: [{ type: 'organization', organization_id: org.ids.organizationId }],
      payload: { message: 'ping' }
    });
  }, 120_000);

  it('retries a retryable failure with growing delays until the attempt budget is spent', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture, {
      retry: {
        strategy: 'exponential',
        maxAttempts: 3,
        baseDelaySeconds: 3,
        maxDelaySeconds: 4
      }
    });

    let delivery = await ping(fixture, destination);
    expect(delivery).toMatchObject({ retryStrategy: 'exponential', retryMaxAttempts: 3 });

    let retrying = await eventually(
      async () => {
        let current = await eventDeliveryService.getEventDeliveryById({
          organization: fixture.organization,
          eventDeliveryId: delivery.id
        });
        expect(current).toMatchObject({ status: 'retrying', attemptCount: 1 });
        return current;
      },
      { timeoutMs: 60_000, intervalMs: 100 }
    );
    expect(retrying.completedAt).toBeNull();
    expect(retrying.errorCode).toBe('request_failed');
    expect(retrying.nextAttemptAt!.getTime()).toBeGreaterThan(
      retrying.lastAttemptAt!.getTime()
    );

    let failed = await waitForDelivery(
      fixture,
      delivery.id,
      { status: 'failed', attemptCount: 3 },
      { timeoutMs: 90_000 }
    );
    expect(failed).toMatchObject({ errorCode: 'request_failed', nextAttemptAt: null });
    expect(failed.completedAt).toBeInstanceOf(Date);

    let attempts = await attemptsOf(delivery.id);
    expect(attempts.map(attempt => attempt.attemptNumber)).toEqual([1, 2, 3]);
    for (let attempt of attempts) {
      expect(attempt).toMatchObject({
        status: 'failed',
        isRetryable: true,
        errorCode: 'request_failed'
      });
      expect(headerValue(recordedRequest(attempt).headers, 'metorial-delivery-attempt')).toBe(
        String(attempt.attemptNumber)
      );
    }
    for (let index = 1; index < attempts.length; index++) {
      let gap =
        attempts[index]!.startedAt.getTime() - attempts[index - 1]!.completedAt.getTime();
      expect(gap).toBeGreaterThanOrEqual(900);
    }
    expect(failed.lastAttemptAt!.getTime()).toBe(attempts[2]!.completedAt.getTime());

    let listed = await firstPage(
      await eventDeliveryAttemptService.listEventDeliveryAttempts({
        organization: fixture.organization,
        eventDeliveryIds: [delivery.id]
      })
    );
    expect(listed.map(attempt => attempt.id).sort()).toEqual(
      attempts.map(attempt => attempt.id).sort()
    );
    expect(
      await firstPage(
        await eventDeliveryAttemptService.listEventDeliveryAttempts({
          organization: fixture.organization,
          eventDeliveryIds: [delivery.id],
          statuses: ['succeeded']
        })
      )
    ).toEqual([]);
  }, 180_000);

  it('cancels a scheduled retry once the destination is archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture, {
      retry: { strategy: 'fixed', maxAttempts: 5, baseDelaySeconds: 8, maxDelaySeconds: 8 }
    });

    let delivery = await ping(fixture, destination);
    await waitForDelivery(fixture, delivery.id, { status: 'retrying', attemptCount: 1 });

    await db.eventDestination.update({
      where: { oid: destination.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });

    let cancelled = await waitForDelivery(fixture, delivery.id, {
      status: 'cancelled',
      attemptCount: 1
    });
    expect(cancelled).toMatchObject({
      errorCode: 'destination_archived',
      nextAttemptAt: null
    });
    expect(cancelled.completedAt).toBeInstanceOf(Date);
    expect(await attemptsOf(delivery.id)).toHaveLength(1);

    await expectServiceError(
      eventDeliveryService.pingEventDestination({
        organization: fixture.organization,
        eventDestination: await db.eventDestination.findUniqueOrThrow({
          where: { oid: destination.oid }
        }),
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
    expect(
      await db.eventDeliveryIntent.count({ where: { eventDestinationOid: destination.oid } })
    ).toBe(1);
  }, 120_000);

  it('keeps the retry policy captured at scheduling time and gives a manual retry a fresh budget', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture, {
      url: `http://127.0.0.1:${receiver.port}/manual-retry`,
      retry: { maxAttempts: 2 }
    });

    let delivery = await ping(fixture, destination);
    await db.eventDestination.update({
      where: { oid: destination.oid },
      data: { retryMaxAttempts: 9, retryStrategy: 'linear' }
    });

    let failed = await waitForDelivery(fixture, delivery.id, {
      status: 'failed',
      attemptCount: 1
    });
    expect(failed).toMatchObject({
      retryMaxAttempts: 2,
      retryStrategy: 'fixed',
      errorCode: 'url_not_allowed'
    });

    let retried = await eventDeliveryService.retryEventDelivery({
      organization: fixture.organization,
      eventDelivery: failed,
      auditScope: fixture.auditScope
    });
    expect(retried).toMatchObject({
      status: 'retrying',
      retryMaxAttempts: 3,
      errorCode: null,
      completedAt: null
    });

    await expectServiceError(
      eventDeliveryService.retryEventDelivery({
        organization: fixture.organization,
        eventDelivery: retried,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );

    let failedAgain = await waitForDelivery(fixture, delivery.id, {
      status: 'failed',
      attemptCount: 2
    });
    expect(failedAgain.attempts.map(attempt => attempt.attemptNumber)).toEqual([1, 2]);
    expect(receiver.requests).toEqual([]);
  }, 120_000);

  it('moves attempt details to object storage and still resolves them afterwards', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createDestination(fixture);

    let delivery = await ping(fixture, destination);
    await waitForDelivery(fixture, delivery.id, { status: 'failed', attemptCount: 1 });
    let [attempt] = await attemptsOf(delivery.id);
    expect(attempt!.detailsStorageKey).toBeNull();
    let details = attempt!.detailsJson;
    expect(details).not.toBeNull();

    await eventDeliveryAttemptFlushSingleQueue.add(
      { attemptId: attempt!.id },
      { id: `event-delivery-attempt-flush:${attempt!.id}` }
    );

    let flushed = await eventually(
      async () => {
        let row = await db.eventDeliveryAttempt.findUniqueOrThrow({
          where: { id: attempt!.id }
        });
        expect(row.detailsStorageKey).toBe(`attempts/${attempt!.id}/details`);
        expect(row.detailsJson).toBeNull();
        return row;
      },
      { timeoutMs: 45_000, intervalMs: 500 }
    );

    expect(await resolveAttemptDetails(flushed)).toEqual(details);
  }, 120_000);

  it("hides one organization's deliveries and attempts from another and filters them", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let destination = await createDestination(fixture);

    let delivery = await ping(fixture, destination);
    let failed = await waitForDelivery(fixture, delivery.id, {
      status: 'failed',
      attemptCount: 1
    });
    let attemptId = failed.attempts[0]!.id;

    await expectServiceError(
      eventDeliveryService.getEventDeliveryById({
        organization: otherFixture.organization,
        eventDeliveryId: delivery.id
      }),
      'not_found'
    );
    await expectServiceError(
      eventDeliveryAttemptService.getEventDeliveryAttemptById({
        organization: otherFixture.organization,
        eventDeliveryAttemptId: attemptId
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await eventDeliveryService.listEventDeliveries({
          organization: otherFixture.organization,
          eventDestinationIds: [destination.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await eventDeliveryAttemptService.listEventDeliveryAttempts({
          organization: otherFixture.organization,
          eventDeliveryIds: [delivery.id]
        })
      )
    ).toEqual([]);

    let listIds = async (
      input: Omit<
        Parameters<typeof eventDeliveryService.listEventDeliveries>[0],
        'organization'
      >
    ) =>
      (
        await firstPage(
          await eventDeliveryService.listEventDeliveries({
            organization: fixture.organization,
            eventDestinationIds: [destination.id],
            ...input
          })
        )
      ).map(item => item.id);

    expect(await listIds({})).toEqual([delivery.id]);
    expect(await listIds({ statuses: ['failed'] })).toEqual([delivery.id]);
    expect(await listIds({ statuses: ['delivered', 'pending'] })).toEqual([]);
    expect(await listIds({ eventTypes: ['ping'] })).toEqual([delivery.id]);
    expect(await listIds({ eventTypes: [uniqueId('e2e.none')] })).toEqual([]);
    expect(await listIds({ eventIds: [failed.systemEvent.id] })).toEqual([delivery.id]);
  }, 120_000);
});
