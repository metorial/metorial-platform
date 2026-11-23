import { NumberInput, type NumberInputProps } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export let CommitNumberInput = ({
  value,
  min,
  max,
  onCommit,
  ...props
}: Omit<NumberInputProps, 'value' | 'onChange' | 'onBlur' | 'min' | 'max'> & {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) => {
  let { key } = useLocation();
  let [draft, setDraft] = useState<number | null>(value);

  useEffect(() => setDraft(value), [value, key]);

  let commit = () => {
    let next =
      draft === null || !Number.isFinite(draft) ? value : Math.min(max, Math.max(min, draft));
    setDraft(next);
    if (next != value) onCommit(next);
  };

  // Commits on the wrapper's blur, which runs after the field's own blur handling, so the field
  // shows the committed value; Enter blurs the field to commit the same way.
  return (
    <div
      onBlur={commit}
      onKeyDown={event => {
        if (event.key == 'Enter') (event.target as HTMLElement).blur();
      }}
    >
      <NumberInput {...props} min={min} max={max} value={draft} onChange={setDraft} />
    </div>
  );
};
