import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowVersionStepType } from '../../../prisma/generated/client';
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

describe('workflowVersion:create E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new workflow version with steps', async () => {
    const workflow = await f.workflow.withTenant();

    const result = await forgeClient.workflowVersion.create({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id,
      name: 'Version 1.0',
      steps: [
        {
          name: 'Build Step',
          type: WorkflowVersionStepType.script,
          initScript: ['echo "initializing"'],
          actionScript: ['npm install', 'npm run build'],
          cleanupScript: ['echo "cleaning up"']
        },
        {
          name: 'Upload Output',
          type: WorkflowVersionStepType.upload_artifact,
          artifactSourcePath: './dist',
          artifactName: 'build-output'
        }
      ]
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      name: 'Version 1.0',
      workflowId: workflow.id,
      createdAt: expect.any(Date)
    });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({
      name: 'Build Step',
      type: WorkflowVersionStepType.script,
      initScript: ['echo "initializing"'],
      actionScript: ['npm install', 'npm run build'],
      cleanupScript: ['echo "cleaning up"']
    });
    expect(result.steps[1]).toMatchObject({
      name: 'Upload Output',
      type: WorkflowVersionStepType.upload_artifact,
      artifactSourcePath: './dist',
      artifactName: 'build-output'
    });
  });
});

describe('workflowVersion:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns workflow versions for a workflow', async () => {
    const version1 = await f.workflowVersion.withWorkflow();
    const workflow = version1.workflow;

    // Create additional versions
    const additionalVersions = await Promise.all(
      times(2, () =>
        f.workflowVersion.default({
          workflowOid: workflow.oid,
          providerOid: workflow.provider.oid,
          overrides: { isCurrent: false }
        })
      )
    );
    const versions = [version1, ...additionalVersions];

    const versionIds = versions.map(v => v.id);
    const otherVersion = await f.workflowVersion.withWorkflow();

    const result = await forgeClient.workflowVersion.list({
      tenantId: workflow.tenant.id,
      workflowId: workflow.id,
      limit: 10
    });

    expect(result.items).toHaveLength(3);
    result.items.forEach(item => {
      expect(versionIds).toContain(item.id);
    });
    expect(result.items.map(item => item.id)).not.toContain(otherVersion.id);
  });
});

describe('workflowVersion:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a workflow version by ID', async () => {
    const version = await f.workflowVersion.complete();

    const result = await forgeClient.workflowVersion.get({
      tenantId: version.workflow.tenant.id,
      workflowId: version.workflow.id,
      workflowVersionId: version.id
    });

    expect(result).toMatchObject({
      id: version.id,
      identifier: version.identifier,
      name: version.name,
      workflowId: version.workflow.id
    });
    expect(result.steps).toBeInstanceOf(Array);
  });
});
