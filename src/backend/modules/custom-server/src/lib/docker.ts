interface DockerTag {
  name: string;
  last_updated?: string;
}

interface DockerHubResponse {
  results: DockerTag[];
}

interface GenericRegistryResponse {
  tags?: string[];
  name?: string;
}

export let getLatestDockerTag = async (repository: string): Promise<string | null> => {
  try {
    let { registry, imagePath } = parseRepository(repository);

    if (registry === 'docker.io' || registry === 'hub.docker.com') {
      let tag = await fetchDockerHubLatest(imagePath);
      if (!tag) return null;
      let digest = await getTagDigest(registry, imagePath, tag);
      return digest;
    }

    let tag = await fetchGenericRegistryLatest(registry, imagePath);
    if (!tag) return null;

    let digest = await getTagDigest(registry, imagePath, tag);
    return digest;
  } catch (error) {
    console.error('Error fetching latest tag:', error);
    return null;
  }
};

export let checkDockerTag = async (repository: string, tag: string): Promise<boolean> => {
  try {
    let { registry, imagePath } = parseRepository(repository);

    if (registry === 'docker.io' || registry === 'hub.docker.com') {
      return await checkDockerHubTag(imagePath, tag);
    }

    return await checkGenericRegistryTag(registry, imagePath, tag);
  } catch (error) {
    console.error('Error checking tag:', error);
    return false;
  }
};

let parseRepository = (repository: string) => {
  let registry = 'docker.io';
  let imagePath = repository;

  let parts = repository.split('/');
  let first = parts[0];

  if (first.includes('.')) {
    registry = first;
    imagePath = parts.slice(1).join('/');
  }

  return { registry, imagePath };
};

let fetchDockerHubLatest = async (imagePath: string): Promise<string | null> => {
  if (!imagePath.includes('/')) {
    imagePath = `library/${imagePath}`;
  }

  let url = `https://hub.docker.com/v2/repositories/${imagePath}/tags?page_size=100&ordering=-last_updated`;
  let response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Docker Hub API error: ${response.status} ${response.statusText}`);
  }

  let data: DockerHubResponse = await response.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }

  let filtered = data.results.filter(t => t.name !== 'latest');
  let selected = filtered.length > 0 ? filtered[0] : data.results[0];

  return selected.name;
};

let checkDockerHubTag = async (imagePath: string, tag: string): Promise<boolean> => {
  if (!imagePath.includes('/')) {
    imagePath = `library/${imagePath}`;
  }

  let url = `https://hub.docker.com/v2/repositories/${imagePath}/tags/${tag}`;
  let response = await fetch(url);

  return response.ok;
};

let fetchGenericRegistryLatest = async (
  registry: string,
  imagePath: string
): Promise<string | null> => {
  let url = `https://${registry}/v2/${imagePath}/tags/list`;
  let response = await fetch(url);

  if (response.status === 401) {
    let token = await getRegistryToken(response, registry, imagePath);
    if (!token) {
      throw new Error('Registry authentication failed');
    }

    let authResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      throw new Error(`Registry API error: ${authResponse.status} ${authResponse.statusText}`);
    }

    let data: GenericRegistryResponse = await authResponse.json();
    return pickLatestTag(data.tags);
  }

  if (!response.ok) {
    throw new Error(`Registry API error: ${response.status} ${response.statusText}`);
  }

  let data: GenericRegistryResponse = await response.json();
  return pickLatestTag(data.tags);
};

let checkGenericRegistryTag = async (
  registry: string,
  imagePath: string,
  tag: string
): Promise<boolean> => {
  let url = `https://${registry}/v2/${imagePath}/tags/list`;
  let response = await fetch(url);

  if (response.status === 401) {
    let token = await getRegistryToken(response, registry, imagePath);
    if (!token) return false;

    let authResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) return false;

    let data: GenericRegistryResponse = await authResponse.json();
    return Array.isArray(data.tags) && data.tags.includes(tag);
  }

  if (!response.ok) return false;

  let data: GenericRegistryResponse = await response.json();
  return Array.isArray(data.tags) && data.tags.includes(tag);
};

let pickLatestTag = (tags?: string[] | null): string | null => {
  if (!tags || tags.length === 0) {
    return null;
  }

  let noLatest = tags.filter(t => t !== 'latest');
  if (noLatest.length === 0) {
    return null;
  }

  let archSuffix = /-(arm64|amd64|armv7|armhf|ppc64le|s390x)$/;

  let baseTags = noLatest.filter(t => !archSuffix.test(t));
  let archTags = noLatest.filter(t => archSuffix.test(t));

  if (baseTags.length > 0) {
    baseTags.sort();
    return baseTags[baseTags.length - 1];
  }

  archTags.sort();
  return archTags[archTags.length - 1];
};

let getTagDigest = async (
  registry: string,
  imagePath: string,
  tag: string
): Promise<string | null> => {
  let url = `https://${registry}/v2/${imagePath}/manifests/${tag}`;

  let acceptHeader =
    'application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';

  let response = await fetch(url, {
    headers: { Accept: acceptHeader }
  });

  if (response.status === 401) {
    let token = await getRegistryToken(response, registry, imagePath);
    if (!token) return null;

    response = await fetch(url, {
      headers: {
        Accept: acceptHeader,
        Authorization: `Bearer ${token}`
      }
    });
  }

  if (!response.ok) {
    return null;
  }

  let digest = response.headers.get('docker-content-digest');
  return digest;
};

let getRegistryToken = async (
  response: Response,
  registry: string,
  imagePath: string
): Promise<string | null> => {
  let header = response.headers.get('www-authenticate');
  if (!header) return null;

  let realmMatch = /realm="([^"]+)"/.exec(header);
  let serviceMatch = /service="([^"]+)"/.exec(header);
  let scopeMatch = /scope="([^"]+)"/.exec(header);

  let realm = realmMatch ? realmMatch[1] : null;
  let service = serviceMatch ? serviceMatch[1] : `registry.${registry}`;
  let scope = scopeMatch ? scopeMatch[1] : `repository:${imagePath}:pull`;

  if (!realm) return null;

  let tokenUrl = `${realm}?service=${encodeURIComponent(service)}&scope=${encodeURIComponent(scope)}`;
  let tokenResponse = await fetch(tokenUrl);

  if (!tokenResponse.ok) {
    return null;
  }

  let data = await tokenResponse.json();
  return data.token || data.access_token || null;
};
