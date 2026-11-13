import { createError, notFoundError, ServiceError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  accessTagService,
  consumerSkillMarketplaceWriteRoles,
  consumerSkillPluginWriteRoles,
  consumerSkillReadRoles,
  createResourceAuthorization,
  storeAccessGrantService
} from '@metorial/module-access';
import { documentService, flushDocumentDraft } from '@metorial/module-documents';
import { skillService } from '@metorial/module-skill';
import { skillConfigurationService } from '@metorial/module-skill-configurations';
import { applyEnabledFlags, defaultFlags, setFlagProvider } from '@metorial/module-flags';
import { afterAll, afterEach, beforeAll, beforeEach, onTestFinished, vi } from 'vitest';
import {
  skillMarketplacePluginService,
  skillMarketplaceService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
import { readStoredManifestFile } from '../src/lib/manifestFile/storage';
import { syncFinishQueue } from '../src/queues/sync/finish';
import {
  syncPropagatePerformQueue,
  syncPropagateWaitQueue
} from '../src/queues/sync/propagate';
import { syncStartQueue } from '../src/queues/sync/start';
import type {
  EnrichedSkillMarketplace,
  EnrichedSkillPlugin,
  SerializerContext
} from '../src/serializers/_lib/types';

export let privileged = createResourceAuthorization({ restricted: false });

export let marketplaceReadRoles = consumerSkillReadRoles;
export let marketplaceWriteRoles = consumerSkillMarketplaceWriteRoles;
export let pluginWriteRoles = consumerSkillPluginWriteRoles;
export let skillReadRoles = consumerSkillReadRoles;

type OriginCall = { name: string; payload: any; result?: any };

export type FakeOrigin = ReturnType<typeof useFakeOrigin>;

export type FakeOriginSyncStatus =
  | 'pending'
  | 'creating_branch'
  | 'syncing_contents'
  | 'creating_pr'
  | 'waiting_for_ci'
  | 'waiting_for_review'
  | 'merging'
  | 'merged'
  | 'failed'
  | 'cancelled'
  | 'complete_unmerged'
  | 'complete_direct_push'
  | 'complete_no_changes';

export type FakeOriginSyncErrorCode =
  | 'deletion_guard_tripped'
  | 'source_not_found'
  | 'rate_limited'
  | 'manifest_invalid'
  | 'content_mismatch'
  | 'tree_too_large'
  | 'destination_too_large'
  | 'file_too_large'
  | 'lfs_quota_exceeded'
  | 'path_conflict'
  | 'provider_unavailable'
  | 'lease_expired'
  | 'no_progress';

export type FakeOriginSyncEndReason =
  'superseded' | 'pull_request_closed' | 'pull_request_deleted' | 'branch_deleted';

// Mirrors Origin's sync presenter: waitingReason is only reported while syncing_contents and
// waitingUntil falls back to nextPollAt. `omitWaitingFields` imitates an Origin that predates them.
export type FakeManifestSyncState = {
  status: FakeOriginSyncStatus;
  errorCode?: FakeOriginSyncErrorCode | null;
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown> | null;
  nextPollAt?: Date | null;
  waitingReason?: 'rate_limited' | 'provider_unavailable' | null;
  waitingUntil?: Date | null;
  omitWaitingFields?: boolean;
  endReason?: FakeOriginSyncEndReason | null;
  providerPrId?: string | null;
  providerPrUrl?: string | null;
  resultStats?: Record<string, number> | null;
};

export type FakeManifestSyncResponse =
  FakeManifestSyncState | { rpcError: { status: number; code: string; message?: string } };

export type FakeManifestSyncCall = {
  name: 'scmRepository:syncManifest';
  payload: {
    tenantId: string;
    scmRepositoryId: string;
    requestKey: string;
    sourceKey: string;
    manifest: { bucket: string; key: string; sha256: string; entryCount: number };
    previousManifest?: { bucket: string; key: string; sha256: string };
    [key: string]: any;
  };
  result?: any;
};

let logoSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>';

// Origin is not part of the e2e stack and the stack's ORIGIN_URL port belongs to the shared dev
// proxy. The origin client reads ORIGIN_URL lazily, so pointing it at the fake before the first
// call redirects the in-process services; the stack worker keeps failing its Origin calls.
export let useFakeOrigin = () => {
  let calls: OriginCall[] = [];
  let repositories = new Map<string, Record<string, unknown>>();
  let servers: ReturnType<typeof Bun.serve>[] = [];
  let port = 0;

  let syncs = new Map<string, Record<string, any>>();
  let syncIdByRequestKey = new Map<string, string>();
  let codeBucketsInUse = new Set<string>();
  let queuedSyncManifestResponses: FakeManifestSyncResponse[] = [];
  let mergedSyncManifestResponse = () => ({ status: 'merged' }) as const;
  let defaultSyncManifestResponse: (payload: any) => FakeManifestSyncResponse =
    mergedSyncManifestResponse;

  let presentSync = (sync: Record<string, any>) => {
    let { omitWaitingFields, ...presented } = structuredClone(sync);
    if (omitWaitingFields) {
      let { waitingReason: _reason, waitingUntil: _until, ...legacy } = presented;
      return legacy;
    }
    if (presented.sourceType !== 'manifest') return presented;

    let waitingReason =
      presented.status === 'syncing_contents' ? (presented.waitingReason ?? null) : null;
    return {
      ...presented,
      waitingReason,
      waitingUntil: waitingReason
        ? (presented.waitingUntil ?? presented.nextPollAt ?? null)
        : null
    };
  };

  let createManifestSync = (payload: FakeManifestSyncCall['payload']) => {
    let existingId = syncIdByRequestKey.get(`${payload.tenantId}:${payload.requestKey}`);
    if (existingId) return presentSync(syncs.get(existingId)!);

    let response = queuedSyncManifestResponses.shift() ?? defaultSyncManifestResponse(payload);
    if ('rpcError' in response) {
      throw new ServiceError(
        createError({
          status: response.rpcError.status,
          code: response.rpcError.code,
          message: response.rpcError.message ?? response.rpcError.code
        })
      );
    }

    let id = uniqueId('osrs');
    let now = new Date();
    let isPullRequest = payload.repositoryAccessMode !== 'direct_push';
    let sync = {
      object: 'origin#repository_sync',
      id,
      status: response.status,
      repositoryAccessMode: payload.repositoryAccessMode ?? 'pull_request',
      branchName: payload.branchName ?? `metorial/${payload.sourceKey}`,
      baseBranch: 'main',
      title: payload.prName ?? 'Metorial sync',
      description: payload.prDescription ?? null,
      enableAutoMerge: payload.enableAutoMerge ?? true,
      forceMergeOrPush: payload.forceMergeOrPush ?? false,
      mergeBeforeChecksPass: payload.mergeBeforeChecksPass ?? false,
      mergeAttemptStatus: null,
      mergeAttemptRefusalReason: null,
      providerPrId: response.providerPrId ?? (isPullRequest ? '1' : null),
      providerPrUrl:
        response.providerPrUrl ??
        (isPullRequest ? `https://github.com/e2e/${payload.scmRepositoryId}/pull/1` : null),
      providerMergeSha: null,
      errorMessage: response.errorMessage ?? response.errorCode ?? null,
      errorCode: response.errorCode ?? null,
      errorDetails: response.errorDetails ?? null,
      ciState: null,
      statusSnapshot: null,
      attemptCount: 0,
      logs: [],
      sourceType: 'manifest',
      sourceKey: payload.sourceKey,
      manifestSha256: payload.manifest.sha256,
      resultStats: response.resultStats ?? null,
      endReason: response.endReason ?? null,
      lastPolledAt: null,
      nextPollAt: response.nextPollAt ?? null,
      waitingReason: response.waitingReason ?? null,
      waitingUntil: response.waitingUntil ?? null,
      omitWaitingFields: response.omitWaitingFields ?? false,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };

    syncs.set(id, sync);
    syncIdByRequestKey.set(`${payload.tenantId}:${payload.requestKey}`, id);
    return presentSync(sync);
  };

  let handlers: Record<string, (payload: any) => unknown> = {
    'tenant:upsert': payload => ({
      object: 'origin#tenant',
      id: `otn_${payload.identifier}`,
      identifier: payload.identifier,
      name: payload.name
    }),
    'codeBucket:create': payload => ({
      object: 'origin#codeBucket',
      id: uniqueId('ocb'),
      tenantId: payload.tenantId,
      purpose: payload.purpose,
      isReadOnly: payload.isReadOnly
    }),
    'codeBucket:deletePath': () => ({ success: true }),
    'codeBucket:delete': payload => {
      if (codeBucketsInUse.has(payload.codeBucketId)) {
        throw new ServiceError(
          createError({
            status: 409,
            code: 'code_bucket_in_use',
            message: 'This code bucket is still being exported to a repository.'
          })
        );
      }
      return {
        object: 'origin#codeBucket',
        id: payload.codeBucketId,
        tenantId: payload.tenantId,
        deletedAt: new Date()
      };
    },
    'scmRepository:getMany': payload => ({
      repositories: (payload.scmRepositoryIds as string[]).flatMap(id => {
        let repository = repositories.get(id);
        return repository ? [repository] : [];
      })
    }),
    'scmRepository:syncManifest': payload => createManifestSync(payload),
    'scmRepository:syncCodeBucket': payload => {
      let id = uniqueId('osrs');
      let sync = {
        object: 'origin#repository_sync',
        id,
        status: 'merged',
        sourceType: 'code_bucket',
        branchName: payload.branchName ?? null,
        providerPrUrl: null,
        errorMessage: null,
        statusSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      syncs.set(id, sync);
      return presentSync(sync);
    },
    'scmRepositorySync:getMany': payload => ({
      syncs: ((payload.scmRepositorySyncIds ?? []) as string[]).flatMap(id => {
        let sync = syncs.get(id);
        return sync ? [presentSync(sync)] : [];
      })
    }),
    'changeNotification:poll': () => ({ items: [], nextCursor: null })
  };

  let handle = async (request: Request) => {
    let url = new URL(request.url);
    if (url.pathname.endsWith('/logo.svg')) {
      return new Response(logoSvg, { headers: { 'content-type': 'image/svg+xml' } });
    }

    let body = serialize.decode(await request.text()) as {
      calls?: { id: string; name: string; payload: any }[];
    };
    let results = (body.calls ?? []).map(call => {
      let handler = handlers[call.name];
      if (!handler) {
        calls.push({ name: call.name, payload: call.payload });
        return {
          id: call.id,
          status: 404,
          result: notFoundError('origin.method', call.name).toResponse()
        };
      }

      try {
        let result = handler(call.payload);
        calls.push({ name: call.name, payload: call.payload, result });
        return { id: call.id, status: 200, result };
      } catch (error) {
        if (!(error instanceof ServiceError)) throw error;

        let result = error.toResponse();
        calls.push({ name: call.name, payload: call.payload, result });
        return { id: call.id, status: error.data.status, result };
      }
    });

    return new Response(serialize.encode({ __typename: 'rpc.response', calls: results }), {
      headers: { 'content-type': 'application/rpc+json' }
    });
  };

  beforeAll(() => {
    let server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: handle });
    servers.push(server);
    port = server.port!;
    try {
      servers.push(Bun.serve({ port, hostname: '::1', fetch: handle }));
    } catch {}

    process.env.ORIGIN_URL = `http://127.0.0.1:${port}/metorial-origin`;
  });

  afterEach(() => {
    queuedSyncManifestResponses.length = 0;
    defaultSyncManifestResponse = mergedSyncManifestResponse;
    codeBucketsInUse.clear();
  });

  afterAll(() => {
    for (let server of servers) server.stop(true);
  });

  return {
    calls,
    logoUrl: () => `http://localhost:${port}/logo.svg`,
    callsTo: (name: string) => calls.filter(call => call.name === name),
    bucketCreation: (codeBucketId: string | null) =>
      calls.find(
        call => call.name === 'codeBucket:create' && call.result?.id === codeBucketId
      ),

    syncManifestCalls: () =>
      calls.filter(
        (call): call is FakeManifestSyncCall => call.name === 'scmRepository:syncManifest'
      ),
    // Applies to every new sync until changed; a function can pick a response per payload.
    respondToSyncManifest: (
      response: FakeManifestSyncResponse | ((payload: any) => FakeManifestSyncResponse)
    ) => {
      defaultSyncManifestResponse = typeof response == 'function' ? response : () => response;
    },
    // Consumed one per new sync (by request key) before the default applies.
    queueSyncManifestResponses: (...responses: FakeManifestSyncResponse[]) => {
      queuedSyncManifestResponses.push(...responses);
    },
    getSync: (syncId: string) => {
      let sync = syncs.get(syncId);
      return sync ? presentSync(sync) : undefined;
    },
    // Moves a stored sync on, e.g. waiting_for_review → cancelled with an endReason, so the
    // next scmRepositorySync:getMany poll sees it.
    updateSync: (syncId: string, patch: Partial<FakeManifestSyncState>) => {
      let sync = syncs.get(syncId);
      if (!sync) throw new Error(`Fake Origin has no sync ${syncId}`);

      Object.assign(sync, patch, { updatedAt: new Date() });
      if (patch.errorCode && patch.errorMessage === undefined)
        sync.errorMessage = patch.errorCode;
    },
    // Origin refuses to delete a bucket while a non-terminal repository sync still exports it.
    setCodeBucketInUse: (codeBucketId: string, inUse: boolean) => {
      if (inUse) codeBucketsInUse.add(codeBucketId);
      else codeBucketsInUse.delete(codeBucketId);
    },
    readManifest: async (call: FakeManifestSyncCall) =>
      await readStoredManifestFile(call.payload.manifest),
    readPreviousManifest: async (call: FakeManifestSyncCall) =>
      call.payload.previousManifest
        ? await readStoredManifestFile(call.payload.previousManifest)
        : undefined,

    // Each call is a separate Origin record; pass the same owner, name or externalId to model
    // one provider repository connected by several tenants.
    addRepository: (input: { owner?: string; name?: string; externalId?: string } = {}) => {
      let id = uniqueId('osr');
      let owner = input.owner ?? 'e2e-owner';
      let name = input.name ?? uniqueId('repo');
      repositories.set(id, {
        object: 'origin#repository',
        id,
        identifier: `github.com/${owner}/${name}`,
        name,
        provider: 'github',
        externalId: input.externalId ?? uniqueId('gh'),
        externalOwner: owner,
        externalName: name,
        externalUrl: `https://github.com/${owner}/${name}`,
        externalIsPrivate: false,
        defaultBranch: 'main',
        account: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return id;
    }
  };
};

export let originTenantId = (fixture: OrganizationFixture) =>
  `otn_mte-pro-${fixture.project.oid}`;

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};

export let createSkill = async (
  fixture: OrganizationFixture,
  input: { name?: string; description?: string } = {}
) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name: input.name ?? uniqueId('skill'),
      description: input.description ?? 'Created by the e2e suite'
    }
  });

