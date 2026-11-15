import { checkEdition, perEdition } from '@metorial/editions';

export let trustedDomains = perEdition({
  cloud: ['cloud.example.com'],
  'on-prem': ['on-prem.example.com']
});

export let runEdition = async () => {
  if (checkEdition('cloud')) {
    let { chargeCustomer } = await import('@fixture/cloud-only');
    console.log(chargeCustomer());
  }

  if (checkEdition('on-prem')) {
    let { readLicense } = await import('@fixture/on-prem-only');
    console.log(readLicense());
  }

  console.log(trustedDomains.join(','));
};
