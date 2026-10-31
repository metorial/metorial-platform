import { notFoundError } from '@lowerdeck/error';
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
import { afterAll, beforeAll } from 'vitest';
import {
  skillMarketplacePluginService,
  skillMarketplaceService,
  skillPluginService,
  skillPluginSkillService
} from '../src';
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
    'codeBucket:getEditorToken': payload => ({
      url: `http://origin.e2e/editor/${payload.codeBucketId}?readOnly=${!!payload.isReadOnly}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }),
    'scmRepository:getMany': payload => ({
      repositories: (payload.scmRepositoryIds as string[]).flatMap(id => {
        let repository = repositories.get(id);
        return repository ? [repository] : [];
      })
    }),
    'scmRepositorySync:getMany': () => ({ syncs: [] }),
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

      let result = handler(call.payload);
      calls.push({ name: call.name, payload: call.payload, result });
      return { id: call.id, status: 200, result };
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

  afterAll(() => {
    for (let server of servers) server.stop(true);
  });

  return {
    calls,
    logoUrl: () => `http://localhost:${port}/logo.svg`,
    callsTo: (name: string) => calls.filter(call => call.name === name),
    bucketCreation: (codeBucketId: string) =>
      calls.find(
        call => call.name === 'codeBucket:create' && call.result?.id === codeBucketId
      ),
    addRepository: (input: { owner?: string; name?: string } = {}) => {
      let id = uniqueId('osr');
      let owner = input.owner ?? 'e2e-owner';
      let name = input.name ?? uniqueId('repo');
      repositories.set(id, {
        object: 'origin#repository',
        id,
        identifier: `github/${owner}/${name}`,
        name,
        provider: 'github',
        externalId: uniqueId('gh'),
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
