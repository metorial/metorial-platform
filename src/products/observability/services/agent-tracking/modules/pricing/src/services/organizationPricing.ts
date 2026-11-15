import { Service } from '@lowerdeck/service';
import { expireOverrideCheck, getOrganizationPricing, resetOverrideCache } from '../lib/cache';

class OrganizationPricingServiceImpl {
  async getOrganizationPricing(d: { organizationId: string }) {
    return await getOrganizationPricing(d.organizationId);
  }

  expire(d: { organizationId: string }) {
    expireOverrideCheck(d.organizationId);
  }

  reset() {
    resetOverrideCache();
  }
}

export let organizationPricingService = Service.create(
  'organizationPricingService',
  () => new OrganizationPricingServiceImpl()
).build();
