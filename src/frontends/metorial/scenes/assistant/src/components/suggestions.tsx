import React from 'react';
import { theme } from '@metorial/ui';
import styled from 'styled-components';
import type { AssistantSuggestion } from './types';

let SuggestionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

let SuggestionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, ${theme.colors.foreground} 72%, transparent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;

  &:hover {
    background: color-mix(in srgb, ${theme.colors.foreground} 4%, transparent);
    border-color: color-mix(in srgb, ${theme.colors.foreground} 14%, transparent);
    color: ${theme.colors.foreground};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

export let AssistantSuggestions = (p: {
  suggestions: AssistantSuggestion[];
  disabled?: boolean;
  onSelect: (suggestion: AssistantSuggestion) => void;
}) => {
  if (!p.suggestions.length) return null;

  return (
    <SuggestionsRow>
      {p.suggestions.map(suggestion => (
        <SuggestionButton
          key={suggestion.id}
          type="button"
          disabled={p.disabled}
          onClick={() => p.onSelect(suggestion)}
        >
          {suggestion.label}
        </SuggestionButton>
      ))}
    </SuggestionsRow>
  );
};
