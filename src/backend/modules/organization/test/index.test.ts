import { describe, it, expect, vi } from 'vitest';

// Mock all the services to avoid loading actual implementations
vi.mock('../src/services/instance', () => ({
  instanceService: { name: 'instanceService' }
}));
vi.mock('../src/services/organization', () => ({
  organizationService: { name: 'organizationService' }
}));
vi.mock('../src/services/organizationActor', () => ({
  organizationActorService: { name: 'organizationActorService' }
}));
vi.mock('../src/services/organizationInvite', () => ({
  organizationInviteService: { name: 'organizationInviteService' }
}));
vi.mock('../src/services/organizationInviteJoin', () => ({
  organizationInviteJoinService: { name: 'organizationInviteJoinService' }
}));
vi.mock('../src/services/organizationMember', () => ({
  organizationMemberService: { name: 'organizationMemberService' }
}));
vi.mock('../src/services/project', () => ({
  projectService: { name: 'projectService' }
}));

import * as exports from '../src/services/index';

describe('Services Index', () => {
  describe('exports', () => {
    it('should export instanceService', () => {
      expect(exports).toHaveProperty('instanceService');
      expect(exports.instanceService).toBeDefined();
    });

    it('should export organizationService', () => {
      expect(exports).toHaveProperty('organizationService');
      expect(exports.organizationService).toBeDefined();
    });

    it('should export organizationActorService', () => {
      expect(exports).toHaveProperty('organizationActorService');
      expect(exports.organizationActorService).toBeDefined();
    });

    it('should export organizationInviteService', () => {
      expect(exports).toHaveProperty('organizationInviteService');
      expect(exports.organizationInviteService).toBeDefined();
    });

    it('should export organizationInviteJoinService', () => {
      expect(exports).toHaveProperty('organizationInviteJoinService');
      expect(exports.organizationInviteJoinService).toBeDefined();
    });

    it('should export organizationMemberService', () => {
      expect(exports).toHaveProperty('organizationMemberService');
      expect(exports.organizationMemberService).toBeDefined();
    });

    it('should export projectService', () => {
      expect(exports).toHaveProperty('projectService');
      expect(exports.projectService).toBeDefined();
    });

    it('should export all services', () => {
      let expectedExports = [
        'instanceService',
        'organizationService',
        'organizationActorService',
        'organizationInviteService',
        'organizationInviteJoinService',
        'organizationMemberService',
        'projectService'
      ];

      expectedExports.forEach(exportName => {
        expect(exports).toHaveProperty(exportName);
        expect(exports[exportName as keyof typeof exports]).toBeDefined();
      });
    });
  });
});
