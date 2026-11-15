import { mongodb, postgres } from '../resources';

export let sharedDatabases = {
  metorialEnterprise: postgres({
    package: '@metorial/db',
    name: 'metorial-enterprise',
    env: 'DATABASE_URL'
  }),
  metorialEnterpriseGlobal: postgres({
    package: '@metorial/multi-region',
    name: 'metorial-enterprise-global',
    env: 'GLOBAL_DATABASE_URL'
  }),
  subspace: postgres({
    package: '@metorial-subspace/db',
    name: 'subspace',
    env: 'SUBSPACE_DATABASE_URL'
  }),
  metorialOss: postgres({
    package: '@metorial/db',
    name: 'metorial-oss',
    env: 'DATABASE_URL'
  }),
  metorialEnterpriseFederation: postgres({
    package: '@metorial-subspace/db',
    name: 'metorial-enterprise-federation',
    env: 'FEDERATION_CORE_DATABASE_URL'
  }),
  metorialOssGlobal: postgres({
    package: '@metorial/multi-region',
    name: 'metorial-oss-global',
    env: 'GLOBAL_DATABASE_URL'
  }),
  metorialEnterpriseFederationFederationData: postgres({
    package: '@metorial-enterprise/federation-data',
    name: 'metorial-enterprise-federation',
    env: 'FEDERATION_CORE_DATABASE_URL'
  }),
  metorialEnterprisePayment: postgres({
    package: '@metorial-enterprise/federation-payment',
    name: 'metorial-enterprise-payment',
    env: 'PAYMENT_DATABASE_URL'
  })
};
