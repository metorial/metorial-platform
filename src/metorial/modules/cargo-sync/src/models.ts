export type CargoSyncModelSpec = {
  source: string;
  target?: string;
  phase: string;
};

export let cargoSyncModels: CargoSyncModelSpec[] = [
  { source: 'Tenant', target: 'ResourceTenant', phase: 'scope' },
  { source: 'Environment', target: 'ResourceGroup', phase: 'scope' },
  { source: 'TenantActor', target: 'ResourceActor', phase: 'scope' },
  { source: 'FilePurpose', phase: 'file' },
  { source: 'DocumentContent', phase: 'content' },
  { source: 'File', phase: 'file' },
  { source: 'FileLink', phase: 'file' },
  { source: 'FileReference', phase: 'file' },
  { source: 'Document', phase: 'content' },
  { source: 'DocumentVersion', phase: 'content' },
  { source: 'DocumentParticipant', phase: 'content' },
  { source: 'DocumentVersionEditors', phase: 'content' },
  { source: 'StoreTemplate', phase: 'store' },
  { source: 'StoreTemplateItem', phase: 'store' },
  { source: 'Store', phase: 'store' },
  { source: 'StoreDirectory', phase: 'store' },
  { source: 'StoreItem', phase: 'store' },
  { source: 'StoreTemplateBacking', phase: 'store' },
  { source: 'StoreVersion', phase: 'store' },
  { source: 'StoreVersionItem', phase: 'store' },
  { source: 'StoreParticipant', phase: 'store' },
  { source: 'SkillConfiguration', phase: 'skill' },
  { source: 'SkillTemplate', phase: 'skill' },
  { source: 'Skill', phase: 'skill' },
  { source: 'SkillAgent', phase: 'skill' },
  { source: 'SkillVersion', phase: 'skill' },
  { source: 'SkillParticipant', phase: 'skill' },
  { source: 'SkillDestination', phase: 'distribution' },
  { source: 'SkillMarketplace', phase: 'distribution' },
  { source: 'SkillPlugin', phase: 'distribution' },
  { source: 'SkillMarketplacePlugin', phase: 'distribution' },
  { source: 'SkillPluginSkill', phase: 'distribution' },
  { source: 'ManagedSkillPlugin', phase: 'distribution' },
  { source: 'SkillRepository', phase: 'distribution' },
  { source: 'SkillMarketplaceRepository', phase: 'distribution' },
  { source: 'SkillPluginRepository', phase: 'distribution' },
  { source: 'SkillDestinationItem', phase: 'distribution' },
  { source: 'SkillDestinationSync', phase: 'distribution' },
  {
    source: 'SkillDestinationSyncRepositoryPropagation',
    phase: 'distribution'
  },
  { source: 'SkillMergeRequest', phase: 'workflow' },
  { source: 'SkillForkSync', phase: 'workflow' },
  { source: 'SkillMergeRequestItem', phase: 'workflow' },
  { source: 'SkillMergeRequestComment', phase: 'workflow' },
  { source: 'SkillMergeRequestEvent', phase: 'workflow' },
  { source: 'SkillImport', phase: 'workflow' },
  { source: 'SkillImportItem', phase: 'workflow' },
  { source: 'SkillExportRef', phase: 'export' },
  { source: 'SkillExport', phase: 'export' }
];
