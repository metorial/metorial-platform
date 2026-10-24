export let { Bash, InMemoryFs, MountableFs } =
  require('just-bash') as typeof import('just-bash');

export type Bash = import('just-bash').Bash;
export type InMemoryFs = import('just-bash').InMemoryFs;
export type MountableFs = import('just-bash').MountableFs;
export type IFileSystem = import('just-bash').IFileSystem;
export type InitialFiles = import('just-bash').InitialFiles;
