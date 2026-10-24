import {
  createRemoteProvider,
  defaultMcpTestTools,
  eventually,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import {
  protoGuardConfigService,
  protoGuardSuppressionService
} from '@metorial-subspace/module-monitor';
import { describe, expect, it } from 'vitest';
import { activeRuleset } from '../src/definitions/rulesets';
import { protoGuardToolScanService } from '../src/internal/toolScan';
import {
  callTool,
  injection,
  largeOutputChars,
  openSession,
  poisonedTool,
  readArchiveTool,
  readNotesTool,
  scopeOf,
  sleep,
  waitForRun
} from './_fixtures';

let TENANT_CONFIG_CACHE_WAIT_MS = 11_000;
let NO_RUN_WAIT_MS = 8_000;

let contentFragments = ['Ignore all previous', 'system prompt', 'Meeting notes'];

describe('module-protoguard pipeline', () => {
  let server = useMcpTestServer({
    tools: [...defaultMcpTestTools, readNotesTool, readArchiveTool, poisonedTool]
  });

  describe('retention', () => {
    let org = useOrganization();
    let remote = useFixture(() =>
      createRemoteProvider(org.clients.instance, { url: server.url })
    );

    it('detects an injection without storing content when retention is none', async () => {
      let opened = await openSession(org, remote.providerId, { retentionLevel: 'none' });
      let { message } = await callTool(opened, 'read_notes');

      expect(message.retentionLevel).toBe('none');
      expect(message.output).toBeNull();

      let run = await waitForRun(message.oid, { alert: true });
      expect(run).toMatchObject({ status: 'completed', retentionLevel: 'none' });
      expect(run.alert).not.toBeNull();
      expect(run.findings.length).toBeGreaterThan(0);

      for (let finding of run.findings) {
        expect(finding.matchedText).toBeNull();
        expect(finding.contentHmac).toMatch(/^[0-9a-f]{64}$/);
      }

      let stored = JSON.stringify({
        findings: run.findings.map(finding => ({ ...finding, oid: String(finding.oid) })),
        sample: run.alert!.sampleMarkdown
      });
      for (let fragment of contentFragments) expect(stored).not.toContain(fragment);
    }, 300_000);

    it('keeps the matched text when retention is full', async () => {
      let opened = await openSession(org, remote.providerId);
      let { message } = await callTool(opened, 'read_notes');

      let run = await waitForRun(message.oid, { alert: true });
      expect(run.retentionLevel).toBe('full');
      expect(run.findings.some(finding => finding.matchedText?.length)).toBe(true);
      expect(run.alert!.sampleMarkdown).toContain('<mark>');
    }, 300_000);
  });

  describe('enable flag', () => {
    let org = useOrganization();
    let remote = useFixture(() =>
      createRemoteProvider(org.clients.instance, { url: server.url })
    );

    it('skips analysis while ProtoGuard is off and resumes once it is back on', async () => {
      let scope = await scopeOf(org);
      let opened = await openSession(org, remote.providerId);

      await protoGuardConfigService.updateTenantSettings({
        instance: scope.instance,
        auditScope: scope.auditScope,
        input: { enabled: false }
      });
      await sleep(TENANT_CONFIG_CACHE_WAIT_MS);

      let disabled = await callTool(opened, 'read_notes');
      await sleep(NO_RUN_WAIT_MS);
      expect(
        await subspaceDb.protoGuardRun.findUnique({
          where: { messageOid: disabled.message.oid }
        })
      ).toBeNull();

      await protoGuardConfigService.updateTenantSettings({
        instance: scope.instance,
        auditScope: scope.auditScope,
        input: { enabled: true }
      });
      await sleep(TENANT_CONFIG_CACHE_WAIT_MS);

      let enabled = await callTool(opened, 'read_notes');
      let run = await waitForRun(enabled.message.oid, { alert: true });
      expect(run.alert).not.toBeNull();
    }, 300_000);
  });

  describe('suppressions', () => {
    let org = useOrganization();
    let remote = useFixture(() =>
      createRemoteProvider(org.clients.instance, { url: server.url })
    );

    it('stores suppressed findings but raises no alert for them', async () => {
      let scope = await scopeOf(org);
      let opened = await openSession(org, remote.providerId);

      let first = await callTool(opened, 'read_notes');
      let firstRun = await waitForRun(first.message.oid, { alert: true });
      expect(firstRun.alert).not.toBeNull();

      let activeFindings = firstRun.findings.filter(finding => finding.stage == 'active');
      let pairs = new Map(
        activeFindings.map(finding => [
          `${finding.filter.key}:${finding.contentHmac}`,
          { filterId: finding.filter.id, contentHmac: finding.contentHmac! }
        ])
      );

      for (let pair of pairs.values()) {
        await protoGuardSuppressionService.createSuppression({
          instance: scope.instance,
          auditScope: scope.auditScope,
          input: { ...pair, reason: 'Known test fixture' }
        });
      }

      let second = await callTool(opened, 'read_notes');
      let secondRun = await waitForRun(second.message.oid);

      expect(secondRun.alert).toBeNull();
      expect(secondRun.triggeredFilterCount).toBe(0);
      expect(
        secondRun.findings
          .filter(finding => finding.stage == 'active')
          .every(finding => finding.isSuppressed)
      ).toBe(true);

      let firstAlert = await subspaceDb.protoGuardAlert.findUniqueOrThrow({
        where: { oid: firstRun.alert!.oid }
      });
      expect(firstAlert.occurrenceCount).toBe(1);
    }, 300_000);
  });

  describe('large payloads', () => {
    let org = useOrganization();
    let remote = useFixture(() =>
      createRemoteProvider(org.clients.instance, { url: server.url })
    );

    it('scans a multi-megabyte tool output without failing the message', async () => {
      let opened = await openSession(org, remote.providerId);
      let { call, message } = await callTool(opened, 'read_archive');

      expect(call.result.content[0].text.startsWith(injection)).toBe(true);
      expect(message.status).toBe('succeeded');

      let run = await waitForRun(message.oid, { alert: true });
      expect(run.totalChars).toBeGreaterThan(largeOutputChars);
      expect(run.coverage).not.toBe('skipped');
      expect(run.alert).not.toBeNull();
      expect(run.findings.map(finding => finding.filter.key)).toEqual(
        expect.arrayContaining(['instruction_override'])
      );
    }, 300_000);
  });

  describe('tool definitions', () => {
    let org = useOrganization();
    let remote = useFixture(() =>
      createRemoteProvider(org.clients.instance, { url: server.url })
    );

    it('flags a poisoned tool definition and leaves clean tools alone', async () => {
      await openSession(org, remote.providerId);

      let provider = await subspaceDb.provider.findUniqueOrThrow({
        where: { id: remote.providerId }
      });
      let tools = await eventually(
        async () => {
          let rows = await subspaceDb.providerTool.findMany({
            where: { providerOid: provider.oid, name: { in: ['fetch_weather', 'add'] } }
          });
          expect(rows.map(row => row.name).sort()).toEqual(['add', 'fetch_weather']);
          return rows;
        },
        { timeoutMs: 60_000, intervalMs: 500 }
      );

      let poisoned = tools.find(tool => tool.name == 'fetch_weather')!;
      let clean = tools.find(tool => tool.name == 'add')!;

      let poisonedScan = await protoGuardToolScanService.scanProviderTool({
        providerToolOid: poisoned.oid
      });
      expect(poisonedScan).toMatchObject({
        status: 'completed',
        isFlagged: true,
        rulesetVersion: activeRuleset.version
      });
      expect(poisonedScan!.findings.map(finding => finding.family)).toContain(
        'tool_poisoning'
      );

      let cleanScan = await protoGuardToolScanService.scanProviderTool({
        providerToolOid: clean.oid
      });
      expect(cleanScan).toMatchObject({ isFlagged: false, findings: [] });

      let rescanned = await protoGuardToolScanService.scanProviderTool({
        providerToolOid: poisoned.oid
      });
      expect(rescanned!.id).toBe(poisonedScan!.id);
    }, 300_000);
  });
});
