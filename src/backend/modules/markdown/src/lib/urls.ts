export let joinUrls = (baseUrl: string, ...paths: (string | undefined)[]) => {
  let currentUrl = baseUrl;

  for (const path of paths) {
    if (!path) continue; // Skip undefined or empty paths

    // If the path is an absolute URL, replace the current URL entirely
    if (isAbsoluteUrl(path)) {
      currentUrl = path;
    } else if (path.startsWith('#')) {
      // If the path is a fragment, append it to the current URL
      currentUrl += path;
    } else {
      // Join the current URL with the relative path
      currentUrl = joinPath(currentUrl, path);
    }
  }

  return currentUrl;
};

export let isAbsoluteUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export let isRelativeUrl = (url: string) =>
  url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('#');

export let joinPath = (baseUrl: string, path: string) => {
  let url = new URL(baseUrl);
  let basePathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
  let finalPathSegments = basePathSegments;

  let newPathSegments = path.split('/').filter(segment => segment.length > 0);

  for (let segment of newPathSegments) {
    if (segment === '..') {
      finalPathSegments.pop();
    } else if (segment !== '.') {
      finalPathSegments.push(segment);
    }
  }

  return `${url.origin}/${finalPathSegments.join('/')}${url.search}${url.hash}`;
};
