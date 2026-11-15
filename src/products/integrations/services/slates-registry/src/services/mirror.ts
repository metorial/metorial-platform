import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { MirrorResultStatus, MirrorUpstreamStatus } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { normalizeUpstreamUrl, parseStaticUpstreams } from '../lib/mirror/upstreams';
import {
  getSigningKeyId,
  parseSigningPublicKey,
  type SigningPublicKey
} from '../lib/signature';
import { isMirrorMode, isSignatureVerificationRequired } from '../mode';
import { tenantService } from './tenant';
import { userService } from './user';

export let MIRROR_TENANT_IDENTIFIER = 'local-mirror';
export let MIRROR_USER_IDENTIFIER = 'local-mirror';
export let LOCAL_HUB_SUB_REGISTRY_IDENTIFIER = 'local-hub';
export let LICENSE_UPSTREAM_IDENTIFIER = 'license';

let settingsId = 'default';

let trustedKeyCacheMs = 30 * 1000;

let subRegistryIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

let assertMirrorMode = () => {
  if (!isMirrorMode()) {
    throw new ServiceError(
      badRequestError({ message: 'This registry is not running in mirror mode.' })
    );
  }
};

let assertSubRegistryId = (subRegistryId: string | null) => {
  if (subRegistryId !== null && !subRegistryIdPattern.test(subRegistryId)) {
    throw new ServiceError(badRequestError({ message: 'Invalid sub-registry id.' }));
  }
};

let parseUrlInput = (url: string) => {
  try {
    return normalizeUpstreamUrl(url);
  } catch {
    throw new ServiceError(badRequestError({ message: 'Invalid upstream registry url.' }));
  }
};

class mirrorServiceImpl {
  private trustedKeyCache: { loadedAt: number; keys: Map<string, SigningPublicKey> } | null =
    null;

  async ensureContext() {
    let tenant = await tenantService.upsertTenant({
      input: { identifier: MIRROR_TENANT_IDENTIFIER, name: 'Local Mirror' }
    });

    let user = await userService.ensureUserByIdentifier({
      identifier: MIRROR_USER_IDENTIFIER,
      name: 'Local Mirror',
      tenant
    });

    await db.subRegistry.upsert({
      where: { identifier: LOCAL_HUB_SUB_REGISTRY_IDENTIFIER },
      create: {
        ...getId('subRegistry'),
        identifier: LOCAL_HUB_SUB_REGISTRY_IDENTIFIER,
        name: 'Local Hub',
        onlyActivated: true,
        tenantOid: tenant.oid
      },
      update: { onlyActivated: true }
    });

    return { tenant, user };
  }

  async syncStaticUpstreams() {
    let configs = parseStaticUpstreams();

    for (let config of configs) {
      await db.mirrorUpstream.upsert({
        where: { identifier: config.identifier },
        create: {
          ...getId('mirrorUpstream'),
          source: 'static',
          status: 'active',
          identifier: config.identifier,
          name: config.name,
          url: config.url,
          subRegistryId: config.subRegistryId
        },
        update: {
          name: config.name,
          url: config.url,
          subRegistryId: config.subRegistryId,
          status: 'active',
          archivedAt: null
        }
      });
    }

    await db.mirrorUpstream.updateMany({
      where: {
        source: 'static',
        status: { not: 'archived' },
        identifier: { notIn: configs.map(config => config.identifier) }
      },
      data: { status: 'archived', archivedAt: new Date() }
    });
  }

  async getSettings() {
    return db.mirrorSettings.upsert({
      where: { id: settingsId },
      create: { oid: getId('mirrorSettings').oid, id: settingsId },
      update: {}
    });
  }

  // Pushed by the on-prem license monitor. Trusted keys are append-only so installs that
  // stop refreshing their license keep verifying everything they could verify before.
  async configureFromLicense(d: {
    licenseOperational: boolean;
    upstream: { url: string; subRegistryId: string | null } | null;
    trustedKeys: { kid: string; publicKey: unknown }[];
  }) {
    assertMirrorMode();

    let now = new Date();
    let keys: { kid: string; publicKey: SigningPublicKey }[] = [];

    for (let key of d.trustedKeys) {
      let publicKey = parseSigningPublicKey(key.publicKey);
      if (!publicKey || (await getSigningKeyId(publicKey)) !== key.kid) {
        throw new ServiceError(
          badRequestError({ message: `Invalid trusted signing key ${key.kid}.` })
        );
      }

      keys.push({ kid: key.kid, publicKey });
    }

    if (keys.length) {
      await db.trustedSigningKey.createMany({
        skipDuplicates: true,
        data: keys.map(key => ({
          ...getId('trustedSigningKey'),
          kid: key.kid,
          source: 'license' as const,
          publicKey: key.publicKey
        }))
      });

      await db.trustedSigningKey.updateMany({
        where: { kid: { in: keys.map(key => key.kid) } },
        data: { lastSeenAt: now }
      });
    }

    if (d.upstream) {
      let url = parseUrlInput(d.upstream.url);
      assertSubRegistryId(d.upstream.subRegistryId);

      await db.mirrorUpstream.upsert({
        where: { identifier: LICENSE_UPSTREAM_IDENTIFIER },
        create: {
          ...getId('mirrorUpstream'),
          source: 'license',
          status: 'active',
          identifier: LICENSE_UPSTREAM_IDENTIFIER,
          name: 'Metorial',
          url,
          subRegistryId: d.upstream.subRegistryId
        },
        update: { url, subRegistryId: d.upstream.subRegistryId }
      });
    }

    await this.getSettings();
    await db.mirrorSettings.update({
      where: { id: settingsId },
      data: { licenseOperational: d.licenseOperational, configuredAt: now }
    });

    this.trustedKeyCache = null;
    return this.getStatus();
  }

