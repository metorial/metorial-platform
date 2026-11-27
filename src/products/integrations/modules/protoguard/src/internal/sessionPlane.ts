import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import { parseRedisUrl } from '@metorial-subspace/redis-url';
import Redis from 'ioredis';
import { env } from '../env';
import {
  createSessionPlaneState,
  recordSessionOutput,
  recordSessionToolCall,
  type ProjectedFinding,
  type SessionFinding,
  type SessionPlaneState
} from '../lib/engine';
import type { PersistMessageScanJob } from '../lib/persistJob';

let SESSION_STATE_TTL_SECONDS = 60 * 60;
let SESSION_STATE_KEY_PREFIX = 'sub:pg:sess:';
let SUSPICIOUS_OUTPUT_MIN_PRECISION = 0.5;

let sessionLock = createLock({
  name: 'sub/pg/sess/lock',
  redisUrl: env.service.REDIS_URL
});

let redis: Redis | undefined;
let getRedis = () => {
  redis ??= new Redis(parseRedisUrl(env.service.REDIS_URL));
  return redis;
};

let getStateKey = (sessionOid: bigint) => `${SESSION_STATE_KEY_PREFIX}${sessionOid}`;

let parseState = (value: string | null): SessionPlaneState => {
  if (!value) return createSessionPlaneState();

  try {
    let parsed = JSON.parse(value) as SessionPlaneState;
    return parsed?.version == 1 ? parsed : createSessionPlaneState();
  } catch {
    return createSessionPlaneState();
  }
};

let toSessionFindingInput = (finding: ProjectedFinding) => ({
  ruleKey: finding.ruleKey,
  family: finding.family,
  precision: finding.precision,
  stage: finding.stage,
  contentHmac: finding.contentHmac
});

let isSink = (job: PersistMessageScanJob) =>
  job.capabilityTags.includes('external_comm') || job.capabilityTags.includes('state_change');

// Reading and writing the session state costs a lock and two Redis round trips, so messages that
// cannot change it skip it entirely.
let needsSessionState = (job: PersistMessageScanJob) => {
  let isSinkCall = job.directions.includes('input') && job.isToolCall && isSink(job);
  let hasOutputSignal =
    job.directions.includes('output') &&
    job.findings.some(
      finding =>
        finding.direction == 'output' &&
        finding.stage == 'active' &&
        (finding.contentHmac || finding.precision >= SUSPICIOUS_OUTPUT_MIN_PRECISION)
    );

  return isSinkCall || hasOutputSignal;
};

class ProtoGuardSessionPlaneServiceImpl {
  async apply(d: {
    sessionOid: bigint;
    providerOid: bigint | null;
    messageId: string;
    job: PersistMessageScanJob;
  }): Promise<SessionFinding[]> {
    if (!needsSessionState(d.job)) return [];

    let key = getStateKey(d.sessionOid);
    let providerId = d.providerOid == null ? null : String(d.providerOid);

    return await sessionLock.usingLock(key, async () => {
      let client = getRedis();
      let state = parseState(await client.get(key));
      let findings: SessionFinding[] = [];

      if (d.job.directions.includes('input') && d.job.isToolCall) {
        let result = recordSessionToolCall(state, {
          providerId,
          capabilityTags: d.job.capabilityTags
        });
        state = result.state;
        findings.push(...result.findings);
      }

      if (d.job.directions.includes('output')) {
        let result = recordSessionOutput(state, {
          messageId: d.messageId,
          providerId,
          findings: d.job.findings
            .filter(finding => finding.direction == 'output')
            .map(toSessionFindingInput)
        });
        state = result.state;
        findings.push(...result.findings);
      }

      await client.set(key, JSON.stringify(state), 'EX', SESSION_STATE_TTL_SECONDS);

      return findings;
    });
  }
}

export let protoGuardSessionPlaneService = Service.create(
  'protoGuardSessionPlaneService',
  () => new ProtoGuardSessionPlaneServiceImpl()
).build();
