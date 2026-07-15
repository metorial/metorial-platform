import { badRequestError, ServiceError } from '@lowerdeck/error';
import JSZip from 'jszip';

let maxArchiveBytes = 10 * 1024 * 1024;
let maxExtractedBytes = 30 * 1024 * 1024;
let maxExtractedFiles = 5000;
let maxRedirects = 5;

export type PublicRepositoryProvider = 'github' | 'gitlab' | 'bitbucket';

export type ParsedPublicRepository = {
  provider: PublicRepositoryProvider;
  owner: string;
  repository: string;
};

let invalidRepositoryUrl = (message: string) => new ServiceError(badRequestError({ message }));
let normalizeRepositoryName = (name: string) => name.replace(/\.git$/i, '');

export let parsePublicRepositoryUrl = (repositoryUrl: string): ParsedPublicRepository => {
  let url: URL;
  try {
    url = new URL(repositoryUrl);
  } catch {
    throw invalidRepositoryUrl('Repository URL is invalid');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw invalidRepositoryUrl(
      'Repository URL must be an HTTPS URL without credentials or a port'
    );
  }

  let segments: string[];
  try {
    segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    throw invalidRepositoryUrl('Repository URL contains invalid path encoding');
  }
  if (
    segments.some(
      segment =>
        segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')
    )
  ) {
    throw invalidRepositoryUrl('Repository URL contains an unsafe path');
  }

  if (url.hostname === 'github.com' || url.hostname === 'bitbucket.org') {
    if (segments.length !== 2) {
      throw invalidRepositoryUrl('Repository URL must identify a repository root');
    }

    let repository = normalizeRepositoryName(segments[1]!);
    if (!segments[0] || !repository)
      throw invalidRepositoryUrl('Repository URL is incomplete');

    return {
      provider: url.hostname === 'github.com' ? 'github' : 'bitbucket',
      owner: segments[0],
      repository
    };
  }

  if (url.hostname === 'gitlab.com') {
    if (segments.length < 2) {
      throw invalidRepositoryUrl('Repository URL must identify a GitLab project');
    }

    let repository = normalizeRepositoryName(segments.pop()!);
    let owner = segments.join('/');
    if (!owner || !repository) throw invalidRepositoryUrl('Repository URL is incomplete');
    return { provider: 'gitlab', owner, repository };
  }

  throw invalidRepositoryUrl(
    'Only public GitHub, GitLab, and Bitbucket repositories are supported'
  );
};

export let getPublicRepositoryArchiveUrl = (
  repository: ParsedPublicRepository,
  ref = 'HEAD'
) => {
  let encodedRef = encodeURIComponent(ref);
  if (repository.provider === 'github') {
    return `https://codeload.github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/zip/${encodedRef}`;
  }
  if (repository.provider === 'gitlab') {
    let project = encodeURIComponent(`${repository.owner}/${repository.repository}`);
    return `https://gitlab.com/api/v4/projects/${project}/repository/archive.zip?sha=${encodedRef}`;
  }
  return `https://bitbucket.org/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/get/${encodedRef}.zip`;
};

let isTrustedArchiveHost = (hostname: string) =>
  hostname === 'codeload.github.com' ||
  hostname === 'github.com' ||
  hostname === 'objects.githubusercontent.com' ||
  hostname === 'gitlab.com' ||
  hostname.endsWith('.gitlab.com') ||
  hostname === 'bitbucket.org' ||
  hostname.endsWith('.bitbucket.org') ||
  hostname === 'bbuseruploads.com' ||
  hostname.endsWith('.bbuseruploads.com');

export let fetchRepositoryArchive = async (archiveUrl: string) => {
  let url = new URL(archiveUrl);

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    if (url.protocol !== 'https:' || !isTrustedArchiveHost(url.hostname)) {
      throw invalidRepositoryUrl('Repository archive redirected to an untrusted host');
    }

    let response = await fetch(url, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      let location = response.headers.get('location');
      if (!location) throw new Error('Repository archive redirect did not include a location');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Repository download failed with status ${response.status}`);
    }

    let contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maxArchiveBytes) throw new Error('Repository archive is too large');
    if (!response.body) throw new Error('Repository archive response was empty');

    let reader = response.body.getReader();
    let chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      let { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxArchiveBytes) {
        await reader.cancel();
        throw new Error('Repository archive is too large');
      }
      chunks.push(value);
    }
    return new Uint8Array(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
  }

  throw new Error('Repository archive redirected too many times');
};

let normalizeArchivePath = (path: string) => {
  let normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  let segments = normalized.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Repository archive contains an unsafe path: ${path}`);
  }
  return segments.join('/');
};

export let extractRepositoryArchive = async (archive: Uint8Array) => {
  let zip = await JSZip.loadAsync(archive, { createFolders: false });
  let entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > maxExtractedFiles)
    throw new Error('Repository contains too many files');

  let declaredExtractedBytes = entries.reduce(
    (total, entry) =>
      total +
      Number(
        (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data
          ?.uncompressedSize ?? 0
      ),
    0
  );
  if (declaredExtractedBytes > maxExtractedBytes) {
    throw new Error('Repository expands beyond the import size limit');
  }

  let normalizedPaths = entries.map(entry =>
    normalizeArchivePath(
      (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ??
        entry.name
    )
  );
  let firstSegments = new Set(normalizedPaths.map(path => path.split('/')[0]).filter(Boolean));
  let stripWrapper = firstSegments.size === 1;
  let files: { path: string; content: Uint8Array }[] = [];
  let extractedBytes = 0;

  for (let index = 0; index < entries.length; index++) {
    let path = normalizedPaths[index]!;
    if (stripWrapper) path = path.split('/').slice(1).join('/');
    if (!path) continue;

    let content = await entries[index]!.async('uint8array');
    extractedBytes += content.byteLength;
    if (extractedBytes > maxExtractedBytes) {
      throw new Error('Repository expands beyond the import size limit');
    }
    files.push({ path: `/${path}`, content });
  }

  return files;
};
