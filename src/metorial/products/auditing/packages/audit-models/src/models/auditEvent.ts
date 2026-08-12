import mongoose from 'mongoose';
import { dbConnect, isAuditDbEnabled } from '../connection';

export interface AuditEventContext {
  ip: string;
  ua?: string | null;
}

export interface AuditEvent {
  _id: string;

  resourceTenantOid: string;
  resourceGroupOid: string;
  resourceActorOid: string;
  context: AuditEventContext;
  resource: string;
  action: string;
  payload: unknown;
  previousAttributes?: unknown;
  recordedAt: Date;
}

export type AuditEventInput = {
  id: string;
  resourceTenantOid: bigint | string | number;
  resourceGroupOid: bigint | string | number;
  resourceActorOid: bigint | string | number;
  context: AuditEventContext;
  resource: string;
  action: string;
  payload: unknown;
  previousAttributes?: unknown;
  recordedAt: Date;
};

export let AuditEventSchema = new mongoose.Schema<AuditEvent>({
  _id: { type: String, required: true },
  resourceTenantOid: { type: String, index: true },
  resourceGroupOid: { type: String, index: true },
  resourceActorOid: { type: String, index: true },
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

AuditEventSchema.index({ resourceTenantOid: 1, recordedAt: -1 });
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

export let ingestAuditEvent = async (event: AuditEventInput) => {
  if (!isAuditDbEnabled()) return;

  await dbConnect();

  let doc: AuditEvent = {
    _id: event.id,
    resourceTenantOid: toOidString(event.resourceTenantOid),
    resourceGroupOid: toOidString(event.resourceGroupOid),
    resourceActorOid: toOidString(event.resourceActorOid),
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

  await AuditEventModel.updateOne(
    { _id: doc._id },
    { $setOnInsert: doc },
    { upsert: true }
  );
};
