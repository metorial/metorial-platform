import React, { useMemo } from 'react';
import { Select, Text, theme } from '@metorial/ui';
import { RiArrowUpLine } from '@remixicon/react';
import TextareaAutosize from 'react-textarea-autosize';
import styled from 'styled-components';
import { AssistantSuggestions } from './suggestions';
import type { AssistantModelOption, AssistantSuggestion } from './types';

let ComposerRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin: 0 auto;
`;

let ComposerCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  background: ${theme.colors.gray100};
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  border-radius: 22px;
  padding: 14px 14px 10px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 10px 30px rgba(15, 23, 42, 0.04);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
`;

let ComposerInput = styled(TextareaAutosize)`
  width: 100%;
  min-height: 44px;
  max-height: 132px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: ${theme.colors.foreground};
  font-size: 14px;
  line-height: 1.6;
  padding: 0 2px;
  overflow: auto;

  &::placeholder {
    color: color-mix(in srgb, ${theme.colors.foreground} 48%, transparent);
  }
`;

let ComposerFooter = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
`;

let FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
`;

let ModelSelectWrap = styled.div`
  width: 320px;
  max-width: 100%;
`;

let HintText = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 58%, transparent);
  white-space: nowrap;
`;

let SendButton = styled.button<{ 'data-disabled'?: 'true' | 'false' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: ${p =>
    p['data-disabled'] == 'true'
      ? `color-mix(in srgb, ${theme.colors.foreground} 10%, ${theme.colors.background})`
      : theme.colors.foreground};
  color: ${p => (p['data-disabled'] == 'true' ? theme.colors.gray700 : theme.colors.background)};
  cursor: ${p => (p['data-disabled'] == 'true' ? 'not-allowed' : 'pointer')};
  transition:
    background 120ms ease,
    transform 120ms ease,
    opacity 120ms ease;

  &:hover {
    transform: ${p => (p['data-disabled'] == 'true' ? 'none' : 'translateY(-1px)')};
  }

  &:active {
    transform: ${p => (p['data-disabled'] == 'true' ? 'none' : 'translateY(0) scale(0.98)')};
  }
`;

let SuggestionsWrap = styled.div`
  display: flex;
  justify-content: flex-start;
  width: 100%;
`;

export let AssistantComposer = (p: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  placeholder?: string;
  selectedModelId?: string;
  modelOptions?: AssistantModelOption[];
  onSelectModel?: (modelId: string) => void;
  suggestions?: AssistantSuggestion[];
  onSelectSuggestion?: (suggestion: AssistantSuggestion) => void;
  submitLabel?: string;
}) => {
  let modelItems = useMemo(
    () =>
      (p.modelOptions ?? []).map(option => ({
        id: option.id,
        label: option.label
      })),
    [p.modelOptions]
  );

  let canSubmit = !!p.value.trim() && !p.isSubmitting && !p.disabled;
  let selectedModelId = p.selectedModelId ?? p.modelOptions?.[0]?.id;

  return (
    <ComposerRoot>
      <ComposerCard>
        <ComposerInput
          value={p.value}
          disabled={p.disabled}
          minRows={1}
          placeholder={p.placeholder ?? 'Ask the Metorial Assistant...'}
          onChange={event => p.onChange(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key == 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSubmit) p.onSubmit();
            }
          }}
        />

        <ComposerFooter>
          <FooterLeft>
            {!!modelItems.length && (
              <ModelSelectWrap>
                <Select
                  label="Model"
                  hideLabel
                  disabled={p.disabled}
                  placeholder="Auto"
                  value={selectedModelId}
                  onChange={value => p.onSelectModel?.(value)}
                  items={modelItems}
                />
              </ModelSelectWrap>
            )}
          </FooterLeft>

          <SendButton
            type="button"
            data-disabled={canSubmit ? 'false' : 'true'}
            disabled={!canSubmit}
            onClick={p.onSubmit}
            aria-label={p.submitLabel ?? 'Send'}
            title={p.submitLabel ?? 'Send'}
          >
            <RiArrowUpLine size={16} />
          </SendButton>
        </ComposerFooter>
      </ComposerCard>

      {!!p.suggestions?.length && p.onSelectSuggestion && (
        <SuggestionsWrap>
          <AssistantSuggestions
            suggestions={p.suggestions}
            disabled={p.disabled || p.isSubmitting}
            onSelect={p.onSelectSuggestion}
          />
        </SuggestionsWrap>
      )}
    </ComposerRoot>
  );
};
