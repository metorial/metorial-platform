import type { ChatMessageCreateResult } from '@metorial/state';
import { useCreateChatMessage } from '@metorial/state';
import { Button, Text, theme } from '@metorial/ui';
import { RiSendPlane2Fill } from '@remixicon/react';
import { useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import styled from 'styled-components';

let Wrapper = styled.form`
  border-top: 1px solid ${theme.colors.gray300};
  padding: 12px 20px 14px;
  background: ${theme.colors.background};
  flex-shrink: 0;
`;

let Field = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  padding: 8px 8px 8px 12px;
  background: ${theme.colors.background};
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: ${theme.colors.gray600};
  }
`;

let Textarea = styled(TextareaAutosize)`
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  background: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  color: ${theme.colors.gray900};
  padding: 5px 0;

  &::placeholder {
    color: ${theme.colors.gray600};
  }
`;

let Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  min-height: 16px;
`;

export let ChatComposer = (p: {
  instanceId: string | null;
  chatId: string;
  channelId: string;
  threadId?: string | null;
  placeholder: string;
  onSent?: (message: ChatMessageCreateResult) => void;
}) => {
  let [content, setContent] = useState('');
  let textareaRef = useRef<HTMLTextAreaElement>(null);
  let sendMessage = useCreateChatMessage();

  let send = async () => {
    let markdown = content.trim();
    if (!markdown || !p.instanceId || sendMessage.isLoading) return;

    let [res] = await sendMessage.mutate({
      instanceId: p.instanceId,
      chatId: p.chatId,
      channelId: p.channelId,
      ...(p.threadId ? { threadId: p.threadId } : {}),
      parts: [{ type: 'markdown', markdown }],
      altText: markdown
    });

    if (!res) return;

    setContent('');
    p.onSent?.(res);
    textareaRef.current?.focus();
  };

  return (
    <Wrapper
      onSubmit={event => {
        event.preventDefault();
        send();
      }}
    >
      <Field>
        <Textarea
          ref={textareaRef}
          minRows={1}
          maxRows={10}
          value={content}
          placeholder={p.placeholder}
          aria-label="Message"
          onChange={event => setContent(event.target.value)}
          onKeyDown={event => {
            if (event.key != 'Enter' || event.shiftKey) return;
            event.preventDefault();
            send();
          }}
        />

        <Button
          type="submit"
          size="1"
          disabled={!p.instanceId || !content.trim()}
          loading={sendMessage.isLoading}
          success={sendMessage.isSuccess}
          iconLeft={<RiSendPlane2Fill size={13} />}
        >
          Send
        </Button>
      </Field>

      <Footer>
        <Text size="1" color="gray600">
          Enter to send, Shift + Enter for a new line. Markdown is supported.
        </Text>

        <sendMessage.RenderError />
      </Footer>
    </Wrapper>
  );
};
