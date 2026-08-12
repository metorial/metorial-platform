import { serialize } from '@lowerdeck/serialize';
import type { AuditActor, AuditScope } from '@metorial/audit-scope';
import { createRedisClient } from '@metorial/redis';

let getRedis = createRedisClient({}).lazy();

let AUDIT_EVENT_STASH = 'audit:events:stash';
let CLAIMED_AUDIT_EVENT_STASH = 'audit:events:stash:claimed';

let claimAuditEventsScript = `
local values = {}
local limit = tonumber(ARGV[1])

for i = 1, limit do
  local value = redis.call("LPOP", KEYS[1])
  if not value then
    break
  end

  redis.call("RPUSH", KEYS[2], value)
  table.insert(values, value)
end

return values
`;

export interface StashedAuditEvent {
  id: string;
  resourceTenantOid: bigint;
  resourceGroupOid: bigint;
  resourceActorOid?: bigint;
  actor?: AuditActor;
  context: AuditScope['context'];
  resource: string;
  action: string;
  payload: unknown;
  previousAttributes?: unknown;
  recordedAt: Date;
}

export let stashAuditEvent = async (event: StashedAuditEvent) => {
  let redis = await getRedis();
  await redis.rPush(AUDIT_EVENT_STASH, serialize.encode(event));
};

export let decodeStashedAuditEvent = (encodedEvent: string) =>
  serialize.decode(encodedEvent) as StashedAuditEvent;

export let listClaimedAuditEvents = async () => {
  let redis = await getRedis();
  return await redis.lRange(CLAIMED_AUDIT_EVENT_STASH, 0, -1);
};

export let claimAuditEvents = async (limit: number) => {
  let redis = await getRedis();
  let events = await redis.eval(claimAuditEventsScript, {
    keys: [AUDIT_EVENT_STASH, CLAIMED_AUDIT_EVENT_STASH],
    arguments: [String(limit)]
  });

  return Array.isArray(events) ? events.map(String) : [];
};

export let acknowledgeClaimedAuditEvent = async (encodedEvent: string) => {
  let redis = await getRedis();
  await redis.lRem(CLAIMED_AUDIT_EVENT_STASH, 1, encodedEvent);
};
