import { generatePlainId } from '@mtsrc/id';
import type {
  ContainerRepositoryTag,
  ContainerRepositoryVersion,
  Server
} from '../../../prisma/generated/client';

export let versionIdentifier = {
  docker: ({
    server,
    repositoryTag,
    repositoryVersion
  }: {
    server: Server;
    repositoryTag: ContainerRepositoryTag;
    repositoryVersion: ContainerRepositoryVersion;
  }) => `sver::${server.id}::${server.type}::${repositoryTag.id}::${repositoryVersion.id}`,

  remote: ({ server }: { server: Server }) =>
    `sver::${server.id}::${server.type}::${generatePlainId(20)}`,

  function: ({ server }: { server: Server }) =>
    `sver::${server.id}::${server.type}::${generatePlainId(20)}`
};
