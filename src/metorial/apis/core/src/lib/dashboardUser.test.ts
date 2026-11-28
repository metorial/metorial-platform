import { describe, expect, it } from 'vitest';
import { isHumanDashboardUser } from './dashboardUser';

describe('isHumanDashboardUser', () => {
  it('treats a user signed in to the dashboard as a person', () => {
    expect(isHumanDashboardUser({ type: 'user' } as any)).toBe(true);
  });

  it('treats a user principal carrying machine access as no person', () => {
    expect(isHumanDashboardUser({ type: 'user', machineAccess: {} } as any)).toBe(false);
    expect(isHumanDashboardUser({ type: 'machine' } as any)).toBe(false);
  });
});
