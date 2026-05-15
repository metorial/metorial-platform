import type {
  StoreTemplateRecord,
  StoreTemplateSummaryRecord,
  StoreTemplateWithScopedStoreId
} from '@metorial-cargo/module-store';

let presentStoreTemplateEncoding = (encoding?: 'utf_8' | 'base64' | null) =>
  encoding === 'utf_8' ? 'utf-8' : (encoding ?? undefined);

export let storeTemplatePresenter = (
  storeTemplate:
    | StoreTemplateWithScopedStoreId<StoreTemplateSummaryRecord>
    | StoreTemplateWithScopedStoreId<StoreTemplateRecord>
) => ({
  object: 'cargo#storeTemplate',
  id: storeTemplate.id,
  name: storeTemplate.name,
  type: storeTemplate.type,
  tenantId: storeTemplate.tenant?.id ?? undefined,
  environmentId: storeTemplate.environment?.id ?? undefined,
  storeId: storeTemplate.storeId ?? storeTemplate.sourceStore?.id ?? undefined,
  sourceStoreId: storeTemplate.sourceStore?.id ?? undefined,
  itemCount: storeTemplate.items.length,
  createdAt: storeTemplate.createdAt,
  updatedAt: storeTemplate.updatedAt
});

export let storeTemplateDetailPresenter = (
  storeTemplate: StoreTemplateWithScopedStoreId<StoreTemplateRecord>
) => ({
  ...storeTemplatePresenter(storeTemplate),
  items: storeTemplate.items.map(item => ({
    id: item.id,
    type: item.kind,
    path: item.path,
    content: item.content ?? undefined,
    encoding: presentStoreTemplateEncoding(item.encoding),
    title: item.title ?? undefined
  }))
});
