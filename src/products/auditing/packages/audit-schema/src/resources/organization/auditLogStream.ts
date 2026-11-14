import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let auditLogStreamResource = resource({
  name: 'audit_log_stream',
  payload: v.typedAny<{
    id: string;
    provider: string;
    status: string;
    accessStatus: string;
    isPausedDueToError: boolean;
    errorMessage: string | null;
    consecutiveErrorCount: number;
    isStarted: boolean;
    providerDataRedacted: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>('audit_log_stream'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true,
    pause: true,
    resume: true
  }
});
