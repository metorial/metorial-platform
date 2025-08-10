import { Service } from '@metorial/service';
import { FlagProviderParams, getFlags } from '../definitions';

class FlagServiceImpl {
  async getFlags(d: FlagProviderParams) {
    return getFlags(d);
  }
}

export let flagService = Service.create('flag', () => new FlagServiceImpl()).build();
