import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import { useRef, useState, type ReactNode } from 'react';
import { describeFileSystemError } from '../lib/errors';

export interface PromptOptions {
  title: string;
  description?: ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmText: string;
  selectRange?: [number, number];
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void>;
}

let PromptDialog = (p: PromptOptions & { dialogProps: any; close: () => void }) => {
  let [value, setValue] = useState(p.initialValue ?? '');
  let [error, setError] = useState<string | null>(null);
  let [submitting, setSubmitting] = useState(false);
  let selectedOnce = useRef(false);

  let submit = async () => {
    let trimmed = value.trim();
    let validation = p.validate?.(trimmed) ?? null;

    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await p.onSubmit(trimmed);
      p.close();
    } catch (cause) {
      setError(describeFileSystemError(cause, { path: trimmed }).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Wrapper {...p.dialogProps} width={480}>
      <Dialog.Title>{p.title}</Dialog.Title>
      {p.description ? <Dialog.Description>{p.description}</Dialog.Description> : null}

      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label={p.label}
          value={value}
          placeholder={p.placeholder}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          error={error ?? undefined}
          onFocus={e => {
            if (selectedOnce.current) return;
            selectedOnce.current = true;

            let [start, end] = p.selectRange ?? [0, e.currentTarget.value.length];
            e.currentTarget.setSelectionRange(start, end);
          }}
          onChange={e => {
            setValue(e.target.value);
            setError(null);
          }}
        />

        <Spacer size={20} />

        <Dialog.Actions>
          <Button type="button" variant="outline" disabled={submitting} onClick={p.close}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {p.confirmText}
          </Button>
        </Dialog.Actions>
      </form>
    </Dialog.Wrapper>
  );
};

export let showPromptDialog = (options: PromptOptions) =>
  showModal(({ dialogProps, close }) => (
    <PromptDialog {...options} dialogProps={dialogProps} close={close} />
  ));

export type ConflictChoice = 'overwrite' | 'reload' | 'cancel';

let ConflictDialog = (p: {
  name: string;
  dialogProps: any;
  onChoose: (choice: ConflictChoice) => void;
}) => (
  <Dialog.Wrapper {...p.dialogProps} width={480}>
    <Dialog.Title>File Changed</Dialog.Title>
    <Dialog.Description>
      {p.name} was modified after you opened it. Overwrite it with your version, or reload to
      see the latest version and discard your edits.
    </Dialog.Description>

    <Spacer size={20} />

    <Dialog.Actions>
      <Button type="button" variant="outline" onClick={() => p.onChoose('cancel')}>
        Cancel
      </Button>
      <Button type="button" variant="outline" onClick={() => p.onChoose('reload')}>
        Reload
      </Button>
      <Button type="button" color="red" onClick={() => p.onChoose('overwrite')}>
        Overwrite
      </Button>
    </Dialog.Actions>
  </Dialog.Wrapper>
);

export let askSaveConflict = (name: string) =>
  new Promise<ConflictChoice>(resolve => {
    let settled = false;

    let settle = (choice: ConflictChoice) => {
      if (settled) return;

      settled = true;
      resolve(choice);
    };

    showModal(
      ({ dialogProps, close }) => (
        <ConflictDialog
          name={name}
          dialogProps={dialogProps}
          onChoose={choice => {
            settle(choice);
            close();
          }}
        />
      ),
      { onClose: () => settle('cancel') }
    );
  });
