import { createRedisClient } from '@lowerdeck/redis';
import { env } from '@metorial-cargo/db';
import { documentLiveInstanceId } from './documentLiveBus';
import {
  type DocumentLiveSessionState,
  filterActiveSessions,
  parseSessionState
} from './documentLiveSessionRegistryUtils';

let redisFactory = createRedisClient({
  redisUrl: env.service.REDIS_URL
});

let redisClientPromise: Promise<any> | undefined;

let getRedis = async () => {
  redisClientPromise ??= redisFactory.eager();
  return await redisClientPromise;
};

let sessionsKey = (documentId: string) =>
  `cargo:document:collaboration:${documentId}:sessions`;

let participantPayloadKey = (documentId: string) =>
  `cargo:document:collaboration:${documentId}:participantPayload`;

export let upsertLiveSession = async (
  session: Omit<DocumentLiveSessionState, 'instanceId'> & { instanceId?: string },
  timeoutMs: number
) => {
  let redis = await getRedis();
  let key = sessionsKey(session.documentId);
  let state: DocumentLiveSessionState = {
    ...session,
    instanceId: session.instanceId ?? documentLiveInstanceId
  };

  await redis.hSet(key, state.id, JSON.stringify(state));
  await redis.expire(key, Math.ceil((timeoutMs * 2) / 1000));
};

export let removeLiveSession = async (documentId: string, sessionId: string) => {
  let redis = await getRedis();
  await redis.hDel(sessionsKey(documentId), sessionId);
};

export let listActiveLiveSessions = async (
  documentId: string,
  timeoutMs: number,
  now = Date.now()
) => {
  let redis = await getRedis();
  let key = sessionsKey(documentId);
  let rawSessions = await redis.hGetAll(key);
  let sessions = Object.values(rawSessions ?? {})
    .map(value => (typeof value == 'string' ? parseSessionState(value) : null))
    .filter((session): session is DocumentLiveSessionState => !!session);

  let active = filterActiveSessions({ sessions, now, timeoutMs });
  let staleSessionIds = sessions
    .filter(session => now - session.lastPingAt > timeoutMs)
    .map(session => session.id);

  if (staleSessionIds.length > 0) {
    await redis.hDel(key, staleSessionIds);
  }

  return active;
};

export let shouldPublishParticipantPayload = async (
  documentId: string,
  serializedPayload: string,
  timeoutMs: number
) => {
  let redis = await getRedis();
  let key = participantPayloadKey(documentId);
  let existing = await redis.get(key);
  if (existing === serializedPayload) return false;

  await redis.set(key, serializedPayload, {
    PX: timeoutMs * 2
  });
  return true;
};

export let __documentLiveSessionRegistryTestUtils = {
  filterActiveSessions,
  parseSessionState
};
