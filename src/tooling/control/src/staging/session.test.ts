import { afterEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createWorkspaceSession,
  destroyWorkspaceSession,
  getActiveSession,
  isStagingEnabled
} from './session';

describe('workspace session', () => {
  afterEach(async () => {
    await destroyWorkspaceSession();
  });

  it('respects CONTROL_NO_STAGE', () => {
    process.env.CONTROL_NO_STAGE = '1';
    expect(isStagingEnabled()).toBe(false);
    delete process.env.CONTROL_NO_STAGE;
    expect(isStagingEnabled()).toBe(true);
  });

  it('respects noStage option', () => {
    expect(isStagingEnabled({ noStage: true })).toBe(false);
  });
});

describe('getActiveSession', () => {
  afterEach(async () => {
    await destroyWorkspaceSession();
  });

  it('returns null when no session is active', () => {
    expect(getActiveSession()).toBeNull();
  });
});
