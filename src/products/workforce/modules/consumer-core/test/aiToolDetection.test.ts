import { describe, expect, it } from 'vitest';
import {
  detectionObservedAt,
  deviceMonitor,
  diffDetections,
  normalizeFindings,
  type DetectionFinding
} from '../src/lib/aiToolDetection';

let finding = (
  toolKey: string,
  overrides: Partial<DetectionFinding> = {}
): DetectionFinding => ({
  toolKey,
  state: 'installed',
  confidence: 'medium',
  signalKinds: ['config_dir'],
  version: null,
  ...overrides
});

let at = (iso: string) => new Date(iso);

describe('normalizeFindings', () => {
  it('drops tools the catalog does not know', () => {
    let normalized = normalizeFindings([finding('cursor'), finding('not-a-real-tool')]);

    expect(normalized.map(entry => entry.toolKey)).toEqual(['cursor']);
  });

  it('merges a tool listed twice into its strongest finding', () => {
    let normalized = normalizeFindings([
      finding('codex', { signalKinds: ['process', 'path'], version: '0.40.0' }),
      finding('codex', { state: 'running', confidence: 'high', signalKinds: ['path', 'app'] })
    ]);

    expect(normalized).toEqual([
      {
        toolKey: 'codex',
        state: 'running',
        confidence: 'high',
        signalKinds: ['app', 'path', 'process'],
        version: '0.40.0'
      }
    ]);
  });

  it('sorts by tool key', () => {
    let normalized = normalizeFindings([finding('ollama'), finding('claude-code')]);

    expect(normalized.map(entry => entry.toolKey)).toEqual(['claude-code', 'ollama']);
  });
});

describe('diffDetections', () => {
  let existing = [
    { oid: 1n, toolKey: 'cursor', goneAt: null },
    { oid: 2n, toolKey: 'codex', goneAt: at('2026-11-01T00:00:00Z') },
    { oid: 3n, toolKey: 'ollama', goneAt: null },
    { oid: 4n, toolKey: 'aider', goneAt: at('2026-11-01T00:00:00Z') }
  ];

  it('creates new tools, updates known ones and marks missing ones gone', () => {
    let diff = diffDetections({
      existing,
      findings: [finding('cursor'), finding('codex'), finding('claude-code')]
    });

    expect(diff.created.map(entry => entry.toolKey)).toEqual(['claude-code']);
    expect(diff.updated.map(entry => entry.detection.oid)).toEqual([1n, 2n]);
    expect(diff.gone.map(entry => entry.oid)).toEqual([3n]);
  });

  it('reports returned tools as added and leaves tools already gone alone', () => {
    let diff = diffDetections({
      existing,
      findings: [finding('cursor'), finding('codex'), finding('claude-code')]
    });

    expect(diff.added).toEqual(['claude-code', 'codex']);
    expect(diff.removed).toEqual(['ollama']);
  });

  it('changes nothing when the same snapshot is reported again', () => {
    let diff = diffDetections({ existing, findings: [finding('cursor'), finding('ollama')] });

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.created).toEqual([]);
  });

  it('marks every present tool gone for an empty snapshot', () => {
    let diff = diffDetections({ existing, findings: [] });

    expect(diff.removed).toEqual(['cursor', 'ollama']);
  });
});

describe('detectionObservedAt', () => {
  let now = at('2026-11-22T12:00:00Z');

  it('dates a report when the device generated it', () => {
    expect(
      detectionObservedAt({
        generatedAt: at('2026-11-22T09:00:00Z'),
        previousObservedAt: at('2026-11-21T09:00:00Z'),
        now
      })
    ).toEqual(at('2026-11-22T09:00:00Z'));
  });

  it('never dates a report in the future or before the previous one', () => {
    expect(
      detectionObservedAt({
        generatedAt: at('2027-01-01T00:00:00Z'),
        previousObservedAt: null,
        now
      })
    ).toEqual(now);
    expect(
      detectionObservedAt({
        generatedAt: at('2020-01-01T00:00:00Z'),
        previousObservedAt: at('2026-11-21T09:00:00Z'),
        now
      })
    ).toEqual(at('2026-11-21T09:00:00Z'));
  });

  it('never dates a report more than a week back', () => {
    expect(
      detectionObservedAt({
        generatedAt: at('2020-01-01T00:00:00Z'),
        previousObservedAt: null,
        now
      })
    ).toEqual(at('2026-11-15T12:00:00Z'));
  });
});

describe('deviceMonitor', () => {
  it('carries the catalog version and the collection intervals', () => {
    let monitor = deviceMonitor({ aiToolDetection: true });

    expect(monitor.aiToolDetection).toBe(true);
    expect(monitor.catalogVersion).toMatch(/^[0-9a-f]{16}$/);
    expect(monitor.intervals.report).toBe(86400);
  });
});
