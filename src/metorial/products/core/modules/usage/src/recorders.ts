import { getSentry } from '@lowerdeck/sentry';
import { db as metorialDb } from '@metorial/db';
import { isUsageEnabled } from './lib/connection';
import {
  buildAuthErrorUsageEvent,
  buildAuthEventUsageEvent,
  buildConnectionTimeUsageEvent,
  buildConnectionUsageEvent,
  buildConsumerUsageEvent,
  buildMessageUsageEvent,
  buildSessionErrorUsageEvent,
  type UsageConnectionRow,
  type UsageMessageRow
} from './lib/events';
import {
  resolveUsageAgentId,
  resolveUsageConsumerByActor,
  resolveUsageInstance,
  resolveUsageProvider,
  resolveUsageSessionDims,
  type UsageParticipantRef
} from './lib/subspace';
import { usageRecordSessionQueue } from './queues/recordSession';
import { usageService } from './services';

let SESSION_RECORD_DELAY_MS = 60_000;

let Sentry = getSentry();

type SessionRef = {
  oid: bigint;
  id: string;
  isInternal?: boolean;
  identityActorOid?: bigint | null;
};

let safely = async (cb: () => Promise<void>) => {
  if (!isUsageEnabled()) return;

  try {
    await cb();
  } catch (e) {
    Sentry.captureException(e);
    console.error('Could not record usage:', e);
  }
};

type ParticipantRef = UsageParticipantRef & { identityActorOid: bigint | null };

let resolveSessionContext = async (d: {
  instanceOid: bigint | null | undefined;
  session: SessionRef;
  participant?: ParticipantRef | null;
}) => {
  if (d.session.isInternal) return null;

  let instance = await resolveUsageInstance(d.instanceOid);
  if (!instance) return null;

  let [session, consumerId, agentId] = await Promise.all([
    resolveUsageSessionDims(d.session),
    resolveUsageConsumerByActor(d.participant?.identityActorOid ?? d.session.identityActorOid),
    resolveUsageAgentId(d.participant)
  ]);

  return { instance, session, consumerId, agentId };
};

export let recordSessionMessageUsage = (
  message: UsageMessageRow & {
    instanceOid: bigint | null;
    session: SessionRef;
    senderParticipant?: ParticipantRef | null;
  }
) =>
  safely(async () => {
    let ctx = await resolveSessionContext({
      instanceOid: message.instanceOid,
      session: message.session,
      participant: message.senderParticipant
    });
    if (!ctx) return;

    await usageService.record(buildMessageUsageEvent(message, ctx));
  });

export let recordSessionCreatedUsage = (session: { id: string; isInternal?: boolean }) =>
  safely(async () => {
    if (session.isInternal) return;

    await usageRecordSessionQueue.add(
      { sessionId: session.id },
      { id: `usage-session-${session.id}`, delay: SESSION_RECORD_DELAY_MS }
    );
  });

export let recordConnectionCreatedUsage = (
  connection: UsageConnectionRow & {
    instanceOid: bigint | null;
    isInternal: boolean;
    session: SessionRef;
    participant?: ParticipantRef | null;
  }
) =>
  safely(async () => {
    if (connection.isInternal) return;

    let ctx = await resolveSessionContext({
      instanceOid: connection.instanceOid,
      session: connection.session,
      participant: connection.participant
    });
    if (!ctx) return;

    await usageService.record(buildConnectionUsageEvent(connection, ctx));
  });

export let recordConnectionTimeUsage = (
  connection: UsageConnectionRow & {
    instanceOid: bigint | null;
    isInternal: boolean;
    disconnectedAt: Date;
    session: SessionRef;
    participant?: ParticipantRef | null;
  }
) =>
  safely(async () => {
    if (connection.isInternal) return;

    let ctx = await resolveSessionContext({
      instanceOid: connection.instanceOid,
      session: connection.session,
      participant: connection.participant
    });
    if (!ctx) return;

    await usageService.record(buildConnectionTimeUsageEvent(connection, ctx));
  });

export let recordSessionErrorUsage = (error: {
  type: string;
  createdAt: Date;
  instanceOid: bigint | null;
  session: SessionRef;
  providerRun?: { providerOid: bigint } | null;
}) =>
  safely(async () => {
    let [ctx, providerId] = await Promise.all([
      resolveSessionContext({ instanceOid: error.instanceOid, session: error.session }),
      resolveUsageProvider(error.providerRun?.providerOid)
    ]);
    if (!ctx) return;

    await usageService.record(
      buildSessionErrorUsageEvent(
        { ...error, providerRun: providerId ? { provider: { id: providerId } } : null },
        ctx
      )
    );
  });

let resolveProviderContext = async (d: {
  instanceOid: bigint | null;
  providerOid: bigint | null;
}) => {
  let [instance, providerId] = await Promise.all([
    resolveUsageInstance(d.instanceOid),
    resolveUsageProvider(d.providerOid)
  ]);
  if (!instance) return null;

  return { instance, provider: providerId ? { id: providerId } : null };
};

export let recordProviderAuthEventUsage = (event: {
  status: string;
  createdAt: Date;
  instanceOid: bigint | null;
  providerOid: bigint | null;
}) =>
  safely(async () => {
    let ctx = await resolveProviderContext(event);
    if (!ctx) return;

    await usageService.record(
      buildAuthEventUsageEvent(
        { ...event, provider: ctx.provider },
        { instance: ctx.instance }
      )
    );
  });

export let recordProviderAuthErrorUsage = (error: {
  type: string;
  createdAt: Date;
  instanceOid: bigint | null;
  providerOid: bigint | null;
}) =>
  safely(async () => {
    let ctx = await resolveProviderContext(error);
    if (!ctx) return;

    await usageService.record(
      buildAuthErrorUsageEvent(
        { ...error, provider: ctx.provider },
        { instance: ctx.instance }
      )
    );
  });

export let recordConsumerCreatedUsage = (d: {
  instanceOid: bigint;
  consumerId: string;
  createdAt: Date;
}) =>
  safely(async () => {
    let instance = await metorialDb.instance.findUnique({
      where: { oid: d.instanceOid },
      select: { id: true, organization: { select: { id: true } } }
    });
    if (!instance) return;

    await usageService.record(
      buildConsumerUsageEvent(
        { consumerId: d.consumerId, createdAt: d.createdAt },
        { instance: { instanceId: instance.id, organizationId: instance.organization.id } }
      )
    );
  });
