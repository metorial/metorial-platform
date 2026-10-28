import { Button, Input } from '@metorial/ui';
import { useState, type ComponentType } from 'react';
import styled from 'styled-components';

let Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
`;

export let CommentComposer = ({
  label,
  submitLabel,
  initialValue = '',
  autoFocus,
  loading,
  success,
  RenderError,
  onSubmit,
  onCancel
}: {
  label: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  loading?: boolean;
  success?: boolean;
  RenderError?: ComponentType;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) => {
  let [value, setValue] = useState(initialValue);
  let canSubmit = value.trim().length > 0 && value.trim() !== initialValue.trim();

  let submit = async () => {
    if (!canSubmit || loading) return;
    if (await onSubmit(value.trim())) setValue('');
  };

  return (
    <Wrap
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <Input
        as="textarea"
        label={label}
        hideLabel
        placeholder={label}
        size="2"
        minRows={2}
        maxRows={8}
        autoFocus={autoFocus}
        value={value}
        onInput={next => setValue(next)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          } else if (event.key === 'Escape' && onCancel) {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {RenderError && <RenderError />}
      <Actions>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="1"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="solid"
          size="1"
          disabled={!canSubmit}
          loading={loading}
          success={success}
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      </Actions>
    </Wrap>
  );
};
