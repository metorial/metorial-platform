import { zipSync } from 'fflate';

export let packSandboxDockerfile = async (text: string, path: string) => {
  let name = path.replace(/^\.\//, '');
  if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..'))
    throw new Error('Dockerfile Path must be a relative path without parent segments.');

  if (!text.trim()) throw new Error('The Dockerfile must not be empty.');

  let contents = new TextEncoder().encode(text);
  let archive = zipSync({ [name]: contents });

  return new File([new Uint8Array(archive)], 'build-context.zip', {
    type: 'application/zip'
  });
};
