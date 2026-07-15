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
  baseUrl.pathname = `/scm/${encodeURIComponent(repo.externalOwner)}/${encodeURIComponent(repo.externalName)}.git`;
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl.toString();
};
