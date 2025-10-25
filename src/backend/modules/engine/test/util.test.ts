import { describe, expect, it } from 'vitest';
import {
  EngineRunType,
  EngineSession,
  EngineSessionRun,
  EngineSessionType
} from '@metorial/mcp-engine-generated';
import { getEngineRunType, getEngineSessionType } from '../src/run/connection/util';

describe('getEngineSessionType', () => {
  it('should return "unknown" for UNRECOGNIZED session type', () => {
    const session = { type: EngineSessionType.UNRECOGNIZED } as EngineSession;
    expect(getEngineSessionType(session)).toBe('unknown');
  });

  it('should return "unknown" for session_type_unknown', () => {
    const session = { type: EngineSessionType.session_type_unknown } as EngineSession;
    expect(getEngineSessionType(session)).toBe('unknown');
  });

  it('should return "remote" for session_type_container', () => {
    const session = { type: EngineSessionType.session_type_container } as EngineSession;
    expect(getEngineSessionType(session)).toBe('remote');
  });

  it('should return "container" for session_type_remote', () => {
    const session = { type: EngineSessionType.session_type_remote } as EngineSession;
    expect(getEngineSessionType(session)).toBe('container');
  });

  it('should return "lambda" for session_type_lambda', () => {
    const session = { type: EngineSessionType.session_type_lambda } as EngineSession;
    expect(getEngineSessionType(session)).toBe('lambda');
  });

  it('should return "unknown" for undefined session type', () => {
    const session = { type: undefined } as any as EngineSession;
    expect(getEngineSessionType(session)).toBe('unknown');
  });

  it('should return "unknown" for invalid session type', () => {
    const session = { type: 999 } as any as EngineSession;
    expect(getEngineSessionType(session)).toBe('unknown');
  });
});

describe('getEngineRunType', () => {
  it('should return "unknown" for UNRECOGNIZED run type', () => {
    const run = { type: EngineRunType.UNRECOGNIZED } as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('unknown');
  });

  it('should return "unknown" for run_type_unknown', () => {
    const run = { type: EngineRunType.run_type_unknown } as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('unknown');
  });

  it('should return "remote" for run_type_container', () => {
    const run = { type: EngineRunType.run_type_container } as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('remote');
  });

  it('should return "container" for run_type_remote', () => {
    const run = { type: EngineRunType.run_type_remote } as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('container');
  });

  it('should return "lambda" for run_type_lambda', () => {
    const run = { type: EngineRunType.run_type_lambda } as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('lambda');
  });

  it('should return "unknown" for undefined run type', () => {
    const run = { type: undefined } as any as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('unknown');
  });

  it('should return "unknown" for invalid run type', () => {
    const run = { type: 999 } as any as EngineSessionRun;
    expect(getEngineRunType(run)).toBe('unknown');
  });
});
