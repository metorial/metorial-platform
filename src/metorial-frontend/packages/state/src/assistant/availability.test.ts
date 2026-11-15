import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ useCurrentOrganization: vi.fn() }));

vi.mock('../organization/current', () => ({
  useCurrentOrganization: mocks.useCurrentOrganization
}));

import { useMetorialAssistantEnabled } from './availability';

describe('assistant UI availability', () => {
  it.each([
    [null, false],
    [{ currentProject: null }, false],
    [{ currentProject: {} }, false],
    [{ currentProject: { assistantEnabled: false } }, false],
    [{ currentProject: { assistantEnabled: true } }, true]
  ])('requires an explicitly enabled, loaded project (%j)', (data, enabled) => {
    mocks.useCurrentOrganization.mockReturnValue({ data });

    expect(useMetorialAssistantEnabled()).toBe(enabled);
  });
});