export let getSkill = async (fixture: OrganizationFixture, skillId: string) =>
  await skillService.getSkillById({
    project: fixture.project,
    instance: fixture.instance,
    skillId
  });

export let addDocument = async (
  fixture: OrganizationFixture,
  skill: { storeId: string },
  path: string,
  content: string
) =>
  await documentService.createDocument({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      title: path.split('/').at(-1)!,
      content,
      authorization: privileged,
      store: { id: skill.storeId, path }
    }
  });

export let editDocument = async (
  fixture: OrganizationFixture,
  documentId: string,
  content: string
) => {
  let document = await documentService.getDocumentById({
    project: fixture.project,
    instance: fixture.instance,
    authorization: privileged,
    documentId
  });

  await documentService.updateDocument({
    project: fixture.project,
    instance: fixture.instance,
    document,
    input: { content, authorization: privileged }
  });

  await flushDocumentDraft({ documentId, force: true });
};

export let createSkillConfiguration = async (
  fixture: OrganizationFixture,
  input: {
    allowScripts?: boolean;
    allowedFileExtensions?: string[];
    allowNonStandardDirectories?: boolean;
  }
) =>
  await skillConfigurationService.createSkillConfiguration({
    project: fixture.project,
    instance: fixture.instance,
    input
  });

type CreateMarketplaceInput = Parameters<
  typeof skillMarketplaceService.createSkillMarketplace
