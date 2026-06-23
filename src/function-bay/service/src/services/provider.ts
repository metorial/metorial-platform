import { Service } from '@lowerdeck/service';
import { defaultProvider } from '../providers';

class providerServiceImpl {
  async getDefaultProvider() {
    return defaultProvider.provider;
  }
}

export let providerService = Service.create(
  'providerService',
  () => new providerServiceImpl()
).build();
