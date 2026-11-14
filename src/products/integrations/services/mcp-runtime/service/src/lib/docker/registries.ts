export const DEFAULT_REGISTRY_URL = 'registry-1.docker.io';

export let urlMapper = {
  'docker.com': 'registry-1.docker.io',
  'docker.io': 'registry-1.docker.io',
  'hub.docker.com': 'registry-1.docker.io',
  'hub.docker.io': 'registry-1.docker.io',
  'registry.docker.io': 'registry-1.docker.io',
  'registry.docker.com': 'registry-1.docker.io'
};

export let getRegistryName = (registry: string) => {
  if (registry == 'registry-1.docker.io') return 'Docker Hub';
  if (registry == 'ghcr.io') return 'GitHub Container Registry';
  if (registry == 'gcr.io' || registry.endsWith('.gcr.io')) return 'Google Container Registry';
  if (registry == 'mcr.microsoft.com' || registry.endsWith('.mcr.microsoft.com'))
    return 'Microsoft Container Registry';
  if (registry == 'registry.gitlab.com') return 'GitLab Container Registry';
  if (registry == 'quay.io') return 'Quay.io';
  if (registry.endsWith('azurecr.io')) return 'Azure Container Registry';
  if (registry.endsWith('ecr.aws')) return 'Amazon ECR Public';
  if (registry.endsWith('.amazonaws.com')) return 'Amazon ECR';
  return registry;
};

export let normalizeRegistryUrl = (inputUrl: string) => {
  if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
    inputUrl = `https://${inputUrl}`;
  }

  let parsed = new URL(inputUrl);
  let host = parsed.host.toLowerCase();

  if (host in urlMapper) {
    host = urlMapper[host as keyof typeof urlMapper];
  }

  return host;
};
