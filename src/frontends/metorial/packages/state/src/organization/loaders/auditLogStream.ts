import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let auditLogStreamsLoader = createLoader({
  name: 'auditLogStreams',
  fetch: (i: { organizationId: string; before?: string; after?: string }) =>
    withAuth(sdk =>
      sdk.auditLogStreams.list(i.organizationId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {
    create: (
      i: {
        provider: 'datadog' | 'splunk';
        providerData: Record<string, any>;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.auditLogStreams.create(organizationId, {
          provider: i.provider,
          providerData: i.providerData
        })
      )
  }
});

export let useAuditLogStreams = (organizationId: string | null | undefined) => {
  let streams = usePaginator(cursor =>
    auditLogStreamsLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...streams,
    createMutator: streams.useMutator('create')
  };
};

export let auditLogStreamLoader = createLoader({
  name: 'auditLogStream',
  parents: [auditLogStreamsLoader],
  fetch: (i: { organizationId: string; auditLogStreamId: string }) =>
    withAuth(sdk => sdk.auditLogStreams.get(i.organizationId, i.auditLogStreamId)),
  mutators: {
    update: (
      i: {
        provider?: 'datadog' | 'splunk';
        providerData?: Record<string, any>;
        status?: 'active' | 'inactive';
      },
      { input: { organizationId, auditLogStreamId } }
    ) =>
      withAuth(sdk =>
        sdk.auditLogStreams.update(organizationId, auditLogStreamId, {
          provider: i.provider,
          providerData: i.providerData,
          status: i.status
        })
      ),

    resume: (_: {}, { input: { organizationId, auditLogStreamId } }) =>
      withAuth(sdk => sdk.auditLogStreams.resume(organizationId, auditLogStreamId)),

    delete: (_: {}, { input: { organizationId, auditLogStreamId } }) =>
      withAuth(sdk => sdk.auditLogStreams.delete(organizationId, auditLogStreamId))
  }
});

export let useAuditLogStream = (
  organizationId: string | null | undefined,
  auditLogStreamId: string | null | undefined
) => {
  let stream = auditLogStreamLoader.use(
    organizationId && auditLogStreamId ? { organizationId, auditLogStreamId } : null
  );

  return {
    ...stream,
    updateMutator: stream.useMutator('update'),
    resumeMutator: stream.useMutator('resume'),
    deleteMutator: stream.useMutator('delete')
  };
};

export let auditLogStreamEventsLoader = createLoader({
  name: 'auditLogStreamEvents',
  parents: [auditLogStreamLoader],
  fetch: (i: {
    organizationId: string;
    auditLogStreamId: string;
    before?: string;
    after?: string;
  }) =>
    withAuth(sdk =>
      sdk.auditLogStreams.events.list(i.organizationId, i.auditLogStreamId, {
        before: i.before,
        after: i.after,
        limit: 100
      })
    ),
  mutators: {}
});

export let useAuditLogStreamEvents = (
  organizationId: string | null | undefined,
  auditLogStreamId: string | null | undefined
) => {
  return usePaginator(cursor =>
    auditLogStreamEventsLoader.use(
      organizationId && auditLogStreamId
        ? { organizationId, auditLogStreamId, ...cursor }
        : null
    )
  );
};
