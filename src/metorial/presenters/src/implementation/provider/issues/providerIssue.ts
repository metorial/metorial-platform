import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerIssueType } from '../../../types';

export let v1ProviderIssuePresenter = Presenter.create(providerIssueType)
  .presenter(async ({ providerIssue }) => ({
    object: 'provider.issue' as const,

    id: providerIssue.id,
    type: providerIssue.type,
    subtype: providerIssue.subtype,
    severity: providerIssue.severity,

    code: providerIssue.code,
    message: providerIssue.message,

    provider_id: providerIssue.provider?.id ?? null,
    protoguard_filter_id: providerIssue.protoGuardFilter?.id ?? null,

    occurrence_count: providerIssue.occurrenceCount,
    daily_occurrences: providerIssue.occurrencePeriods.map(period => ({
      starts_at: period.startsAt,
      ends_at: period.endsAt,
      count: period.occurrenceCount
    })),

    first_seen_at: providerIssue.firstSeenAt,
    last_seen_at: providerIssue.lastSeenAt,
    created_at: providerIssue.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.issue', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique provider issue identifier',
        examples: ['pis_9kLmNpQrStUvWxYz']
      }),
      type: v.enumOf(['provider_error', 'auth_error', 'protoguard_warning'], {
        name: 'type',
        description:
          'Where the issue comes from: a failed provider or tool call, a provider authentication failure, or a ProtoGuard detection on session traffic'
      }),
      subtype: v.string({
        name: 'subtype',
        description:
          'The more specific kind within the type: the error type for provider and auth errors, the filter key for ProtoGuard warnings',
        examples: ['message_processing_provider_error']
      }),
      severity: v.enumOf(['warning', 'error', 'critical'], {
        name: 'severity',
        description: 'How severe the issue is'
      }),
      code: v.string({
        name: 'code',
        description: 'Error code, or the ProtoGuard issue type for ProtoGuard warnings',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Human-readable summary of the issue',
        examples: ['Connection timed out']
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'The provider the issue occurred on, if known',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      protoguard_filter_id: v.nullable(
        v.string({
          name: 'protoguard_filter_id',
          description: 'The ProtoGuard filter that raised the warning, for ProtoGuard warnings'
        })
      ),
      occurrence_count: v.number({
        name: 'occurrence_count',
        description: 'Total number of times the issue occurred',
        examples: [12]
      }),
      daily_occurrences: v.array(
        v.object({
          starts_at: v.date({ name: 'starts_at', description: 'Start of the day' }),
          ends_at: v.date({ name: 'ends_at', description: 'End of the day' }),
          count: v.number({
            name: 'count',
            description: 'Occurrences during the day',
            examples: [3]
          })
        }),
        {
          name: 'daily_occurrences',
          description:
            'Occurrences per day over the last 30 days, for days with any occurrence'
        }
      ),
      first_seen_at: v.date({
        name: 'first_seen_at',
        description: 'When the issue first occurred',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      last_seen_at: v.date({
        name: 'last_seen_at',
        description: 'When the issue most recently occurred',
        examples: [new Date('2025-09-16T08:12:00Z')]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
