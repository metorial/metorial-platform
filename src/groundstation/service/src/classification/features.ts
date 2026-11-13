import { createHash } from 'node:crypto';
import type { Organization } from '../../prisma/generated/client';
import { db } from '../db';
import type { StoreCollections } from '../store/connection';
import { contentAad, type ContentCipher } from '../store/contentCipher';
import type { SessionDocument } from '../store/derivedModels';
import type { ClassifierFeatures } from '../types';

let maxPromptLength = 2000;
let maxPathLength = 1000;

export type ClassificationFeatures = {
  repoIds: string[];
  workspaceIds: string[];
  repos: string[];
  branch?: string;
  ticketRefs: string[];
  workspaceLabel?: string;
  tags: Record<string, string>;
  clientFamily: string;
  mcpServers: string[];
  toolClasses: Record<string, number>;
  fileExts: Record<string, number>;
  teamNames: string[];
  path?: string;
  firstPrompt?: string;
};

export type ClefState = {
  repo?: string;
  branch?: string;
  ticketRefs: string[];
  path?: string;
  workspaceLabel?: string;
  tags: Record<string, string>;
  clientFamily: string;
  mcpServers: string[];
  toolClasses: Record<string, number>;
  fileExts: Record<string, number>;
  teamNames: string[];
  firstPrompt?: string;
};

type NamedEntity = {
  id: string;
  name: string | null;
  attributes: Record<string, unknown>;
  identifiers?: { type: string; value: string }[];
};

let unique = (values: string[]) => [...new Set(values.filter(Boolean))];

let repoName = (entity: NamedEntity) =>
  entity.name ??
  entity.identifiers?.find(identifier => identifier.type.startsWith('remote'))?.value ??
  entity.id;

let workspaceName = (entity: NamedEntity) =>
  entity.name ??
  (typeof entity.attributes.label == 'string' ? entity.attributes.label : undefined);

export let contextHash = (context: Partial<SessionDocument['context']> | undefined) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        [...(context?.repoIds ?? [])].sort(),
        [...(context?.workspaceIds ?? [])].sort(),
        [...(context?.ticketRefs ?? [])].sort()
      ])
    )
    .digest('hex')
    .slice(0, 32);

export let buildFeatures = (d: {
  session: SessionDocument;
  repos: NamedEntity[];
  workspaces: NamedEntity[];
  teamNames: string[];
  path?: string;
  firstPrompt?: string;
}): ClassificationFeatures => {
  let context = d.session.context;
  let repoIds = context?.repoIds ?? [];
  let workspaceIds = context?.workspaceIds ?? [];

  let reposById = new Map(d.repos.map(repo => [repo.id, repo]));
  let workspacesById = new Map(d.workspaces.map(workspace => [workspace.id, workspace]));

  let tags: Record<string, string> = {};
  for (let tag of context?.tags ?? []) tags[tag.k] = tag.v;

  return {
    repoIds,
    workspaceIds,
    repos: unique(
      repoIds.map(id => reposById.get(id)).flatMap(repo => (repo ? [repoName(repo)] : []))
    ),
    branch: context?.branch,
    ticketRefs: unique(context?.ticketRefs ?? []),
    workspaceLabel: workspaceIds
      .map(id => workspacesById.get(id))
      .map(workspace => (workspace ? workspaceName(workspace) : undefined))
      .find((label): label is string => !!label),
    tags,
    clientFamily: d.session.client?.family ?? 'unknown',
    mcpServers: unique(d.session.summary?.mcpServers ?? []),
    toolClasses: { ...(d.session.summary?.toolCallsByClass ?? {}) },
    fileExts: {},
    teamNames: unique(d.teamNames).sort(),
    path: d.path?.slice(0, maxPathLength),
    firstPrompt: d.firstPrompt?.slice(0, maxPromptLength)
  };
};

