import { db as cargoDb } from '@metorial-cargo/db/sync-source';
import { db, ID } from '@metorial/db';
import { resolveResourceActorLinks } from './actor';
import { cargoSyncModels, type CargoSyncModelSpec } from './models';
import {
  claimCargoSyncRecordOwnership,
  isCargoSyncRecordOwned
} from './ownership';

export let CARGO_SYNC_PAGE_SIZE = 100;

let lowerFirst = (value: string) => value[0]!.toLowerCase() + value.slice(1);

let targetModelName = (sourceModel: string) => {
  if (sourceModel === 'Tenant') return 'ResourceTenant';
  if (sourceModel === 'Environment') return 'ResourceGroup';
  if (sourceModel === 'TenantActor') return 'ResourceActor';
  return sourceModel;
};

let targetFieldName = (sourceField: string) => {
  if (sourceField === 'tenantOid') return 'resourceTenantOid';
  if (sourceField === 'environmentOid') return 'resourceGroupOid';
  return sourceField
    .replaceAll('TenantActor', 'ResourceActor')
    .replace(/^tenantActor/, 'resourceActor');
};

let sourceDelegate = (name: string): any => (cargoDb as any)[lowerFirst(name)];
let targetDelegate = (name: string): any => (db as any)[lowerFirst(name)];

let modelsWithoutPublicId = new Set([
  'DocumentContent',
  'SkillDestinationItem',
  'SkillExportRef'
]);

let modelHasPublicId = (name: string) => !modelsWithoutPublicId.has(name);

type RelationSpec = {
  field: string;
  model: string;
  required?: boolean;
};

