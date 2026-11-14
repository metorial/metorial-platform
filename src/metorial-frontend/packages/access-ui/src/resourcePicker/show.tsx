import { Panel, showModal } from '@metorial/ui';
import React from 'react';

let pickerWidth = 760;

export let showResourcePicker = (
  render: (close: () => void) => React.ReactElement,
  opts?: { onClose?: () => void }
) =>
  showModal(
    ({ dialogProps, close }) => (
      <Panel.Wrapper {...dialogProps} width={pickerWidth}>
        {render(close)}
      </Panel.Wrapper>
    ),
    { onClose: opts?.onClose }
  );
