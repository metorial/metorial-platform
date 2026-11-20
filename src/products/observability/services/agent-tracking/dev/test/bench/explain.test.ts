import { describe, expect, it } from 'vitest';
import { createStore } from '@mtsrc/agent-tracking-store';
import { readExplain, sessionListIndexes } from '../../src/bench/explain';

describe('explain reader', () => {
  it('reads a MongoDB plan with a blocking sort', () => {
    let result = readExplain('mongo', {
      queryPlanner: {
        winningPlan: {
          stage: 'LIMIT',
          inputStage: {
            stage: 'SORT',
            inputStage: {
              stage: 'FETCH',
              inputStage: { stage: 'IXSCAN', indexName: 'organizationId_1_startedAt_-1' }
            }
          }
        },
        rejectedPlans: [{ stage: 'IXSCAN', indexName: 'rejected_index' }]
      },
      executionStats: {
        nReturned: 26,
        executionTimeMillis: 40,
        totalKeysExamined: 5_000,
        totalDocsExamined: 5_000,
        executionStages: { stage: 'LIMIT' }
      }
    });

    expect(result).toMatchObject({
      indexes: ['organizationId_1_startedAt_-1'],
      blockingSort: true,
      collectionScan: false,
      keysExamined: 5_000,
      docsExamined: 5_000,
      returned: 26,
      timeMs: 40
    });
  });

  it('reads a DocumentDB plan that walks the list index in order', () => {
    let result = readExplain('docdb', {
      queryPlanner: {
        winningPlan: {
          stage: 'SUBSCAN',
          inputStage: {
            stage: 'LIMIT_SKIP',
            inputStage: {
              stage: 'IXSCAN',
              indexName: 'organizationId_1_instanceId_1_lastActivityAt_-1__id_-1'
            }
          }
        }
      },
      executionStats: {
        nReturned: '26',
        executionTimeMillisEstimate: 1.2,
        executionStages: {
          stage: 'SUBSCAN',
          nReturned: '26',
          inputStage: { stage: 'IXSCAN', nReturned: '26' }
        }
      }
    });

    expect(result.indexes).toEqual(['organizationId_1_instanceId_1_lastActivityAt_-1__id_-1']);
    expect(result.blockingSort).toBe(false);
    expect(result.timeMs).toBe(1.2);
    expect(result.returned).toBe(26);
    expect(result.keysExamined).toBeNull();
    expect(result.stages).toEqual(['SUBSCAN', 'LIMIT_SKIP', 'IXSCAN']);
  });

  it('flags collection scans', () => {
    expect(
      readExplain('scan', { queryPlanner: { winningPlan: { stage: 'COLLSCAN' } } })
        .collectionScan
    ).toBe(true);
  });

  it('finds the session-list indexes on the store schema', () => {
    let store = createStore('mongodb://127.0.0.1:1/unconnected');

    expect(sessionListIndexes(store).map(index => Object.keys(index.keys))).toEqual([
      ['organizationId', 'lastActivityAt', '_id'],
      ['organizationId', 'instanceId', 'lastActivityAt', '_id'],
      ['organizationId', 'observed.userId', 'lastActivityAt', '_id']
    ]);
  });
});
