import { useMetorialAssistantEnabled } from '@metorial/state';
import { theme } from '@metorial/ui';
import { RiArrowUpLine, RiSparkling2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useId, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { AssistantSuggestions } from './suggestions';
import type { AssistantSuggestion } from './types';

let resizeTransition = { duration: 0.12, ease: [0.2, 0, 0, 1] } as const;
let revealTransition = { duration: 0.09, delay: 0.03, ease: 'easeOut' } as const;

let Root = styled.section`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
`;

let Card = styled.div<{ $expanded: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid ${p => (p.$expanded ? theme.colors.gray500 : theme.colors.gray400)};
  border-radius: 12px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;

  &:hover {
    border-color: ${theme.colors.gray500};
  }
`;

let Body = styled(motion.div)`
  overflow: hidden;
  border-radius: 11px;
`;

let TopRow = styled.div<{ $expanded: boolean }>`
  display: flex;
  align-items: ${p => (p.$expanded ? 'flex-start' : 'center')};
  gap: 10px;
  padding: ${p => (p.$expanded ? '12px 12px 4px 14px' : '6px 6px 6px 14px')};
  min-width: 0;
  transition: padding 120ms cubic-bezier(0.2, 0, 0, 1);
`;

let SparkIcon = styled.span<{ $expanded: boolean }>`
  display: flex;
  flex: 0 0 auto;
  padding-top: ${p => (p.$expanded ? '7px' : '0')};
  color: ${theme.colors.gray700};
  transition: padding 120ms cubic-bezier(0.2, 0, 0, 1);
`;

let Input = styled(TextareaAutosize)`
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: ${theme.colors.foreground};
  font-size: 14px;
  line-height: 22px;
  padding: 4px 0;

  &::placeholder {
    color: ${theme.colors.gray600};
  }
`;

let InlineSuggestions = styled(motion.div)`
  display: flex;
  flex: 0 0 auto;

  @media (max-width: 1000px) {
    display: none;
  }
`;

let BottomRow = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 8px 14px;
  min-width: 0;
`;

let Grow = styled.span`
  flex: 1 1 auto;
`;

let Hint = styled.span`
  color: ${theme.colors.gray600};
  font-size: 12px;
  white-space: nowrap;

  @media (max-width: 640px) {
    display: none;
  }
`;

let SendButton = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: ${theme.colors.foreground};
  color: ${theme.colors.background};
  cursor: pointer;
  transition: background 120ms ease;

  &:disabled {
    background: ${theme.colors.gray300};
    color: ${theme.colors.gray600};
    cursor: not-allowed;
  }
`;

let ErrorText = styled.div`
  color: ${theme.colors.red800};
  font-size: 13px;
`;

let SkillStartInputInner = (p: {
  placeholder: string;
  suggestions?: AssistantSuggestion[];
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void>;
}) => {
  let inputRef = useRef<HTMLTextAreaElement | null>(null);
  let [bodyRef, { height: bodyHeight }] = useMeasure<HTMLDivElement>();
  let sendButtonLayoutId = useId();
  let [value, setValue] = useState('');
  let [isFocused, setIsFocused] = useState(false);
  let [isSubmitting, setIsSubmitting] = useState(false);
  let [error, setError] = useState<string | null>(null);

  let isExpanded = isFocused || !!value.trim();
  let canSubmit = !!value.trim() && !isSubmitting && !p.disabled;

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

  let selectSuggestion = (suggestion: AssistantSuggestion) => {
    setValue(suggestion.prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  let suggestions = p.suggestions?.length ? (
    <AssistantSuggestions
      suggestions={p.suggestions}
      disabled={p.disabled || isSubmitting}
      onSelect={selectSuggestion}
    />
  ) : null;

  let sendButton = (
    <SendButton
      layoutId={sendButtonLayoutId}
      transition={resizeTransition}
      type="button"
      disabled={!canSubmit}
      onClick={submit}
      aria-label="Create Skill"
      title="Create Skill"
    >
      <RiArrowUpLine size={16} />
    </SendButton>
  );

  return (
    <Root>
      <Card
        $expanded={isExpanded}
        onFocus={() => setIsFocused(true)}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsFocused(false);
        }}
      >
        <Body
          initial={false}
          animate={{ height: bodyHeight || 'auto' }}
          transition={resizeTransition}
        >
          <div ref={bodyRef}>
            <TopRow $expanded={isExpanded}>
              <SparkIcon $expanded={isExpanded}>
                <RiSparkling2Line size={16} />
              </SparkIcon>

              <Input
                ref={inputRef}
                value={value}
                disabled={p.disabled || isSubmitting}
                minRows={isExpanded ? 3 : 1}
                maxRows={10}
                placeholder={p.placeholder}
                aria-label={p.placeholder}
                onChange={event => setValue(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key == 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSubmit) submit();
                  }
                }}
              />

              {!isExpanded && (
                <>
                  {suggestions && (
                    // Focusing a chip on mousedown would expand the card and unmount the chip
                    // before its click fires.
                    <InlineSuggestions
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={revealTransition}
                      onMouseDown={e => e.preventDefault()}
                    >
                      {suggestions}
                    </InlineSuggestions>
                  )}
                  {sendButton}
                </>
              )}
            </TopRow>

            {isExpanded && (
              <BottomRow
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={revealTransition}
              >
                {suggestions}
                <Grow />
                <Hint>Enter to create · Shift + Enter for a new line</Hint>
                {sendButton}
              </BottomRow>
            )}
          </div>
        </Body>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
    </Root>
  );
};

export let SkillStartInput = (p: Parameters<typeof SkillStartInputInner>[0]) => {
  let enabled = useMetorialAssistantEnabled();
  if (!enabled) return null;

  return <SkillStartInputInner {...p} />;
};
