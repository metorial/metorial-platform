import type { SecretPurpose } from '../../prisma/generated/client';
import { db } from '../db';

let byIdentifier = new Map<string, SecretPurpose>();
let byOid = new Map<number, SecretPurpose>();
let loaded = false;

let setPurpose = (purpose: SecretPurpose) => {
  byIdentifier.set(purpose.identifier, purpose);
  byOid.set(purpose.oid, purpose);
};

export let secretPurposeCache = {
  async loadAll() {
    if (loaded) return;

    let purposes = await db.secretPurpose.findMany();
    for (let purpose of purposes) {
      setPurpose(purpose);
    }

    loaded = true;
  },

  set(purpose: SecretPurpose) {
    setPurpose(purpose);
  },

  async getByIdentifierOrLoad(identifier: string) {
    await this.loadAll();

    let cached = byIdentifier.get(identifier);
    if (cached) return cached;

    let purpose = await db.secretPurpose.findUnique({
      where: { identifier }
    });
    if (purpose) this.set(purpose);

    return purpose ?? null;
  },

  async getByOidOrLoad(oid: number) {
    await this.loadAll();

    let cached = byOid.get(oid);
    if (cached) return cached;

    let purpose = await db.secretPurpose.findUnique({
      where: { oid }
    });
    if (purpose) this.set(purpose);

    return purpose ?? null;
  },

  clear() {
    byIdentifier.clear();
    byOid.clear();
    loaded = false;
  }
};
