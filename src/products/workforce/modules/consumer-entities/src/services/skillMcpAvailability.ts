import { Service } from '@lowerdeck/service';
import { skillResourceLimits } from '@metorial-subspace/module-connection';
import type { Instance, Project, StoreParticipantPermissions } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  type SkillRecord,
  type SkillSnapshotLimit,
  skillFileService
} from '@metorial/module-skill';
import { isExcludedSkillPath } from '../lib/skillCatalogNames';

export type SkillMcpAvailability = {
  available: boolean;
  exceededLimits: SkillSnapshotLimit[];
  fileCount: number;
  size: number;
  maxFileCount: number;
  maxSize: number;
};

class SkillMcpAvailabilityServiceImpl {
  async getSkillMcpAvailability(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }): Promise<SkillMcpAvailability> {
    let usage = await skillFileService.getSkillSnapshotUsage({
      ...d,
      options: {
        includePath: path => !isExcludedSkillPath(path),
        limits: skillResourceLimits
      }
    });

    return {
      available: usage.exceededLimits.length == 0,
      exceededLimits: usage.exceededLimits,
      fileCount: usage.fileCount,
      size: usage.size,
      maxFileCount: skillResourceLimits.maxFiles,
      maxSize: skillResourceLimits.maxBytes
    };
  }
}

export let skillMcpAvailabilityService = Service.create(
  'skillMcpAvailabilityService',
  () => new SkillMcpAvailabilityServiceImpl()
).build();
