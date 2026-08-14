import { delay } from '@lowerdeck/delay';
import { getSentry } from '@lowerdeck/sentry';
import mongoose from 'mongoose';
import { env } from './env';

let Sentry = getSentry();

declare global {
  var mongoose: any;
}

let connection = global.mongoose ?? { conn: null, promise: null };

export let isAuditDbEnabled = () => !!env.db.USAGE_MONGO_URL;

export let dbConnect = async () => {
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

    console.error('Could not connect to audit mongodb:', e);

    connection.promise = Promise.reject(e);
    connection.conn = null;

    throw e;
  }

  return connection.conn;
};

delay(100)
  .then(() => dbConnect())
  .catch(() => {});