>[0]['input'];

export let createMarketplace = async (
  fixture: OrganizationFixture,
  input: Partial<CreateMarketplaceInput> = {}
) =>
  await skillMarketplaceService.createSkillMarketplace({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      name: uniqueId('marketplace'),
      description: 'Created by the e2e suite',
      ...input
    }
  });

export let getMarketplace = async (
  fixture: OrganizationFixture,
  skillMarketplaceId: string,
  accessTags?: { accessTagOid: bigint }[]
) =>
  await skillMarketplaceService.getSkillMarketplaceById({
    project: fixture.project,
    instance: fixture.instance,
    skillMarketplaceId,
    accessTags
  });

type CreatePluginInput = Parameters<typeof skillPluginService.createSkillPlugin>[0]['input'];

export let createPlugin = async (
  fixture: OrganizationFixture,
  input: Partial<CreatePluginInput> = {},
  opts: { skillMarketplaceId?: string; accessTags?: { accessTagOid: bigint }[] } = {}
) =>
  await skillPluginService.createSkillPlugin({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillMarketplaceId: opts.skillMarketplaceId,
    accessTags: opts.accessTags,
    input: {
      name: uniqueId('plugin'),
      description: 'Created by the e2e suite',
      ...input
    }
  });

export let getPlugin = async (fixture: OrganizationFixture, skillPluginId: string) =>
  await skillPluginService.getSkillPluginById({
    project: fixture.project,
    instance: fixture.instance,
    skillPluginId
  });

