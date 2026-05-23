import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { cargo, type CargoSkillConfiguration } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

type SkillConfigurationAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

type SkillConfigurationInput = {
  allowScripts?: boolean;
  allowedFileExtensions?: string[] | null;
  allowNonStandardDirectories?: boolean;
};

class SkillConfigurationServiceImpl {
  async createSkillConfiguration(
    d: SkillConfigurationAccessInput & {
      input: SkillConfigurationInput & {
        isInternal?: boolean;
      };
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      allowScripts: d.input.allowScripts,
      allowedFileExtensions: d.input.allowedFileExtensions,
      allowNonStandardDirectories: d.input.allowNonStandardDirectories,
      isInternal: d.input.isInternal
    });
  }

  async listSkillConfigurations(d: SkillConfigurationAccessInput) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillConfiguration.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillConfigurationById(
    d: SkillConfigurationAccessInput & {
      skillConfigurationId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillConfigurationId: d.skillConfigurationId
    });
  }

  async getManySkillConfigurations(
    d: SkillConfigurationAccessInput & {
      skillConfigurationIds: string[];
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.getMany({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillConfigurationIds: d.skillConfigurationIds
    });
  }

  async updateSkillConfiguration(
    d: SkillConfigurationAccessInput & {
      skillConfiguration: CargoSkillConfiguration;
      input: SkillConfigurationInput;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillConfigurationId: d.skillConfiguration.id,
      allowScripts: d.input.allowScripts,
      allowedFileExtensions: d.input.allowedFileExtensions,
      allowNonStandardDirectories: d.input.allowNonStandardDirectories
    });
  }

  async updateSkillConfigurationById(
    d: SkillConfigurationAccessInput & {
      skillConfigurationId: string;
      input: SkillConfigurationInput;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillConfigurationId: d.skillConfigurationId,
      allowScripts: d.input.allowScripts,
      allowedFileExtensions: d.input.allowedFileExtensions,
      allowNonStandardDirectories: d.input.allowNonStandardDirectories
    });
  }

  async deleteSkillConfiguration(
    d: SkillConfigurationAccessInput & {
      skillConfiguration: CargoSkillConfiguration;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillConfiguration.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillConfigurationId: d.skillConfiguration.id
    });
  }
}

export type { CargoSkillConfiguration };

export let skillConfigurationService = Service.create(
  'fileSkillConfiguration',
  () => new SkillConfigurationServiceImpl()
).build();