  async getTrustedKeys() {
    if (
      this.trustedKeyCache &&
      Date.now() - this.trustedKeyCache.loadedAt < trustedKeyCacheMs
    ) {
      return this.trustedKeyCache.keys;
    }

    let rows = await db.trustedSigningKey.findMany();
    let keys = new Map<string, SigningPublicKey>();

    for (let row of rows) {
      let publicKey = parseSigningPublicKey(row.publicKey);
      if (publicKey) keys.set(row.kid, publicKey);
    }

    this.trustedKeyCache = { loadedAt: Date.now(), keys };
    return keys;
  }

  async canSync() {
    if (!isMirrorMode()) return false;
    if (!isSignatureVerificationRequired()) return true;

    let settings = await this.getSettings();
    return settings.licenseOperational;
  }

  async getStatus() {
    let settings = await this.getSettings();
    let trustedKeyCount = await db.trustedSigningKey.count();

    return {
      isMirror: isMirrorMode(),
      signatureVerification: isSignatureVerificationRequired() ? 'required' : 'disabled',
      licenseOperational: settings.licenseOperational,
      configuredAt: settings.configuredAt,
      trustedKeyCount,
      canSync: await this.canSync()
    };
  }

  async listUpstreams(d: { includeArchived?: boolean }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.mirrorUpstream.findMany({
            ...opts,
            where: d.includeArchived ? {} : { status: { not: 'archived' } }
          })
      )
    );
  }

  async getUpstreamById(d: { id: string }) {
    let upstream = await db.mirrorUpstream.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] }
    });
    if (!upstream) throw new ServiceError(notFoundError('mirror.upstream'));

    return upstream;
  }

  async createUpstream(d: {
    input: { name: string; url: string; subRegistryId?: string | null };
  }) {
    assertMirrorMode();

    let url = parseUrlInput(d.input.url);
    let subRegistryId = d.input.subRegistryId?.trim() || null;
    assertSubRegistryId(subRegistryId);

    let ids = getId('mirrorUpstream');

    return db.mirrorUpstream.create({
      data: {
        ...ids,
        source: 'manual',
        status: 'active',
        identifier: `manual-${ids.id}`,
        name: d.input.name,
        url,
        subRegistryId
      }
    });
  }

  async updateUpstream(d: {
    id: string;
    input: {
      name?: string;
      url?: string;
      subRegistryId?: string | null;
      status?: Exclude<MirrorUpstreamStatus, 'archived'>;
    };
  }) {
    let upstream = await this.getUpstreamById({ id: d.id });
    if (upstream.status === 'archived') {
      throw new ServiceError(
        badRequestError({ message: 'Archived upstreams cannot change.' })
      );
    }

    let isManaged = upstream.source !== 'manual';
    if (isManaged && (d.input.url !== undefined || d.input.subRegistryId !== undefined)) {
      throw new ServiceError(
        badRequestError({ message: 'This upstream is managed by configuration.' })
      );
    }

    let subRegistryId =
      d.input.subRegistryId === undefined ? undefined : d.input.subRegistryId?.trim() || null;
    if (subRegistryId !== undefined) assertSubRegistryId(subRegistryId);

    let locationChanged =
      (d.input.url !== undefined && parseUrlInput(d.input.url) !== upstream.url) ||
      (subRegistryId !== undefined && subRegistryId !== upstream.subRegistryId);

    return db.mirrorUpstream.update({
      where: { oid: upstream.oid },
      data: {
        name: d.input.name,
        url: d.input.url === undefined ? undefined : parseUrlInput(d.input.url),
        subRegistryId,
        status: d.input.status,
        ...(locationChanged ? { changeNotificationCursor: null } : {})
      }
    });
  }

  async archiveUpstream(d: { id: string }) {
    let upstream = await this.getUpstreamById({ id: d.id });
    if (upstream.source !== 'manual') {
      throw new ServiceError(
        badRequestError({ message: 'This upstream is managed by configuration.' })
      );
    }

    return db.mirrorUpstream.update({
      where: { oid: upstream.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });
  }

  // Imports are idempotent, so replaying the whole feed only picks up what was missed.
  async resyncUpstream(d: { id: string }) {
    let upstream = await this.getUpstreamById({ id: d.id });

    return db.mirrorUpstream.update({
      where: { oid: upstream.oid },
      data: { changeNotificationCursor: null }
    });
  }

  async listResults(d: {
    upstreamId?: string;
    packImportId?: string;
    packImportBatchId?: string;
    status?: MirrorResultStatus[];
  }) {
    let upstream = d.upstreamId ? await this.getUpstreamById({ id: d.upstreamId }) : null;
    let batch = d.packImportBatchId
      ? await db.slatePackImportBatch.findFirst({ where: { id: d.packImportBatchId } })
      : null;
    if (d.packImportBatchId && !batch) {
      throw new ServiceError(notFoundError('mirror.pack_import_batch'));
    }

    let packImport = d.packImportId
      ? await db.slatePackImport.findFirst({ where: { id: d.packImportId } })
      : null;
    if (d.packImportId && !packImport) {
      throw new ServiceError(notFoundError('mirror.pack_import'));
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.mirrorResult.findMany({
            ...opts,
            where: {
              upstreamOid: upstream?.oid,
              packImportOid: packImport?.oid,
              packImport: batch ? { batchOid: batch.oid } : undefined,
              status: d.status?.length ? { in: d.status } : undefined
            },
            include: { upstream: true, packImport: true }
          })
      )
    );
  }
}

export let mirrorService = Service.create(
  'mirrorService',
  () => new mirrorServiceImpl()
).build();
