import { Panel, showModal } from '@metorial/ui';
import { type ReactNode } from 'react';

export let showPickerSidePanel = (
  children: (d: { close: () => void }) => ReactNode,
  opts?: { width?: number }
) =>
  showModal(({ dialogProps, close }) => (
    <Panel.Wrapper {...dialogProps} width={opts?.width ?? 1000}>
      {children({ close })}
    </Panel.Wrapper>
  ));
