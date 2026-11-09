import { checkEdition } from '@metorial/editions';
import { ScmPolicyError } from '../../lib/scmPolicy';

type BitbucketRepository = {
  externalName: string;
  externalOwner: string;
  externalUrl: string;
  installation: {
    externalAccountLogin: string;
    backend: {
      type: string;
      apiUrl: string;
      webUrl: string;
    };
  };
};

export let getBitbucketCloneUrl = (repo: BitbucketRepository) => {
  let externalUrl = new URL(repo.externalUrl);
  let providerUrl = new URL(repo.installation.backend.webUrl);
  if (
    checkEdition('on-prem') &&
    externalUrl.hostname.toLowerCase().replace(/\.$/, '') !==
      providerUrl.hostname.toLowerCase().replace(/\.$/, '')
  ) {
    throw new ScmPolicyError(
      'The repository clone URL must use its configured provider domain.'
    );
  }
  if (
    externalUrl.protocol === 'https:' &&
    !externalUrl.username &&
    !externalUrl.password &&
    externalUrl.pathname.endsWith('.git')
  ) {
    return externalUrl.toString();
  }

  let baseUrl = new URL(repo.installation.backend.webUrl);
  baseUrl.username = '';
  baseUrl.password = '';
  baseUrl.pathname = `${checkEdition('on-prem') ? baseUrl.pathname.replace(/\/$/, '') : ''}/scm/${encodeURIComponent(repo.externalOwner)}/${encodeURIComponent(repo.externalName)}.git`;
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl.toString();
};
