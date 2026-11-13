import type { Project, Organization } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { v1ProjectPresenter } from './project';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

describe('project assistant availability', () => {
  it.each([
    [true, false, true],
    [false, false, false],
    [true, true, false],
    [false, true, false]
  ])(
    'applies the preference %s and Reduced Subprocessors %s',
    async (assistantEnabled, reducedSubprocessors, expectedAvailability) => {
      let project = {
        id: 'prj_test',
        name: 'Test',
        slug: 'test',
        status: 'active',
        assistantEnabled,
        reducedSubprocessors,
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: { id: 'org_test' }
      } as Project & { organization: Organization };

      let result = await v1ProjectPresenter.present({ project }, context).run();

      expect(result.assistant_enabled).toBe(expectedAvailability);
    }
  );
});