export let addPluginToMarketplace = async (
  fixture: OrganizationFixture,
  d: {
    skillMarketplaceId: string;
    skillPluginId: string;
    pluginSlug?: string;
    skillConfigurationId?: string | null;
    accessTags?: { accessTagOid: bigint }[];
  }
) =>
  await skillMarketplacePluginService.addSkillMarketplacePlugin({
    project: fixture.project,
    instance: fixture.instance,
    skillMarketplace: await getMarketplace(fixture, d.skillMarketplaceId),
    accessTags: d.accessTags,
    input: {
      skillPluginId: d.skillPluginId,
      pluginSlug: d.pluginSlug,
      skillConfigurationId: d.skillConfigurationId
    }
  });

export let removePluginFromMarketplace = async (
  fixture: OrganizationFixture,
  skillMarketplacePluginId: string,
  accessTags?: { accessTagOid: bigint }[]
) =>
  await skillMarketplacePluginService.removeSkillMarketplacePlugin({
    project: fixture.project,
    instance: fixture.instance,
    skillMarketplacePlugin: await skillMarketplacePluginService.getSkillMarketplacePluginById({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplacePluginId
    }),
    accessTags
  });

type AddPluginSkillInput = Parameters<
  typeof skillPluginSkillService.addSkillPluginSkill
