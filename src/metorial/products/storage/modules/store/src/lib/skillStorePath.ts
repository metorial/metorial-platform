import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { StoreItemKind } from '@metorial/db';
import type { NormalizedStorePath } from './storePath';

export let skillRootDocumentName = 'SKILL.md';
export let skillRootDocumentPath = `/${skillRootDocumentName}`;
export let skillAgentsDirectoryPath = '/agents/';

let isMarkdownName = (name: string | null) => !!name?.toLowerCase().endsWith('.md');

export let isInSkillAgentsDirectory = (path: NormalizedStorePath) =>
  path.parentPath === skillAgentsDirectoryPath;

export let isSkillAgentPath = (path: NormalizedStorePath) =>
  isInSkillAgentsDirectory(path) && isMarkdownName(path.name);

export let assertSkillStoreItemAllowed = (d: {
  path: NormalizedStorePath;
  kind: StoreItemKind;
}) => {
  if (d.path.name === skillRootDocumentName && d.kind !== 'document') {
    throw new ServiceError(
      badRequestError({
        message: 'SKILL.md is reserved for documents in skill stores'
      })
    );
  }

  if (
    isInSkillAgentsDirectory(d.path) &&
    (d.kind !== 'document' || !isSkillAgentPath(d.path))
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'Only markdown documents can be added to the agents directory of a skill'
      })
    );
  }
};