export let clefState = (features: ClassificationFeatures): ClefState => ({
  repo: features.repos.length ? features.repos.join(', ') : undefined,
  branch: features.branch,
  ticketRefs: features.ticketRefs,
  path: features.path,
  workspaceLabel: features.workspaceLabel,
  tags: features.tags,
  clientFamily: features.clientFamily,
  mcpServers: features.mcpServers,
  toolClasses: features.toolClasses,
  fileExts: features.fileExts,
  teamNames: features.teamNames,
  firstPrompt: features.firstPrompt
});

export let labelFeatures = (session: SessionDocument): ClassifierFeatures => ({
  repoIds: session.context?.repoIds ?? [],
  workspaceIds: session.context?.workspaceIds ?? [],
  branch: session.context?.branch,
  ticketRefs: session.context?.ticketRefs ?? [],
  clientFamily: session.client?.family
});

// Path and prompt text only exist in the store when the token's content policy kept them in
// `full` mode (07 §11), so finding a decryptable `full` entry is the permission check.
let readContentText = async (d: {
  collections: StoreCollections;
  cipher: ContentCipher;
  session: SessionDocument;
  role: 'path' | 'prompt';
  newest: boolean;
}) => {
  let record = await d.collections.events.findOne(
    {
      organizationId: d.session.organizationId,
      'ctx.sessionKey': d.session._id,
      content: { $elemMatch: { role: d.role, mode: 'full', hasText: true } }
    },
    { sort: { occurredAt: d.newest ? -1 : 1 }, projection: { _id: 1, content: 1 } }
  );
  if (!record) return undefined;

  let index = (record.content ?? []).findIndex(
    entry => entry.role == d.role && entry.mode == 'full' && entry.hasText
  );
  if (index < 0) return undefined;

  let text = await d.collections.contentTexts.findOne({ _id: `${record._id}:${index}` });
  if (!text) return undefined;

  try {
    let key = d.cipher.forOrganization({
      id: d.session.organizationId,
      contentKeyVersion: text.keyVersion
    });

    return d.cipher.decrypt(
      key,
      { iv: Buffer.from(text.iv.buffer), ciphertext: Buffer.from(text.ciphertext.buffer) },
      contentAad({
        organizationId: d.session.organizationId,
        recordId: record._id,
        index,
        role: d.role
      })
    );
  } catch {
    return undefined;
  }
};

export let loadClassificationFeatures = async (d: {
  organization: Organization;
  session: SessionDocument;
  collections: StoreCollections;
  cipher: ContentCipher | null;
}) => {
  let repoIds = d.session.context?.repoIds ?? [];
  let workspaceIds = d.session.context?.workspaceIds ?? [];
  let userId = d.session.observed?.userId;
  let startedAt = new Date(d.session.startedAt);

  let [entities, teamLinks, path, firstPrompt] = await Promise.all([
    repoIds.length || workspaceIds.length
      ? db.entity.findMany({
          where: {
            organizationOid: d.organization.oid,
            id: { in: [...repoIds, ...workspaceIds] }
          },
          include: { identifiers: true }
        })
      : [],
    userId
      ? db.entityLink.findMany({
          where: {
            organizationOid: d.organization.oid,
            type: 'member_of',
            from: { id: userId },
            to: { kind: 'team', status: 'managed' },
            validFrom: { lte: startedAt },
            OR: [{ validTo: null }, { validTo: { gt: startedAt } }]
          },
          include: { to: true }
        })
      : [],
    d.cipher && d.session.context?.pathStored
      ? readContentText({ ...d, cipher: d.cipher, role: 'path', newest: true })
      : undefined,
    d.cipher
      ? readContentText({ ...d, cipher: d.cipher, role: 'prompt', newest: false })
      : undefined
  ]);

  return buildFeatures({
    session: d.session,
    repos: entities.filter(entity => entity.kind == 'repo'),
    workspaces: entities.filter(entity => entity.kind == 'workspace'),
    teamNames: teamLinks.flatMap(link => (link.to.name ? [link.to.name] : [])),
    path,
    firstPrompt
  });
};
