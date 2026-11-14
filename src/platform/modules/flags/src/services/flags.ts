import { Service } from '@lowerdeck/service';
import { db, type Instance, type Organization, type Project } from '@metorial/db';
import { BooleanFlagKey, FlagProviderParams, getFlags, isFlagEnabled } from '../definitions';

class FlagServiceImpl {
  async getFlags(d: FlagProviderParams) {
    return getFlags(d);
  }

  async isFlagEnabledForScope(d: {
    organization: Organization;
    project?: Project;
    flag: BooleanFlagKey;
  }) {
    let flags = await this.getFlags({
      organization: d.organization,
      project: d.project
    });

    return isFlagEnabled(flags[d.flag]);
  }

  async isFlagEnabledForInstance(d: {
    instance: Pick<Instance, 'oid'>;
    flag: BooleanFlagKey;
  }) {
    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.instance.oid },
      include: { organization: true, project: true }
    });

    return this.isFlagEnabledForScope({
      organization: instance.organization,
      project: instance.project,
      flag: d.flag
    });
  }
}

export let flagService = Service.create('flag', () => new FlagServiceImpl()).build();
