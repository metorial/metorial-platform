import { NumberInput, type NumberInputProps } from '@metorial/ui';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

let clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export let CommitNumberInput = ({
  value,
  min,
  max,
  onCommit,
  commitOnUnmount,
  ...props
}: Omit<NumberInputProps, 'value' | 'onChange' | 'onBlur' | 'min' | 'max'> & {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  commitOnUnmount?: boolean;
}) => {
  let { key } = useLocation();
  let [draft, setDraft] = useState<number | null>(value);

  let latest = useRef({ draft, value, min, max, onCommit });
  latest.current = { draft, value, min, max, onCommit };

  useEffect(() => setDraft(value), [value, key]);

  // A popover that closes on Escape removes the field without a blur, so the draft is
  // committed when the field goes away.
  useEffect(() => {
    if (!commitOnUnmount) return;

    return () => {
      let { draft, value, min, max, onCommit } = latest.current;
      if (draft === null || !Number.isFinite(draft)) return;

      let next = clamp(draft, min, max);
      if (next != value) onCommit(next);
    };
  }, [commitOnUnmount]);

  let commit = () => {
    let next = draft === null || !Number.isFinite(draft) ? value : clamp(draft, min, max);
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
