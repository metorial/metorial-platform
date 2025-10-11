console.log('Loading Metorial Editor...');

declare global {
  interface Window {
    product: any;
  }
}

let queryParams = new URLSearchParams(window.location.search);
let id = queryParams.get('id');
let token = queryParams.get('token');
if (!id || !token) {
  console.error('Missing id or token in query parameters');
  throw new Error('Missing id or token in query parameters');
}

let projectName = queryParams.get('projectName') || 'Metorial Project';
let url = (import.meta as any).env.VITE_CODE_BUCKET_API_URL;

let tokenData = decodeJwtPayload(token);
let isReadOnly = tokenData.is_read_only;

window.product = {
  productConfiguration: {
    nameShort: 'Metorial Editor',
    nameLong: 'Metorial Editor',
    applicationName: 'metorial-editor',
    dataFolderName: '.vscode-web',
    version: '1.75.0',

    readonly: isReadOnly,

    // extensionsGallery: {
    //   serviceUrl: 'https://marketplace.visualstudio.com/_apis/public/gallery',
    //   itemUrl: 'https://marketplace.visualstudio.com/_apis/public/item',
    //   resourceUrlTemplate:
    //     'https://{publisher}.vscode-unpkg.net/{publisher}/{name}/{version}/{path}'
    //     This url works, but needs to be wrapped in a proxy to handle CORS
    // },
    extensionEnabledApiProposals: {
      'vscode.vscode-web': ['fileSearchProvider', 'textSearchProvider']
    }
  },
  folderUri: {
    scheme: 'memfs',
    path: `/mtbucket::${btoa(JSON.stringify({ id, token, url }))}/${projectName}`
  },
  additionalBuiltinExtensions: [
    {
      scheme: location.protocol == 'https:' ? 'https' : 'http',
      path: `${queryParams.get('extension_prefix') ?? ''}/extensions/memfs`
    }
  ]
};

let loadScript = (
  d:
    | {
        src: string;
      }
    | { code: string }
) => {
  let script = document.createElement('script');
  if ('src' in d) {
    script.src = d.src;
    document.body.appendChild(script);

    return new Promise<void>(resolve => {
      script.onload = () => resolve();
    });
  } else {
    script.textContent = d.code;
    document.body.appendChild(script);

    return Promise.resolve();
  }
};

let delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

setTimeout(async () => {
  await loadScript({ src: '/vscode/out/vs/loader.js' });
  await loadScript({ src: '/vscode/out/vs/webPackagePaths.js' });
  await loadScript({
    code: `
    Object.keys(self.webPackagePaths).forEach(function (key) {
      self.webPackagePaths[key] = \`${window.location.origin}/vscode/\${key}/\${self.webPackagePaths[key]}\`;
    });

    require.config({
      baseUrl: \`${window.location.origin}/vscode/out\`,
      recordStats: true,
      trustedTypesPolicy: window.trustedTypes?.createPolicy('amdLoader', {
        createScriptURL(value) {
          return value;
        }
      }),
      paths: self.webPackagePaths
    });
  `
  });
  await loadScript({ src: '/vscode/out/vs/workbench/workbench.web.main.nls.js' });
  await loadScript({ src: '/vscode/out/vs/workbench/workbench.web.main.js' });
  await loadScript({ src: '/vscode/out/vs/code/browser/workbench/workbench.js' });

  await delay(1000);

  let loader = document.querySelector('.loader') as HTMLDivElement;
  if (loader) {
    let text = loader.querySelector('p');
    if (text) {
      text.style.transition = 'all 0.3s ease-in-out';
      text.style.transform = 'scale(85%)';
      text.style.opacity = '0';
    }

    let img = loader.querySelector('.img_wrapper') as HTMLDivElement;
    if (img) {
      img.style.transition = 'all 0.3s ease-in-out';
      img.style.transform = 'scale(0%)';
      img.style.opacity = '0';
    }

    loader.style.transition = 'opacity 0.5s ease-in-out';
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';

    setTimeout(() => {
      loader.remove();
    }, 500);
  }
}, 100);

function decodeJwtPayload(token: string) {
  if (!token || typeof token !== 'string') return null;

  let parts = token.split('.');
  if (parts.length !== 3) {
    console.error('Invalid JWT format.');
    return null;
  }
  let base64Payload = parts[1];

  base64Payload = base64Payload.replace(/-/g, '+').replace(/_/g, '/');

  while (base64Payload.length % 4) base64Payload += '=';

  try {
    let jsonString = atob(base64Payload);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to decode or parse JWT payload:', e);
    return null;
  }
}