>[0]['input'];

export let addSkillToPlugin = async (
  fixture: OrganizationFixture,
  d: { skillPluginId: string; accessTags?: { accessTagOid: bigint }[] } & AddPluginSkillInput
) => {
  let { skillPluginId, accessTags, ...input } = d;

  return await skillPluginSkillService.addSkillPluginSkill({
    project: fixture.project,
    instance: fixture.instance,
    skillPlugin: await getPlugin(fixture, skillPluginId),
    accessTags,
    input
  });
};

export let archivePlugin = async (
  fixture: OrganizationFixture,
  skillPluginId: string,
  accessTags?: { accessTagOid: bigint }[]
) =>
  await skillPluginService.archiveSkillPlugin({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillPlugin: await getPlugin(fixture, skillPluginId),
    accessTags
  });

export let archiveMarketplace = async (
  fixture: OrganizationFixture,
  skillMarketplaceId: string
) =>
  await skillMarketplaceService.archiveSkillMarketplace({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillMarketplace: await getMarketplace(fixture, skillMarketplaceId)
  });

export let createAccessTag = async (fixture: OrganizationFixture) => {
  let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });
  return { accessTag, accessTags: [{ accessTagOid: accessTag.oid }] };
};

export let grantAccess = async (
  fixture: OrganizationFixture,
  d: {
    accessTag: { oid: bigint };
    roles: readonly string[];
    skill?: { oid: bigint };
    skillMarketplace?: { oid: bigint };
    skillPlugin?: { oid: bigint };
  }
) => {
  let policy = await db.accessTagPolicy.create({
    data: {
      id: await ID.generateId('accessTagPolicy'),
      name: uniqueId('e2e-marketplace-policy'),
      roles: [...d.roles],
      organizationOid: fixture.organization.oid
    }
  });

  let entity = await db.accessTagEntity.create({
    data: {
      accessTagOid: d.accessTag.oid,
      accessTagPolicyOid: policy.oid,
      skillOid: d.skill?.oid,
      skillMarketplaceOid: d.skillMarketplace?.oid,
      skillPluginOid: d.skillPlugin?.oid
    }
  });

  if (d.skill) {
    await storeAccessGrantService.syncLegacySkillGrants({ skillOid: d.skill.oid });
  }

  return entity;
};

