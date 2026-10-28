import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { WorkspaceSize } from './layout';

export type SkillWorkspaceContextValue = {
  skillId: string;
  size: WorkspaceSize;
  readOnly: boolean;
  skillDocumentTitleAccessory: ReactNode;
  registerFilePane: () => () => void;
};

export let SkillWorkspaceContext = createContext<SkillWorkspaceContextValue | null>(null);

export let useSkillWorkspace = () => useContext(SkillWorkspaceContext);
