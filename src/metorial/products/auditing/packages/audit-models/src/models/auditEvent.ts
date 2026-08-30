import type { AuditActor } from '@metorial/audit-scope';
import mongoose from 'mongoose';
import { dbConnect, isAuditDbEnabled } from '../connection';

export interface AuditEventContext {
  ip: string;
  ua?: string | null;
}

export interface AuditEventActor {
  type: AuditActor['type'];
  id: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  _id: string;

  organizationOid: string;
  instanceOid?: string;
  organizationActorOid?: string;
  actor?: AuditEventActor;
  context: AuditEventContext;
  resource: string;
  action: string;
  payload: unknown;
  previousAttributes?: unknown;
  recordedAt: Date;
}

export type AuditEventInput = {
  id: string;
  organizationOid: bigint | string | number;
  instanceOid?: bigint | string | number;
  organizationActorOid?: bigint | string | number;
  actor?: AuditActor;
  context: AuditEventContext;
  resource: string;
  action: string;
  payload: unknown;
  previousAttributes?: unknown;
  recordedAt: Date;
};

export let AuditEventSchema = new mongoose.Schema<AuditEvent>({
  _id: { type: String, required: true },
  organizationOid: { type: String, index: true, required: true },
  instanceOid: { type: String, index: true, required: false },
  organizationActorOid: { type: String, index: true, required: false },
  actor: {
    type: { type: String, required: false },
    id: { type: String, required: false },
    metadata: { type: mongoose.Schema.Types.Mixed, required: false }
  },
  context: {
    ip: String,
    ua: { type: String, required: false }
  },
  resource: { type: String, index: true },
  action: { type: String, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  previousAttributes: { type: mongoose.Schema.Types.Mixed, required: false },
  recordedAt: { type: Date, index: true }
});

AuditEventSchema.index({ organizationOid: 1, recordedAt: -1 });
AuditEventSchema.index({ instanceOid: 1, recordedAt: -1 });
AuditEventSchema.index({ organizationActorOid: 1, recordedAt: -1 });
AuditEventSchema.index({ 'actor.type': 1, 'actor.id': 1, recordedAt: -1 });
AuditEventSchema.index({ resource: 1, action: 1, recordedAt: -1 });

export let AuditEventModel = mongoose.model<AuditEvent>('AuditEvent', AuditEventSchema);

let toMongoValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(toMongoValue);
  if (value && typeof value === 'object') {
    let out: Record<string, unknown> = {};
    for (let [key, nested] of Object.entries(value)) {
      out[key] = toMongoValue(nested);
    }
    return out;
  }
  return value;
};

let toOidString = (value: bigint | string | number) => String(value);

let toOptionalOidString = (value?: bigint | string | number) =>
  value === undefined ? undefined : toOidString(value);

let toAuditEventDocument = (event: AuditEventInput): AuditEvent => {
  let doc: AuditEvent = {
    _id: event.id,
    organizationOid: toOidString(event.organizationOid),
    instanceOid: toOptionalOidString(event.instanceOid),
    organizationActorOid: toOptionalOidString(event.organizationActorOid),
    actor: event.actor
      ? {
          type: event.actor.type,
          id: event.actor.id,
          metadata: event.actor.metadata
            ? (toMongoValue(event.actor.metadata) as AuditEventActor['metadata'])
            : undefined
        }
      : undefined,
    context: {
      ip: event.context.ip,
      ua: event.context.ua
    },
    resource: event.resource,
    action: event.action,
    payload: toMongoValue(event.payload),
    previousAttributes:
      event.previousAttributes === undefined
        ? undefined
        : toMongoValue(event.previousAttributes),
    recordedAt: event.recordedAt
  };

  return doc;
};

export let ingestAuditEvent = async (event: AuditEventInput) => {
  await ingestAuditEvents([event]);
};

export let ingestAuditEvents = async (events: AuditEventInput[]) => {
  if (!isAuditDbEnabled()) return;
  if (events.length == 0) return;

  await dbConnect();

  await AuditEventModel.bulkWrite(
    events.map(event => {
      let doc = toAuditEventDocument(event);

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true
        }
      };
    }),
    { ordered: false }
  );
};

export let getAuditEventsByIds = async (eventIds: string[]): Promise<AuditEvent[]> => {
  if (!eventIds.length || !isAuditDbEnabled()) return [];

  await dbConnect();

  return await AuditEventModel.find({ _id: { $in: eventIds } })
    .lean()
    .exec();
};

export let deleteAuditEventsBefore = async (d: {
  organizationOid: bigint | string | number;
  recordedAt: Date;
}) => {
  if (!isAuditDbEnabled()) return;

  await dbConnect();

  await AuditEventModel.deleteMany({
    organizationOid: toOidString(d.organizationOid),
    recordedAt: { $lt: d.recordedAt }
  }).exec();
};
