import { describe, expect, it } from 'vitest';
import {
  buildUnavailableCallbackInstanceCombinations,
  buildCallbackTriggerUpdateInput,
  hasPendingCallbackReconciliation,
  shouldShowManualWebhookSetup
} from './overviewLogic';

describe('callback instance attachment availability', () => {
  it('maps attached config-only and authenticated instances to unavailable combinations', () => {
    expect(
      buildUnavailableCallbackInstanceCombinations([
        {
          status: 'attached',
          config: { id: 'pcf_without_auth' },
          authConfig: null
        },
        {
          status: 'attached',
          config: { id: 'pcf_with_auth' },
          authConfig: { id: 'pac_authorized' }
        },
        {
          status: 'detached',
          config: { id: 'pcf_detached' },
          authConfig: null
        }
      ])
    ).toEqual([
      { providerConfigId: 'pcf_without_auth', providerAuthConfigId: null },
      { providerConfigId: 'pcf_with_auth', providerAuthConfigId: 'pac_authorized' }
    ]);
  });
});

describe('callback registration reconciliation', () => {
  let readyTrigger = {
    source: 'webhook' as const,
    registrationStatus: 'registered',
    nextPollAt: null
  };

  it('ignores detached instances during callback-wide reconciliation', () => {
    expect(
      hasPendingCallbackReconciliation({
        expectedTriggerCount: 1,
        instances: [
          {
            id: 'cbi_detached',
            status: 'detached',
            triggers: []
          },
          {
            id: 'cbi_attached',
            status: 'attached',
            triggers: [readyTrigger]
          }
        ]
      })
    ).toBe(false);
  });

  it('keeps a targeted attach pending until the instance exists and is ready', () => {
    expect(
      hasPendingCallbackReconciliation({
        expectedTriggerCount: 1,
        callbackInstanceId: 'cbi_target',
        instances: []
      })
    ).toBe(true);
    expect(
      hasPendingCallbackReconciliation({
        expectedTriggerCount: 1,
        callbackInstanceId: 'cbi_target',
        instances: [
          {
            id: 'cbi_target',
            status: 'detached',
            triggers: []
          }
        ]
      })
    ).toBe(true);
    expect(
      hasPendingCallbackReconciliation({
        expectedTriggerCount: 1,
        callbackInstanceId: 'cbi_target',
        instances: [
          {
            id: 'cbi_target',
            status: 'attached',
            triggers: [readyTrigger]
          }
        ]
      })
    ).toBe(false);
  });

  it('waits for matching trigger counts and non-transitional trigger state', () => {
    let base = {
      expectedTriggerCount: 1,
      instances: [
        {
          id: 'cbi_attached',
          status: 'attached' as const,
          triggers: [] as (typeof readyTrigger)[]
        }
      ]
    };

    expect(hasPendingCallbackReconciliation(base)).toBe(true);
    expect(
      hasPendingCallbackReconciliation({
        ...base,
        instances: [
          {
            ...base.instances[0],
            triggers: [{ ...readyTrigger, registrationStatus: 'registering' }]
          }
        ]
      })
    ).toBe(true);
    expect(
      hasPendingCallbackReconciliation({
        ...base,
        instances: [
          {
            ...base.instances[0],
            triggers: [readyTrigger]
          }
        ]
      })
    ).toBe(false);
  });
});

describe('callback overview trigger updates', () => {
  it('preserves existing event types when trigger selection is saved unchanged', () => {
    let result = buildCallbackTriggerUpdateInput(
      ['issues.updated', 'issues.created'],
      [
        {
          providerTrigger: { key: 'issues.updated' },
          eventTypes: ['issue.closed', 'issue.reopened']
        },
        {
          providerTrigger: { key: 'issues.created' },
          eventTypes: ['issue.created']
        }
      ]
    );

    expect(result).toEqual([
      {
        triggerId: 'issues.updated',
        eventTypes: ['issue.closed', 'issue.reopened']
      },
      {
        triggerId: 'issues.created',
        eventTypes: ['issue.created']
      }
    ]);
  });

  it('uses explicit event-type edits and normalizes empty or duplicate entries', () => {
    let result = buildCallbackTriggerUpdateInput(
      ['issues.updated'],
      [
        {
          providerTrigger: { key: 'issues.updated' },
          eventTypes: ['old.event']
        }
      ],
      {
        'issues.updated': [' issue.closed ', '', 'issue.closed', 'issue.reopened']
      }
    );

    expect(result).toEqual([
      {
        triggerId: 'issues.updated',
        eventTypes: ['issue.closed', 'issue.reopened']
      }
    ]);
  });
});

describe('callback overview registration state', () => {
  it('uses authoritative registration status for manual setup visibility', () => {
    let registeredInstanceWithConflictingLegacyState = {
      webhookUrl: 'https://example.test/callback',
      registrationStatus: 'registered' as const,
      isWebhookRegistered: false
    };
    let unregisteredInstanceWithConflictingLegacyState = {
      webhookUrl: 'https://example.test/callback',
      registrationStatus: 'unregistered' as const,
      isWebhookRegistered: true
    };

    expect(shouldShowManualWebhookSetup([registeredInstanceWithConflictingLegacyState])).toBe(
      false
    );
    expect(
      shouldShowManualWebhookSetup([unregisteredInstanceWithConflictingLegacyState])
    ).toBe(true);
  });
});
