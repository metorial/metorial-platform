import type { ChatChannelPreview, ChatMessageAuthor } from '@metorial/state';
import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let authorName = (author: ChatMessageAuthor | null | undefined) =>
  author?.fullName || author?.userName || 'Unknown';

let AvatarBox = styled.div<{ $size: number }>`
  height: ${p => p.$size}px;
  width: ${p => p.$size}px;
  min-width: ${p => p.$size}px;
  flex: none;
  border-radius: 7px;
  overflow: hidden;
  background: ${theme.colors.gray250};
  border: 1px solid ${theme.colors.gray350};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray700};
  font-weight: 600;
  user-select: none;

  img {
    height: 100%;
    width: 100%;
    object-fit: cover;
    display: block;
  }
`;

let initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export let AuthorAvatar = (p: {
  author: ChatMessageAuthor | null | undefined;
  size?: number;
}) => {
  let size = p.size ?? 36;
  let name = authorName(p.author);

  return (
    <AvatarBox $size={size} style={{ fontSize: Math.round(size / 2.8) }} title={name}>
      {p.author?.imageUrl ? (
        <img src={p.author.imageUrl} alt={name} loading="lazy" />
      ) : (
        <span>{initialsOf(name)}</span>
      )}
    </AvatarBox>
  );
};

export let channelTypeLabels: Record<string, string> = {
  public: 'Public',
  private: 'Private',
  dm: 'Direct Message',
  group_dm: 'Group DM',
  shared: 'Shared',
  announcement: 'Announcement',
  forum: 'Forum',
  unknown: 'Channel'
};

export let authorTypeLabels: Record<string, string> = {
  app: 'App',
  system: 'System',
  webhook: 'Webhook',
  unknown: 'Unknown'
};

export let channelName = (channel: ChatChannelPreview) =>
  channel.name ?? channel.subject ?? channel.providerChannelId;

export let channelPrefix = (channel: ChatChannelPreview) =>
  channel.type == 'dm' || channel.type == 'group_dm' ? '@' : '#';

export let isSameDay = (a: Date, b: Date) =>
  a.getFullYear() == b.getFullYear() &&
  a.getMonth() == b.getMonth() &&
  a.getDate() == b.getDate();

export let formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export let formatDayLabel = (date: Date) => {
  let today = new Date();
  let yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() == today.getFullYear() ? {} : { year: 'numeric' })
  });
};

export let formatRelativeDate = (date: Date | null | undefined) => {
  if (!date) return null;

  let today = new Date();
  if (isSameDay(date, today)) return formatTime(date);

  let yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() == today.getFullYear() ? {} : { year: '2-digit' })
  });
};
