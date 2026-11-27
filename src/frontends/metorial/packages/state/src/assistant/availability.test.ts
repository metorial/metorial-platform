import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  useCurrentOrganization: vi.fn(),
  useDashboardFlags: vi.fn()
}));

vi.mock('../organization/current', () => ({
  useCurrentOrganization: mocks.useCurrentOrganization
}));

vi.mock('../organization/loaders/flags', () => ({
  useDashboardFlags: mocks.useDashboardFlags
}));

import { useAiAvailable, useMetorialAssistantEnabled } from './availability';

let aiFlags = (value: boolean | undefined) => ({
  data: value === undefined ? null : { flags: { 'ai-available': value } }
});

describe('assistant UI availability', () => {
  it.each([
    [null, false],
    [{ currentProject: null }, false],
    [{ currentProject: {} }, false],
    [{ currentProject: { assistantEnabled: false } }, false],
    [{ currentProject: { assistantEnabled: true } }, true]
  ])('requires an explicitly enabled, loaded project (%j)', (data, enabled) => {
    mocks.useCurrentOrganization.mockReturnValue({ data });
    mocks.useDashboardFlags.mockReturnValue(aiFlags(true));

    expect(useMetorialAssistantEnabled()).toBe(enabled);
  });

  it.each([
    [undefined, false],
    [false, false],
    [true, true]
  ])('requires the ai-available flag (%s)', (value, enabled) => {
    mocks.useCurrentOrganization.mockReturnValue({
      data: { currentProject: { assistantEnabled: true } }
    });
    mocks.useDashboardFlags.mockReturnValue(aiFlags(value));

    expect(useAiAvailable()).toBe(enabled);
    expect(useMetorialAssistantEnabled()).toBe(enabled);
  });
});
