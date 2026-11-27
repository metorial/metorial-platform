import { Text } from '@metorial/ui';
import {
  RiChatQuoteLine,
  RiRobot2Line,
  RiServerLine,
  RiUser3Line
} from '@remixicon/react';
import type { ReactNode } from 'react';
import { BlockStack, MessageBlockHeader, MessageBlockWrapper } from '../styles';
import { asRecord } from '../utils';
import { ContentBlockView } from './contentBlockView';

let roleMeta: Record<string, { icon: ReactNode; label: string }> = {
  user: { icon: <RiUser3Line />, label: 'User' },
  assistant: { icon: <RiRobot2Line />, label: 'Assistant' },
  system: { icon: <RiServerLine />, label: 'System' }
};

export let PromptMessageView = ({ message }: { message: any }) => {
  let record = asRecord(message);
  let role = record?.role ? String(record.role) : 'user';
  let meta = roleMeta[role] ?? { icon: <RiChatQuoteLine />, label: role };
  let content = record?.content;
  let contents = Array.isArray(content) ? content : content ? [content] : [];

  return (
    <MessageBlockWrapper>
      <MessageBlockHeader>
        {meta.icon}
        <span>{meta.label}</span>
      </MessageBlockHeader>
      {contents.length === 0 ? (
        <Text size="1" color="gray700">
          Empty content.
        </Text>
      ) : (
        <BlockStack>
          {contents.map((block, index) => (
            <ContentBlockView key={index} content={block} index={index} />
          ))}
        </BlockStack>
      )}
    </MessageBlockWrapper>
  );
};
