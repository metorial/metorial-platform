import type { SecretPurpose } from '../../prisma/generated/client';
import { db } from '../db';

let byIdentifier = new Map<string, SecretPurpose>();
let byOid = new Map<number, SecretPurpose>();
let loaded = false;

export let secretPurposeCache = {
  async loadAll() {
    if (loaded) return;

    let purposes = await db.secretPurpose.findMany();
    for (let purpose of purposes) {
      byIdentifier.set(purpose.identifier, purpose);
      byOid.set(purpose.oid, purpose);
    }

    loaded = true;
  },

  set(purpose: SecretPurpose) {
    byIdentifier.set(purpose.identifier, purpose);
    byOid.set(purpose.oid, purpose);
  },

  getByIdentifier(identifier: string) {
    return byIdentifier.get(identifier);
  },

  getByOid(oid: number) {
    return byOid.get(oid);
  },

  clear() {
    byIdentifier.clear();
    byOid.clear();
    loaded = false;
  }
};