let modelRelations: Record<string, RelationSpec[]> = {
  Environment: [{ field: 'tenantOid', model: 'Tenant', required: true }],
  TenantActor: [{ field: 'tenantOid', model: 'Tenant', required: true }],
  File: [
    { field: 'purposeOid', model: 'FilePurpose', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'createdByTenantActorOid', model: 'TenantActor' }
  ],
  FileLink: [
    { field: 'fileOid', model: 'File', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'createdByTenantActorOid', model: 'TenantActor' }
  ],
  FileReference: [
    { field: 'fileLinkOid', model: 'FileLink', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  Document: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'contentOid', model: 'DocumentContent', required: true },
    { field: 'fileOid', model: 'File', required: true },
    { field: 'currentVersionOid', model: 'DocumentVersion' },
    { field: 'parentDocumentOid', model: 'Document' },
    { field: 'createdByTenantActorOid', model: 'TenantActor' }
  ],
  DocumentParticipant: [
    { field: 'documentOid', model: 'Document', required: true },
    { field: 'tenantActorOid', model: 'TenantActor', required: true }
  ],
  DocumentVersion: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'documentOid', model: 'Document', required: true },
    { field: 'contentOid', model: 'DocumentContent', required: true },
    { field: 'previousVersionOid', model: 'DocumentVersion' }
  ],
  DocumentVersionEditors: [
    { field: 'documentVersionOid', model: 'DocumentVersion', required: true },
    { field: 'tenantActorOid', model: 'TenantActor', required: true }
  ],
  Store: [
    { field: 'createdByTenantActorOid', model: 'TenantActor' },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'parentStoreOid', model: 'Store' },
    { field: 'parentStoreTemplateOid', model: 'StoreTemplate' }
  ],
  StoreTemplate: [
    { field: 'tenantOid', model: 'Tenant' },
    { field: 'environmentOid', model: 'Environment' },
    { field: 'sourceStoreOid', model: 'Store' }
  ],
  StoreTemplateItem: [
    { field: 'storeTemplateOid', model: 'StoreTemplate', required: true }
  ],
  StoreTemplateBacking: [
    { field: 'storeTemplateOid', model: 'StoreTemplate', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'storeOid', model: 'Store', required: true }
  ],
  StoreItem: [
    { field: 'storeOid', model: 'Store', required: true },
    { field: 'fileOid', model: 'File' },
    { field: 'referenceOid', model: 'FileReference' },
    { field: 'documentOid', model: 'Document' },
    { field: 'directoryOid', model: 'StoreDirectory' },
    { field: 'parentDirectoryOid', model: 'StoreDirectory' },
    { field: 'lastModifiedByTenantActorOid', model: 'TenantActor' }
  ],
  StoreVersion: [{ field: 'storeOid', model: 'Store', required: true }],
  StoreVersionItem: [
    { field: 'storeVersionOid', model: 'StoreVersion', required: true },
    { field: 'fileOid', model: 'File' },
    { field: 'documentOid', model: 'Document' },
    { field: 'documentVersionOid', model: 'DocumentVersion' }
  ],
  StoreParticipant: [
    { field: 'storeOid', model: 'Store', required: true },
    { field: 'tenantActorOid', model: 'TenantActor', required: true }
  ],
  StoreDirectory: [
    { field: 'storeOid', model: 'Store', required: true },
    { field: 'parentDirectoryOid', model: 'StoreDirectory' }
  ],
  Skill: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'storeOid', model: 'Store', required: true },
    { field: 'parentSkillOid', model: 'Skill' },
    { field: 'forkedFromSkillVersionOid', model: 'SkillVersion' },
    { field: 'parentSkillTemplateOid', model: 'SkillTemplate' },
    { field: 'createdByTenantActorOid', model: 'TenantActor' }
  ],
  SkillConfiguration: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  SkillAgent: [
    { field: 'skillOid', model: 'Skill', required: true },
    { field: 'storeItemOid', model: 'StoreItem' },
    { field: 'documentOid', model: 'Document', required: true }
  ],
  SkillVersion: [
    { field: 'skillOid', model: 'Skill', required: true },
    { field: 'storeVersionOid', model: 'StoreVersion', required: true }
  ],
  SkillTemplate: [
    { field: 'storeTemplateOid', model: 'StoreTemplate', required: true },
    { field: 'tenantOid', model: 'Tenant' },
    { field: 'environmentOid', model: 'Environment' }
  ],
  SkillParticipant: [
    { field: 'skillOid', model: 'Skill', required: true },
    { field: 'tenantActorOid', model: 'TenantActor', required: true }
  ],
  SkillMergeRequest: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'sourceSkillOid', model: 'Skill', required: true },
    { field: 'targetSkillOid', model: 'Skill', required: true },
    { field: 'baseSourceSkillVersionOid', model: 'SkillVersion' },
    { field: 'baseTargetSkillVersionOid', model: 'SkillVersion', required: true },
    { field: 'requestedSourceSkillVersionOid', model: 'SkillVersion', required: true },
    { field: 'requestedTargetSkillVersionOid', model: 'SkillVersion', required: true },
    { field: 'preMergeTargetSkillVersionOid', model: 'SkillVersion' },
    { field: 'mergedTargetSkillVersionOid', model: 'SkillVersion' },
    { field: 'rollbackTargetSkillVersionOid', model: 'SkillVersion' },
    { field: 'createdByTenantActorOid', model: 'TenantActor' },
    { field: 'mergeStartedByTenantActorOid', model: 'TenantActor' },
    { field: 'mergedByTenantActorOid', model: 'TenantActor' },
    { field: 'closedByTenantActorOid', model: 'TenantActor' },
    { field: 'rolledBackByTenantActorOid', model: 'TenantActor' }
  ],
  SkillForkSync: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'forkSkillOid', model: 'Skill', required: true },
    { field: 'upstreamSkillOid', model: 'Skill', required: true },
    { field: 'createdByTenantActorOid', model: 'TenantActor' },
    { field: 'generatedMergeRequestOid', model: 'SkillMergeRequest' }
  ],
  SkillImport: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true },
    { field: 'creatorTenantActorOid', model: 'TenantActor' }
  ],
  SkillImportItem: [
    { field: 'skillImportOid', model: 'SkillImport', required: true },
    { field: 'skillOid', model: 'Skill' }
  ],
  SkillMergeRequestItem: [
    { field: 'skillMergeRequestOid', model: 'SkillMergeRequest', required: true },
    { field: 'baseFileOid', model: 'File' },
    { field: 'sourceFileOid', model: 'File' },
    { field: 'targetFileOid', model: 'File' },
    { field: 'baseDocumentOid', model: 'Document' },
    { field: 'sourceDocumentOid', model: 'Document' },
    { field: 'targetDocumentOid', model: 'Document' },
    { field: 'baseDocumentVersionOid', model: 'DocumentVersion' },
    { field: 'sourceDocumentVersionOid', model: 'DocumentVersion' },
    { field: 'targetDocumentVersionOid', model: 'DocumentVersion' },
    { field: 'resolvedByTenantActorOid', model: 'TenantActor' }
  ],
  SkillMergeRequestComment: [
    { field: 'skillMergeRequestOid', model: 'SkillMergeRequest', required: true },
    { field: 'skillMergeRequestItemOid', model: 'SkillMergeRequestItem' },
    { field: 'inReplyToCommentOid', model: 'SkillMergeRequestComment' },
    { field: 'tenantActorOid', model: 'TenantActor', required: true }
  ],
  SkillMergeRequestEvent: [
    { field: 'skillMergeRequestOid', model: 'SkillMergeRequest', required: true },
    { field: 'tenantActorOid', model: 'TenantActor' },
    { field: 'commentOid', model: 'SkillMergeRequestComment' }
  ],
  SkillMarketplace: [
    { field: 'skillConfigurationOid', model: 'SkillConfiguration' },
    { field: 'destinationOid', model: 'SkillDestination', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  SkillMarketplacePlugin: [
    { field: 'skillConfigurationOid', model: 'SkillConfiguration' },
    { field: 'skillMarketplaceOid', model: 'SkillMarketplace', required: true },
    { field: 'skillPluginOid', model: 'SkillPlugin', required: true }
  ],
  SkillPlugin: [
    { field: 'skillConfigurationOid', model: 'SkillConfiguration' },
    { field: 'destinationOid', model: 'SkillDestination', required: true },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  SkillRepository: [
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  SkillMarketplaceRepository: [
    { field: 'skillMarketplaceOid', model: 'SkillMarketplace', required: true },
    { field: 'skillRepositoryOid', model: 'SkillRepository', required: true }
  ],
  SkillPluginRepository: [
    { field: 'skillPluginOid', model: 'SkillPlugin', required: true },
    { field: 'skillRepositoryOid', model: 'SkillRepository', required: true }
  ],
  SkillPluginSkill: [
    { field: 'skillConfigurationOid', model: 'SkillConfiguration' },
    { field: 'skillOid', model: 'Skill', required: true },
    { field: 'skillPluginOid', model: 'SkillPlugin', required: true }
  ],
  SkillDestinationItem: [
    { field: 'destinationOid', model: 'SkillDestination', required: true },
    { field: 'skillMarketplaceOid', model: 'SkillMarketplace' },
    { field: 'skillPluginOid', model: 'SkillPlugin' },
    { field: 'skillOid', model: 'Skill' }
  ],
  SkillDestinationSync: [
    { field: 'destinationOid', model: 'SkillDestination', required: true }
  ],
  SkillDestinationSyncRepositoryPropagation: [
    { field: 'skillDestinationSyncOid', model: 'SkillDestinationSync', required: true },
    { field: 'skillRepositoryOid', model: 'SkillRepository', required: true }
  ],
  SkillExportRef: [
    { field: 'skillConfigurationOid', model: 'SkillConfiguration' },
    { field: 'skillOid', model: 'Skill' },
    { field: 'managedSkillPluginOid', model: 'ManagedSkillPlugin' },
    { field: 'skillPluginOid', model: 'SkillPlugin' },
    { field: 'skillMarketplaceOid', model: 'SkillMarketplace' },
    { field: 'fileOid', model: 'File' },
    { field: 'fileReferenceOid', model: 'FileReference' },
    { field: 'fileLinkOid', model: 'FileLink' },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  SkillExport: [
    { field: 'exportRefOid', model: 'SkillExportRef', required: true },
    { field: 'fileOid', model: 'File' },
    { field: 'fileReferenceOid', model: 'FileReference' },
    { field: 'fileLinkOid', model: 'FileLink' },
    { field: 'creatorTenantActorOid', model: 'TenantActor' },
    { field: 'tenantOid', model: 'Tenant', required: true },
    { field: 'environmentOid', model: 'Environment', required: true }
  ],
  ManagedSkillPlugin: [
    { field: 'skillOid', model: 'Skill', required: true },
    { field: 'skillPluginOid', model: 'SkillPlugin', required: true }
  ]
};

let recordIdFor = (model: string, row: any) =>
  modelHasPublicId(model) ? row.id : row.oid.toString();

let targetIdentityFor = (model: string, row: any) => {
  // File purposes already exist in Metorial with different public IDs. Their
  // unique slug is the shared semantic identity across both databases.
  if (model === 'FilePurpose') return { slug: row.slug };
  return modelHasPublicId(model) ? { id: row.id } : { cargoOid: row.oid };
};

let oidCache = new Map<string, bigint | number>();

let cacheKey = (model: string, oid: bigint | number) => `${model}:${oid.toString()}`;

let resolveTargetOid = async (sourceModelName: string, sourceOid: bigint | number) => {
  let key = cacheKey(sourceModelName, sourceOid);
  let cached = oidCache.get(key);
  if (cached !== undefined) return cached;

  let sourceHasId = modelHasPublicId(sourceModelName);
  let source = await sourceDelegate(sourceModelName).findUnique({
    where: { oid: sourceOid },
    select:
      sourceModelName === 'FilePurpose'
        ? { id: true, slug: true }
        : sourceHasId
          ? { id: true }
          : { oid: true }
  });
  if (!source) return null;

  let target = await targetDelegate(targetModelName(sourceModelName)).findUnique({
    where:
      sourceModelName === 'FilePurpose'
        ? { slug: source.slug }
        : sourceHasId
          ? { id: source.id }
          : { cargoOid: source.oid },
    select: { oid: true }
  });
  if (!target) return null;

  oidCache.set(key, target.oid);
  return target.oid as bigint | number;
};

let repairDocumentContent = async (sourceOid: bigint | number) => {
  let source = await sourceDelegate('DocumentContent').findUnique({
    where: { oid: sourceOid },
    select: { oid: true, content: true }
  });
  if (!source) return null;

  let target = await targetDelegate('DocumentContent').upsert({
    where: { cargoOid: source.oid },
    create: {
      cargoOid: source.oid,
      content: source.content
    },
    update: {
      content: source.content
    },
    select: { oid: true }
  });
  oidCache.set(cacheKey('DocumentContent', sourceOid), target.oid);
  return target.oid as bigint;
};

let resourceGroupScopeCache = new Map<string, any>();

let resolveResourceGroupScope = async (
  resourceGroupOid: bigint,
  environmentOid?: bigint | null
) => {
  let key = resourceGroupOid.toString();
  let cached = resourceGroupScopeCache.get(key);
  if (cached) return cached;

  let resourceGroup = await db.resourceGroup.findUnique({
    where: { oid: resourceGroupOid },
    select: {
      instance: { select: { oid: true, organizationOid: true } },
      project: { select: { oid: true, organizationOid: true } },
      organization: { select: { oid: true } },
      user: { select: { oid: true } }
    }
  });

  let scope = {
    instance: resourceGroup?.instance ?? null,
    project: resourceGroup?.project ?? null,
    organization: resourceGroup?.organization ?? null,
    user: resourceGroup?.user ?? null
  };

  if (
    !scope.instance &&
    !scope.project &&
    !scope.organization &&
    !scope.user &&
    environmentOid != null
  ) {
    let environment = await sourceDelegate('Environment').findUnique({
      where: { oid: environmentOid },
      select: { id: true }
    });
    if (environment) {
      [scope.instance, scope.organization, scope.user] = await Promise.all([
        db.instance.findFirst({
          where: { cargoEnvironmentId: environment.id },
          select: { oid: true, organizationOid: true }
        }),
        db.organization.findFirst({
          where: { cargoEnvironmentId: environment.id },
          select: { oid: true }
        }),
        db.user.findFirst({
          where: { cargoEnvironmentId: environment.id },
          select: { oid: true }
        })
      ]);
    }
  }

  resourceGroupScopeCache.set(key, scope);
  return scope;
};

let mapRow = async (spec: CargoSyncModelSpec, row: any) => {
  let relations = modelRelations[spec.source] ?? [];
  let relationScalarFields = new Set(relations.map(relation => relation.field));
  let data: Record<string, any> = {};
  let conflicts: Record<string, unknown>[] = [];

  for (let [field, value] of Object.entries(row)) {
    if (field === 'oid') continue;
    if (relationScalarFields.has(field)) continue;
    if (field === 'organizationActorId' || field === 'consumerId') continue;
    data[field] = value;
  }

  if (!modelHasPublicId(spec.source)) data.cargoOid = row.oid;
  if (spec.source === 'Skill' && !data.name) data.name = row.id;

  let conflict = false;

  for (let relation of relations) {
    let sourceOid = row[relation.field];
    let targetField = targetFieldName(relation.field);
    if (sourceOid == null) {
      data[targetField] = null;
      continue;
    }

    let targetOid = await resolveTargetOid(relation.model, sourceOid);
    if (targetOid == null && relation.model === 'DocumentContent') {
      targetOid = await repairDocumentContent(sourceOid);
    }
    if (targetOid == null) {
      if (relation.required) {
        throw new Error(
          `Missing ${relation.model}:${sourceOid.toString()} while syncing ${spec.source}:${recordIdFor(spec.source, row)}`
        );
      }
      data[targetField] = null;
      conflict = true;
      conflicts.push({
        type: 'unresolved_relation',
        field: relation.field,
        targetModel: relation.model,
        sourceOid: sourceOid.toString()
      });
    } else {
      data[targetField] = targetOid;
    }
  }

  if (spec.source === 'TenantActor') {
    let actorLinks = await resolveResourceActorLinks(row);
    data.organizationActorOid = actorLinks.organizationActorOid;
    data.consumerOid = actorLinks.consumerOid;
    conflict ||= actorLinks.conflict;
    if (actorLinks.conflict) {
      conflicts.push({
        type: 'ambiguous_resource_actor',
        organizationActorId: row.organizationActorId ?? null,
        consumerId: row.consumerId ?? null
      });
    }
  }

  let resourceGroupScope =
    data.resourceGroupOid != null
      ? await resolveResourceGroupScope(data.resourceGroupOid, row.environmentOid)
      : null;
  if (
    resourceGroupScope &&
    !resourceGroupScope.instance &&
    !resourceGroupScope.project &&
    !resourceGroupScope.organization &&
    !resourceGroupScope.user
  ) {
    return {
      data,
      conflict: true,
      conflicts: [
        ...conflicts,
        {
          type: 'unlinked_resource_group',
          resourceGroupOid: data.resourceGroupOid.toString(),
          cargoEnvironmentOid: row.environmentOid?.toString() ?? null
        }
      ],
      skip: true
    };
  }

  let scopedLegacyModels = ['Skill', 'SkillTemplate', 'SkillMarketplace', 'SkillPlugin'];
  if (scopedLegacyModels.includes(spec.source) && resourceGroupScope) {
    let instance = resourceGroupScope.instance;
    if (instance) {
      data.instanceOid = instance.oid;
      data.organizationOid = instance.organizationOid;
    } else if (spec.source !== 'SkillTemplate') {
      return {
        data,
        conflict: true,
        conflicts: [
          ...conflicts,
          {
            type: 'invalid_resource_group_scope',
            resourceGroupOid: data.resourceGroupOid.toString(),
            cargoEnvironmentOid: row.environmentOid?.toString() ?? null,
            linkedProjectOid: resourceGroupScope.project?.oid.toString() ?? null,
            linkedOrganizationOid: resourceGroupScope.organization?.oid.toString() ?? null,
            linkedUserOid: resourceGroupScope.user?.oid.toString() ?? null,
            requiredOwner: 'instance'
          }
        ],
        skip: true
      };
    } else {
      data.organizationOid =
        resourceGroupScope.project?.organizationOid ??
        resourceGroupScope.organization?.oid ??
        null;
    }
  }

  if (spec.source === 'Skill') {
    let store = await sourceDelegate('Store').findUnique({
      where: { oid: row.storeOid },
      select: { id: true }
    });
    if (!store) throw new Error(`Missing Cargo store for skill ${row.id}`);
    data.storeId = store.id;
    data.skillEntityId = row.id;
  }

  if (spec.source === 'SkillTemplate') {
    let storeTemplate = await sourceDelegate('StoreTemplate').findUnique({
      where: { oid: row.storeTemplateOid },
      select: { id: true, name: true }
    });
    if (!storeTemplate) throw new Error(`Missing Cargo store template for ${row.id}`);
    data.status = 'active';
    data.owner = row.tenantOid == null ? 'system' : 'tenant';
    data.slug = row.systemIdentifier ?? row.id;
    data.name = storeTemplate.name;
    data.storeTemplateId = storeTemplate.id;
  }

  return { data, conflict, conflicts, skip: false };
};

let attachResourceScope = async (
  spec: CargoSyncModelSpec,
  sourceRow: any,
  targetRow: any
) => {
  if (spec.source === 'Tenant') {
    await Promise.all([
      db.user.updateMany({
        where: { cargoTenantId: sourceRow.id },
        data: { resourceTenantOid: targetRow.oid }
      }),
      db.organization.updateMany({
        where: { cargoTenantId: sourceRow.id },
        data: { resourceTenantOid: targetRow.oid }
      }),
      db.project.updateMany({
        where: { cargoTenantId: sourceRow.id },
        data: { resourceTenantOid: targetRow.oid }
      }),
      db.instance.updateMany({
        where: { cargoTenantId: sourceRow.id },
        data: { resourceTenantOid: targetRow.oid }
      })
    ]);
  }

  if (spec.source === 'Environment') {
    await Promise.all([
      db.user.updateMany({
        where: { cargoEnvironmentId: sourceRow.id },
        data: { resourceGroupOid: targetRow.oid }
      }),
      db.organization.updateMany({
        where: { cargoEnvironmentId: sourceRow.id },
        data: { resourceGroupOid: targetRow.oid }
      }),
      db.instance.updateMany({
        where: { cargoEnvironmentId: sourceRow.id },
        data: { resourceGroupOid: targetRow.oid }
      })
    ]);
  }
};

let trackRecord = async (d: {
  runId: string;
  model: string;
  recordId: string;
  targetId: string | null;
  conflict?: Record<string, unknown> | null;
}) => {
  await db.cargoSyncRecord.upsert({
    where: {
      model_recordId: {
        model: d.model,
        recordId: d.recordId
      }
    },
    create: {
      id: await ID.generateId('cargoSyncRecord'),
      model: d.model,
      recordId: d.recordId,
      targetId: d.targetId,
      lastSeenRunId: d.runId,
      conflict: d.conflict ?? null,
      conflictedAt: d.conflict ? new Date() : null
    },
    update: {
      targetId: d.targetId,
      lastSeenRunId: d.runId,
      conflict: d.conflict ?? null,
      conflictedAt: d.conflict ? new Date() : null
    }
  });
};

let upsertRow = async (runId: string, spec: CargoSyncModelSpec, row: any) => {
  let recordId = recordIdFor(spec.source, row);
  let targetName = spec.target ?? spec.source;
  let identity = targetIdentityFor(spec.source, row);

  if (await isCargoSyncRecordOwned(spec.source, recordId)) {
    let existing = await targetDelegate(targetName).findUnique({
      where: identity,
      select: { oid: true, id: modelHasPublicId(spec.source) }
    });
    if (existing) {
      oidCache.set(cacheKey(spec.source, row.oid), existing.oid);
      await trackRecord({
        runId,
        model: spec.source,
        recordId,
        targetId: existing.id ?? existing.oid.toString()
      });
    }
    return { skipped: 1, upserted: 0, conflicts: 0 };
  }

  let mapped = await mapRow(spec, row);
  let existing = await targetDelegate(targetName).findUnique({
    where: identity
  });

  if (mapped.skip) {
    if (existing) oidCache.set(cacheKey(spec.source, row.oid), existing.oid);
    await trackRecord({
      runId,
      model: spec.source,
      recordId,
      targetId: existing?.id ?? existing?.oid?.toString() ?? null,
      conflict: {
        type: 'record_skipped',
        details: mapped.conflicts
      }
    });
    return { skipped: 1, upserted: 0, conflicts: 1 };
  }

  if (
    existing &&
    ['File', 'FileLink', 'FileReference'].includes(spec.source) &&
    existing.resourceTenantOid != null &&
    mapped.data.resourceTenantOid != null &&
    existing.resourceTenantOid !== mapped.data.resourceTenantOid
  ) {
    oidCache.set(cacheKey(spec.source, row.oid), existing.oid);
    await trackRecord({
      runId,
      model: spec.source,
      recordId,
      targetId: existing.id ?? existing.oid.toString(),
      conflict: {
        type: 'resource_tenant_mismatch',
        existingResourceTenantOid: existing.resourceTenantOid.toString(),
        sourceResourceTenantOid: mapped.data.resourceTenantOid.toString()
      }
    });
    return { skipped: 1, upserted: 0, conflicts: 1 };
  }

  let updateData = { ...mapped.data };
  if (spec.source === 'FilePurpose' && existing && existing.id !== row.id) {
    // Keep the native Metorial ID when adopting an existing purpose by slug.
    // Existing files and API consumers may already refer to that public ID.
    delete updateData.id;
  }

  let targetRow = await targetDelegate(targetName).upsert({
    where: identity,
    create: mapped.data,
    update: updateData
  });

  oidCache.set(cacheKey(spec.source, row.oid), targetRow.oid);
  await attachResourceScope(spec, row, targetRow);
  await trackRecord({
    runId,
    model: spec.source,
    recordId,
    targetId: targetRow.id ?? targetRow.oid.toString(),
    conflict: mapped.conflict
      ? {
          type: 'relation_reconciliation',
          details: mapped.conflicts
        }
      : null
  });
  await claimCargoSyncRecordOwnership(spec.source, recordId);

  return {
    skipped: 0,
    upserted: 1,
    conflicts: mapped.conflict ? 1 : 0
  };
};

let syncModel = async (
  runId: string,
  spec: CargoSyncModelSpec,
  initialCursor?: string | null
) => {
  let cursor = initialCursor ? BigInt(initialCursor) : undefined;

  while (true) {
    let rows = await sourceDelegate(spec.source).findMany({
      where: cursor == null ? undefined : { oid: { gt: cursor } },
      orderBy: { oid: 'asc' },
      take: CARGO_SYNC_PAGE_SIZE
    });
    if (rows.length === 0) return;

    let upserted = 0;
    let skipped = 0;
    let conflicts = 0;
    for (let row of rows) {
      let result = await upsertRow(runId, spec, row);
      upserted += result.upserted;
      skipped += result.skipped;
      conflicts += result.conflicts;
    }

    let nextCursor = rows[rows.length - 1]!.oid as bigint;
    cursor = nextCursor;
    await db.cargoSyncRun.update({
      where: { id: runId },
      data: {
        phase: spec.phase,
        model: spec.source,
        cursor: nextCursor.toString(),
        scannedCount: { increment: rows.length },
        upsertedCount: { increment: upserted },
        skippedCount: { increment: skipped },
        conflictCount: { increment: conflicts }
      }
    });
  }
};

let reconcileRemovedRecords = async (runId: string) => {
  for (let spec of [...cargoSyncModels].reverse()) {
    let staleRecords = await db.cargoSyncRecord.findMany({
      where: {
        model: spec.source,
        lastSeenRunId: { not: runId }
      }
    });

    for (let record of staleRecords) {
      if (await isCargoSyncRecordOwned(spec.source, record.recordId)) continue;

      let hasPublicId = modelHasPublicId(spec.source);
      if (record.targetId == null) {
        await db.cargoSyncRecord.delete({ where: { id: record.id } });
        continue;
      }
      if (spec.source === 'FilePurpose' && record.targetId !== record.recordId) {
        // This target predated the sync and was adopted by its canonical slug.
        // Removing it would cascade into native Metorial files.
        await db.cargoSyncRecord.delete({ where: { id: record.id } });
        continue;
      }
      await targetDelegate(spec.target ?? spec.source).deleteMany({
        where: hasPublicId
          ? { id: record.targetId }
          : { cargoOid: BigInt(record.recordId) }
      });
      await db.cargoSyncRecord.delete({ where: { id: record.id } });
    }
  }
};

export let getCargoSyncDryRunReport = async () => {
  let models = [];

  for (let spec of cargoSyncModels) {
    let [sourceCount, trackedCount, metorialOwnedCount] = await Promise.all([
      sourceDelegate(spec.source).count(),
      db.cargoSyncRecord.count({ where: { model: spec.source } }),
      db.cargoSyncMetorialOwnedRecord.count({ where: { model: spec.source } })
    ]);

    models.push({
      source: spec.source,
      target: spec.target ?? spec.source,
      phase: spec.phase,
      sourceCount,
      trackedCount,
      metorialOwnedCount,
      pendingCount: Math.max(0, sourceCount - trackedCount),
      staleCount: Math.max(0, trackedCount - sourceCount)
    });
  }

  return {
    generatedAt: new Date(),
    models,
    totals: models.reduce(
      (totals, model) => ({
        sourceCount: totals.sourceCount + model.sourceCount,
        trackedCount: totals.trackedCount + model.trackedCount,
        metorialOwnedCount: totals.metorialOwnedCount + model.metorialOwnedCount,
        pendingCount: totals.pendingCount + model.pendingCount,
        staleCount: totals.staleCount + model.staleCount
      }),
      {
        sourceCount: 0,
        trackedCount: 0,
        metorialOwnedCount: 0,
        pendingCount: 0,
        staleCount: 0
      }
    )
  };
};

export let runCargoSync = async (runId: string) => {
  oidCache.clear();
  resourceGroupScopeCache.clear();

  let run = await db.cargoSyncRun.upsert({
    where: { id: runId },
    create: {
      id: runId,
      status: 'processing',
      startedAt: new Date()
    },
    update: {
      status: 'processing',
      error: null,
      startedAt: new Date()
    }
  });

  let startIndex = run.model
    ? Math.max(
        0,
        cargoSyncModels.findIndex(spec => spec.source === run.model)
      )
    : 0;

  try {
    for (let index = startIndex; index < cargoSyncModels.length; index++) {
      let spec = cargoSyncModels[index]!;
      await db.cargoSyncRun.update({
        where: { id: runId },
        data: {
          phase: spec.phase,
          model: spec.source,
          cursor: index === startIndex ? run.cursor : null
        }
      });
      await syncModel(runId, spec, index === startIndex ? run.cursor : null);
    }

    // Cargo contains a small number of intentional dependency cycles (for example,
    // Document.currentVersion -> DocumentVersion -> Document and
    // Skill.forkedFromSkillVersion -> SkillVersion -> Skill). Revisit those roots
    // after every model exists so optional links are not permanently left null.
    for (let source of ['Document', 'StoreTemplate', 'Skill']) {
      let spec = cargoSyncModels.find(candidate => candidate.source === source)!;
      await db.cargoSyncRun.update({
        where: { id: runId },
        data: {
          phase: spec.phase,
          model: spec.source,
          cursor: null
        }
      });
      await syncModel(runId, spec);
    }

    await reconcileRemovedRecords(runId);

    await db.cargoSyncRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        phase: null,
        model: null,
        cursor: null,
        completedAt: new Date()
      }
    });
  } catch (error) {
    await db.cargoSyncRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.stack ?? error.message : String(error)
      }
    });
    throw error;
  }
};
