import { describe, expect, it } from 'vitest';
import { adminProviderTelemetryErrorGroupPresenter } from './adminProviderTelemetryErrorGroup';

describe('adminProviderTelemetryErrorGroupPresenter', () => {
  it('presents the admin table row shape', () => {
    let from = new Date('2026-06-11T00:00:00.000Z');
    let to = new Date('2026-06-18T00:00:00.000Z');
    let createdAt = new Date('2026-06-18T00:00:00.000Z');

    expect(
      adminProviderTelemetryErrorGroupPresenter({
        id: 'serg_1',
        type: 'message_processing_provider_error',
        code: 'provider_error',
        message: 'Message serg_1',
        hash: 'hash-serg_1',
        occurrenceCount: 3,
        provider: {
          id: 'prv_1',
          name: 'Slack',
          slug: 'slack'
        },
        tenant: {
          id: 'ten_1'
        },
        environment: {
          id: 'ken_1'
        },
        firstOccurrence: {
          id: 'serr_1',
          session: { id: 'ses_1' },
          providerRun: { id: 'prun_1' }
        },
        sessionErrorGroupOccurrencePeriods: [
          {
            startsAt: from,
            endsAt: to,
            occurrenceCount: 2
          }
        ],
        createdAt
      } as any)
    ).toEqual({
      object: 'admin.provider_error_group',
      id: 'serg_1',
      type: 'message_processing_provider_error',
      code: 'provider_error',
      message: 'Message serg_1',
      hash: 'hash-serg_1',
      occurrence_count: 3,
      provider: {
        id: 'prv_1',
        name: 'Slack',
        slug: 'slack'
      },
      first_occurrence_id: 'serr_1',
      first_session_id: 'ses_1',
      first_provider_run_id: 'prun_1',
      tenant_id: 'ten_1',
      environment_id: 'ken_1',
      periods: [
        {
          starts_at: from,
          ends_at: to,
          occurrence_count: 2
        }
      ],
      created_at: createdAt
    });
  });
});
