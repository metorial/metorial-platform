import { delay } from '@metorial/delay';
import { getSentry } from '@metorial/sentry';
import { endOfDay, endOfHour, startOfDay, startOfHour } from 'date-fns';
import mongoose from 'mongoose';
import { env } from './env';

let Sentry = getSentry();

declare global {
  var mongoose: any;
}

let connection = global.mongoose ?? { conn: null, promise: null };

let isEnabled = () => !!env.db.USAGE_MONGO_URL;

let dbConnect = async () => {
  if (!env.db.USAGE_MONGO_URL) return null;

  if (connection.conn) return connection.conn;

  if (!connection.promise) {
    console.log('Connecting to usage mongodb');
    connection.promise = mongoose.connect(env.db.USAGE_MONGO_URL, {
      bufferCommands: false
    });
  }

  try {
    connection.conn = await connection.promise;
  } catch (e) {
    Sentry.captureException(e);

    console.error('Could not connect to usage mongodb:', e);

    connection.promise = Promise.reject(e);
    connection.conn = null;

    throw e;
  }

  return connection.conn;
};

delay(100)
  .then(() => dbConnect())
  .catch(() => {});

export interface UsageRecord {
  _id: string;

  ownerId: string; // org or instance
  entityId: string;
  entityType: string;
  count: number;
  type: string;
  ts: Date;
}

export let UsageRecordSchema = new mongoose.Schema<UsageRecord>({
  ownerId: String,
  entityId: { type: String, index: true },
  entityType: String,
  count: Number,
  type: String,
  ts: { type: Date, expires: 60 * 60 * 24 * 30, index: true } // 30 days
});

export let UsageRecordModel = mongoose.model<UsageRecord>('UsageRecord', UsageRecordSchema);

let usageLocal = new Map<string, Omit<UsageRecord, '_id'>>();
let getHash = (record: Omit<UsageRecord, '_id'>) =>
  `${record.ownerId}:${record.entityId}:${record.type}`;
export let ingestUsage = (record: Omit<UsageRecord, '_id'>) => {
  if (!isEnabled()) return;

  let hash = getHash(record);
  let existing = usageLocal.get(hash);
  if (existing) {
    existing.count += record.count;
  } else {
    usageLocal.set(hash, { ...record });
  }
};

setInterval(async () => {
  let records = Array.from(usageLocal.values());
  usageLocal.clear();
  await UsageRecordModel.insertMany(records);
}, 1000);

export let getUsageTimeline = async (opts: {
  ownerIds?: string[];
  entityTypes?: string[];
  entityIds?: string[];

  from: Date;
  to: Date;

  interval: {
    unit: 'day' | 'hour';
    count: number;
  };
}) => {
  if (!isEnabled()) return [];

  let from = opts.interval.unit == 'day' ? startOfDay(opts.from) : startOfHour(opts.from);
  let to = opts.interval.unit == 'day' ? endOfDay(opts.to) : endOfHour(opts.to);

  let match: any = {
    ts: { $gte: from, $lt: to }
  };

  if (opts.ownerIds?.length) match.ownerId = { $in: opts.ownerIds };

  if (opts.entityTypes?.length) match.entityType = { $in: opts.entityTypes };

  if (opts.entityIds?.length) match.entityId = { $in: opts.entityIds };

  let intervalMs =
    (opts.interval.unit === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000) *
    opts.interval.count;

  let group: any = {
    _id: {
      ownerId: '$ownerId',
      entityId: '$entityId',
      entityType: '$entityType',
      type: '$type',
      ts: {
        $add: [
          {
            $subtract: [
              { $subtract: ['$ts', new Date(0)] },
              { $mod: [{ $subtract: ['$ts', new Date(0)] }, intervalMs] }
            ]
          },
          new Date(0)
        ]
      }
    },
    count: { $sum: '$count' }
  };

  let timeline = (await UsageRecordModel.aggregate([
    { $match: match },
    { $group: group }
  ])) as {
    _id: {
      ownerId: string;
      entityId: string;
      entityType: string;
      type: string;
      ts: Date;
    };
    count: number;
  }[];

  let timelineMap = new Map<
    string,
    {
      ownerId: string;
      entityId: string;
      entityType: string;
      series: Map<number, number>;
    }
  >(
    timeline.length
      ? []
      : opts.entityIds?.map(entityId => {
          let type = opts.entityTypes?.[0] ?? 'any';
          let key = `none:${entityId}:${type}`;
          return [
            key,
            {
              ownerId: 'none',
              entityId,
              entityType: type,
              series: new Map<number, number>()
            }
          ];
        })
  );

  for (let record of timeline) {
    let key = `${record._id.ownerId}:${record._id.entityId}:${record._id.entityType}`;
    let series = timelineMap.get(key);
    if (!series) {
      series = {
        ownerId: record._id.ownerId,
        entityId: record._id.entityId,
        entityType: record._id.entityType,
        series: new Map<number, number>()
      };
      timelineMap.set(key, series);
    }

    series.series.set(record._id.ts.getTime(), record.count);
  }

  let tsInInterval: number[] = [];

  let currentTs = from.getTime();
  while (currentTs < to.getTime()) {
    tsInInterval.push(currentTs);
    currentTs += intervalMs;
  }

  for (let ts of tsInInterval) {
    for (let series of timelineMap.values()) {
      if (!series.series.has(ts)) {
        series.series.set(ts, 0);
      }
    }
  }

  return Array.from(timelineMap.values()).map(series => ({
    entityId: series.entityId,
    entityType: series.entityType,
    ownerId: series.ownerId,

    entries: Array.from(series.series.entries()).map(([ts, count]) => ({
      ts: new Date(ts),
      count
    }))
  }));
};
