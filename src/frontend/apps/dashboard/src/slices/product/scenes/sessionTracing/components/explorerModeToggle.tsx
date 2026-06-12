import { OptionToggle } from '@metorial/ui';
import type { ExplorerTabMode } from '../types';

export let ExplorerModeToggle = (p: {
  value: ExplorerTabMode;
  onChange: (mode: ExplorerTabMode) => void;
}) => (
  <OptionToggle
    ariaLabel="Explorer mode"
    size="1"
    value={p.value}
    onChange={value => {
      if (value !== 'manual' && value !== 'assistant') return;
      p.onChange(value);
    }}
    items={[
      { id: 'manual', label: 'Manual' },
      { id: 'assistant', label: 'Assistant' }
    ]}
  />
);
