import type mongoose from 'mongoose';

export let minimumQueryMajorVersion = 7;

export class UnsupportedStoreVersionError extends Error {}

let checked = new WeakMap<object, Promise<string>>();

export let parseMajorVersion = (version: string) =>
  Number.parseInt(version.split('.')[0] ?? '', 10);

// Query codegen targets one operator set ($dateTrunc, $percentile, …) with no fallbacks:
// MongoDB 7+ or DocumentDB 8 (11 §9.10).
export let assertQueryEngineSupported = (db: mongoose.mongo.Db) => {
  let existing = checked.get(db);
  if (existing) return existing;

  let check = db
    .admin()
    .command({ buildInfo: 1 })
    .then(info => {
      let version = String(info.version ?? '0');
      if (!(parseMajorVersion(version) >= minimumQueryMajorVersion)) {
        throw new UnsupportedStoreVersionError(
          `The record store runs version ${version}; queries need MongoDB 7 or DocumentDB 8.`
        );
      }

      return version;
    })
    .catch(error => {
      checked.delete(db);
      throw error;
    });

  checked.set(db, check);
  return check;
};
