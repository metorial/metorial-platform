import { Panel } from '@metorial/ui';
import type { ReactNode } from 'react';

export let SkillPanelPage = (p: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <>
    <Panel.Header actions={p.actions}>
      <Panel.Title>{p.title}</Panel.Title>
      <Panel.Description>{p.description}</Panel.Description>
    </Panel.Header>

    <Panel.Content>{p.children}</Panel.Content>
  </>
);