// Mirrors how the sync collector loads serializer inputs, so serializers can run in-process
// without the code-bucket service the sync process stage writes to.
let enrichedPluginInclude = {
  skillConfiguration: true,
  skillPluginSkills: {
    where: { status: 'active', skill: { status: 'active' } },
    include: { skill: true, skillConfiguration: true }
  }
} as const;

let toEnrichedPlugin = <T extends { skillPluginSkills: EnrichedSkillPlugin['skills'] }>(
  plugin: T
) => ({ ...plugin, skills: plugin.skillPluginSkills });

export let loadMarketplaceSerializerInput = async (skillMarketplaceId: string) => {
  let marketplace = await db.skillMarketplace.findUniqueOrThrow({
    where: { id: skillMarketplaceId },
    include: {
      skillConfiguration: true,
      plugins: {
        where: { status: 'active', skillPlugin: { status: 'active' } },
        include: {
          skillConfiguration: true,
          skillPlugin: { include: enrichedPluginInclude }
        }
      }
    }
  });
  let skillMarketplace: EnrichedSkillMarketplace = marketplace;

  return {
    skillMarketplace,
    plugins: marketplace.plugins.map(membership => {
      let skillPlugin = toEnrichedPlugin(membership.skillPlugin);
      let skillMarketplacePlugin = { ...membership, plugin: skillPlugin };

      return {
        skillPlugin,
        skillMarketplacePlugin,
        skills: skillPlugin.skills.map(skillPluginSkill => ({
          skill: skillPluginSkill.skill,
          skillPlugin,
          skillPluginSkill,
          skillMarketplace,
          skillMarketplacePlugin
        }))
      };
    })
  };
};

export let loadStandalonePluginSerializerInput = async (skillPluginId: string) => {
  let skillPlugin = toEnrichedPlugin(
    await db.skillPlugin.findUniqueOrThrow({
      where: { id: skillPluginId },
      include: enrichedPluginInclude
    })
  );

  return {
    skillPlugin,
    skills: skillPlugin.skills.map(skillPluginSkill => ({
      skill: skillPluginSkill.skill,
      skillPlugin,
      skillPluginSkill
    }))
  };
};

