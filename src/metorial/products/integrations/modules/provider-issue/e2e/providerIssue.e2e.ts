import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { providerIssueRecorderService, providerIssueService } from '../src';
import { loadScope, seedSession, seedSessionError, uniqueCode } from './_fixtures';

describe('module-provider-issue', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('aggregates identical session errors into one issue', async () => {
    let scope = await loadScope(org.ids.instanceId);
    let session = await seedSession(scope);
    let code = uniqueCode();

    let first = await seedSessionError(scope, session, { code });
    let second = await seedSessionError(scope, session, { code });

    let issue = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: first.id
    });
    let again = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: second.id
    });
    expect(again?.id).toBe(issue?.id);

    let stored = await subspaceDb.providerIssue.findUniqueOrThrow({
      where: { id: issue!.id },
      include: { occurrencePeriods: true }
    });
    expect(stored).toMatchObject({
      type: 'provider_error',
      subtype: 'message_processing_timeout',
      severity: 'error',
      code,
      occurrenceCount: 2,
      providerOid: null,
      environmentOid: scope.environment.oid
    });
    expect(stored.occurrencePeriods.map(period => period.occurrenceCount)).toEqual([2]);

    let errors = await subspaceDb.sessionError.findMany({
      where: { oid: { in: [first.oid, second.oid] } }
    });
    expect(errors.map(error => error.issueOid)).toEqual([stored.oid, stored.oid]);
  });

  it('counts each session error once when recorded repeatedly', async () => {
    let scope = await loadScope(org.ids.instanceId);
    let session = await seedSession(scope);
    let error = await seedSessionError(scope, session, { code: uniqueCode() });

    let issue = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: error.id
    });
    let repeat = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: error.id
    });
    expect(repeat).toBeNull();

    let stored = await subspaceDb.providerIssue.findUniqueOrThrow({
      where: { id: issue!.id }
    });
    expect(stored.occurrenceCount).toBe(1);
  });

  it('keeps errors with different messages in separate issues', async () => {
    let scope = await loadScope(org.ids.instanceId);
    let session = await seedSession(scope);
    let code = uniqueCode();

    let a = await seedSessionError(scope, session, { code, message: 'Upstream timed out' });
    let b = await seedSessionError(scope, session, { code, message: 'Upstream refused' });

    let issueA = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: a.id
    });
    let issueB = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: b.id
    });
    expect(issueA!.id).not.toBe(issueB!.id);
  });

  it('ignores errors from internal sessions', async () => {
    let scope = await loadScope(org.ids.instanceId);
    let session = await seedSession(scope, { isInternal: true });
    let error = await seedSessionError(scope, session, { code: uniqueCode() });

    let issue = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: error.id
    });
    expect(issue).toBeNull();

    let stored = await subspaceDb.sessionError.findUniqueOrThrow({
      where: { oid: error.oid }
    });
    expect(stored.issueOid).toBeNull();
  });

  it('lists, filters and gets issues for the owning instance only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let scope = await loadScope(org.ids.instanceId);
    let session = await seedSession(scope);
    let code = uniqueCode();

    let error = await seedSessionError(scope, session, { code });
    let issue = await providerIssueRecorderService.recordSessionError({
      sessionErrorId: error.id
    });

    let bySearch = await firstPage(
      await providerIssueService.listProviderIssues({
        instance: fixture.instance,
        search: code
      })
    );
    expect(bySearch.map(item => item.id)).toEqual([issue!.id]);
    expect(bySearch[0]!.occurrencePeriods).toHaveLength(1);

    let byType = await firstPage(
      await providerIssueService.listProviderIssues({
        instance: fixture.instance,
        ids: [issue!.id],
        types: ['provider_error']
      })
    );
    expect(byType.map(item => item.id)).toEqual([issue!.id]);

    let otherType = await firstPage(
      await providerIssueService.listProviderIssues({
        instance: fixture.instance,
        ids: [issue!.id],
        types: ['auth_error', 'protoguard_warning']
      })
    );
    expect(otherType).toEqual([]);

    let fetched = await providerIssueService.getProviderIssueById({
      instance: fixture.instance,
      providerIssueId: issue!.id
    });
    expect(fetched.code).toBe(code);

    let foreign = await firstPage(
      await providerIssueService.listProviderIssues({
        instance: otherFixture.instance,
        ids: [issue!.id]
      })
    );
    expect(foreign).toEqual([]);

    await expectServiceError(
      providerIssueService.getProviderIssueById({
        instance: otherFixture.instance,
        providerIssueId: issue!.id
      }),
      'not_found'
    );
  });
});
