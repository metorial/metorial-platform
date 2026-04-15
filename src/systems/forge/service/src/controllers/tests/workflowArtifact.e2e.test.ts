import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowArtifactType } from '../../../prisma/generated/client';
import { forgeClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

vi.mock('../../providers', () => ({
  startBuildQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));

vi.mock('../../storage', () => ({
  storage: {
    putObject: vi.fn().mockResolvedValue({ storageKey: 'test-key' }),
    getObject: vi.fn().mockResolvedValue({ data: Buffer.from('') }),
    getPublicURL: vi.fn().mockResolvedValue({ url: 'http://example.com/artifact' }),
    upsertBucket: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('workflowArtifact:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns artifacts for a specific workflow', async () => {
    const run1 = await f.workflowRun.succeeded();
    const run2 = await f.workflowRun.succeeded();

    const artifacts = await Promise.all(
      times(2, (i: number) =>
        f.workflowArtifact.output({
          workflowOid: run1.workflow.oid,
          runOid: run1.oid,
          overrides: { name: `artifact-${i + 1}.zip` }
        })
      )
    );

    const otherArtifact = await f.workflowArtifact.output({
      workflowOid: run2.workflow.oid,
      runOid: run2.oid,
      overrides: { name: 'other-artifact.zip' }
    });

    const result = await forgeClient.workflowArtifact.list({
      tenantId: run1.workflow.tenant.id,
      workflowId: run1.workflow.id,
      limit: 10
    });

    const artifactIds = artifacts.map(artifact => artifact.id);
    expect(result.items).toHaveLength(2);
    result.items.forEach(item => {
      expect(artifactIds).toContain(item.id);
    });
    expect(result.items.map(item => item.id)).not.toContain(otherArtifact.id);
  });
});

describe('workflowArtifact:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns an artifact by ID with signed URL', async () => {
    const run = await f.workflowRun.succeeded();
    const artifact = await f.workflowArtifact.output({
      workflowOid: run.workflow.oid,
      runOid: run.oid,
      overrides: { name: 'output.zip' }
    });

    const result = await forgeClient.workflowArtifact.get({
      tenantId: run.workflow.tenant.id,
      workflowId: run.workflow.id,
      workflowArtifactId: artifact.id
    });

    expect(result).toMatchObject({
      id: artifact.id,
      name: 'output.zip',
      type: WorkflowArtifactType.output,
      runId: run.id,
      workflowId: run.workflow.id,
      url: expect.objectContaining({
        url: expect.any(String)
      }),
      createdAt: expect.any(Date)
    });
  });

  it('returns input artifacts', async () => {
    const run = await f.workflowRun.succeeded();
    const artifact = await f.workflowArtifact.input({
      workflowOid: run.workflow.oid,
      runOid: run.oid
    });

    const result = await forgeClient.workflowArtifact.get({
      tenantId: run.workflow.tenant.id,
      workflowId: run.workflow.id,
      workflowArtifactId: artifact.id
    });

    expect(result).toMatchObject({
      type: WorkflowArtifactType.input,
      name: 'input.zip'
    });
  });
});