let contentToString = (content: string | Buffer | ArrayBuffer) =>
  typeof content === 'string'
    ? content
    : Buffer.from(content as ArrayBuffer).toString('utf-8');

export let runSerializer = async <Input, InitResult>(
  serializer: {
    init: (input: Input) => Promise<InitResult>;
    getHash: (input: Input, initResult: InitResult) => Promise<string>;
    apply: (input: Input, context: SerializerContext, initResult: InitResult) => Promise<void>;
  },
  input: Input
) => {
  let files = new Map<string, string>();
  let basePath: string | undefined;
  let resolve = (path: string) =>
    [basePath, path.replace(/^\/+/, '')].filter(Boolean).join('/');

  let context: SerializerContext = {
    setBasePath: path => {
      basePath = path;
    },
    setFile: async (path, content) => {
      files.set(resolve(path), contentToString(content));
    },
    setFileFromStorage: async (path, file) => {
      files.set(resolve(path), `storage:${file.oid}`);
    },
    deletePath: async path => {
      files.delete(resolve(path));
    }
  };

  let initResult = await serializer.init(input);
  let hash = await serializer.getHash(input, initResult);
  await serializer.apply(input, context, initResult);

  return {
    hash,
    files,
    paths: () => [...files.keys()].sort(),
    json: (path: string) => JSON.parse(files.get(path)!)
  };
};

let stackFlags = () => applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS);

// The stack enables every flag, so suites asserting code-bucket destinations turn this off.
// Only affects destinations created in-process; the stack worker keeps the stack flags.
export let useSkillsManifestSyncFlag = (enabled: boolean) => {
  let apply = () =>
    setFlagProvider(async () => ({ ...stackFlags(), 'skills-manifest-sync': enabled }));

  beforeAll(apply);
  beforeEach(apply);
  afterAll(() => setFlagProvider(async () => stackFlags()));
};

// The stack worker consumes the sync stage queues but cannot reach the fake Origin, and its
// retries hold the destination sync lock for minutes. Tests that call the stage handlers
// in-process hold these jobs instead so the worker never races them for that lock.
export let holdSyncStageQueues = () => {
  let jobs: { queue: 'start' | 'perform' | 'wait' | 'finish'; payload: any }[] = [];

  let hold = (
    queue: (typeof jobs)[number]['queue'],
    target: { add: (...args: any[]) => any }
  ) =>
    vi.spyOn(target, 'add').mockImplementation(async (payload: any) => {
      jobs.push({ queue, payload });
      return {};
    });

  let spies = [
    hold('start', syncStartQueue),
    hold('perform', syncPropagatePerformQueue),
    hold('wait', syncPropagateWaitQueue),
    hold('finish', syncFinishQueue)
  ];
  onTestFinished(() => {
    for (let spy of spies) spy.mockRestore();
  });

  return {
    jobs: (queue: (typeof jobs)[number]['queue']) =>
      jobs.filter(job => job.queue === queue).map(job => job.payload)
  };
};

// The stack worker sends Origin calls to the stack's ORIGIN_URL, which nothing serves in e2e.
// Forwarding that port to the fake Origin lets worker-driven syncs reach repositories too.
export let useStackOriginProxy = (origin: FakeOrigin) => {
  let stackUrl = new URL(process.env.ORIGIN_URL ?? 'http://localhost:52090/metorial-origin');
  let servers: ReturnType<typeof Bun.serve>[] = [];

  beforeAll(() => {
    let target = new URL(origin.logoUrl());
    let forward = async (request: Request) => {
      let url = new URL(request.url);
      return await fetch(`http://127.0.0.1:${target.port}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method)
          ? undefined
          : await request.arrayBuffer()
      });
    };

    let port = Number(stackUrl.port);
    servers.push(Bun.serve({ port, hostname: '127.0.0.1', fetch: forward }));
    try {
      servers.push(Bun.serve({ port, hostname: '::1', fetch: forward }));
    } catch {}
  });

  afterAll(() => {
    for (let server of servers) server.stop(true);
  });
};
