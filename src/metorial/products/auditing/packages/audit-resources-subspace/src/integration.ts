import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export let integrationAuditResource = resource({
  name: 'integration',
  payload: v.typedAny<{
    id: string;
    status: string;
    slug: string;
    name: string;
    description: string | null;
    isMagicMcpBacking: boolean;
    canAttachCustomToolFilters: boolean;
    canAttachCustomProviderConfig: boolean;
    canOverrideToolFilters: boolean;
    currentVersionId: string | null;
    currentVersionIndex: number;
    archivedAt: Date | null;
  }>('integration'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let integrationInstanceAuditResource = resource({
  name: 'integration_instance',
  payload: v.typedAny<{
    id: string;
    status: string;
    name: string;
    description: string | null;
    isMagicMcpBacking: boolean;
    integration: { id: string; name: string };
    identityId: string | null;
    identityActorId: string | null;
    archivedAt: Date | null;
  }>('integration_instance'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
