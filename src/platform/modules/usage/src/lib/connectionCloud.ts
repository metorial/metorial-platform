import { delay } from '@lowerdeck/delay';
import { getSentry } from '@lowerdeck/sentry';
import mongoose from 'mongoose';
import { env } from '../env';

let Sentry = getSentry();

let connection: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = {
  conn: null,
  promise: null
};

export let isUsageEnabled = () => !!env.db.USAGE_MONGO_URL;

export let usageDbConnect = async () => {
  if (!env.db.USAGE_MONGO_URL) return null;
  if (connection.conn) return connection.conn;

  if (!connection.promise) {
    connection.promise = mongoose.connect(env.db.USAGE_MONGO_URL, {
      bufferCommands: false
    });
  }

  try {
    connection.conn = await connection.promise;
  } catch (e) {
    Sentry.captureException(e);
    console.error('Could not connect to usage mongodb:', e);

    connection.promise = null;
    connection.conn = null;

    throw e;
  }

  return connection.conn;
};

delay(100)
  .then(() => usageDbConnect())
  .catch(() => {});
