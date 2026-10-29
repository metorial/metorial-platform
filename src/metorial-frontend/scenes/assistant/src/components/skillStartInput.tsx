import { Text, theme } from '@metorial/ui';
import { RiSparkling2Line } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';
import { AssistantComposer } from './composer';
import type { AssistantSuggestion } from './types';

let Root = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
`;

let Heading = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${theme.colors.foreground};
`;

let ErrorText = styled.div`
  color: ${theme.colors.red800};
  font-size: 13px;
`;

export let SkillStartInput = (p: {
  title: string;
  placeholder: string;
  suggestions?: AssistantSuggestion[];
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void>;
}) => {
  let [value, setValue] = useState('');
  let [isSubmitting, setIsSubmitting] = useState(false);
  let [error, setError] = useState<string | null>(null);

  let submit = async () => {
    let text = value.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await p.onSubmit(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the skill.');
      setIsSubmitting(false);
    }
  };

  return (
    <Root>
      <Heading>
        <RiSparkling2Line size={18} />
        <Text size="4" weight="strong">
          {p.title}
        </Text>
      </Heading>

      <AssistantComposer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        isSubmitting={isSubmitting}
        disabled={p.disabled}
        placeholder={p.placeholder}
        minRows={4}
        submitLabel="Create Skill"
        suggestions={p.suggestions}
        onSelectSuggestion={suggestion => setValue(suggestion.prompt)}
      />

      {error && <ErrorText>{error}</ErrorText>}
    </Root>
  );
};
