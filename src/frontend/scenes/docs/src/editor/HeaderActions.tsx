import { Button, Input, Tooltip } from '@metorial/ui';
import { useCallback, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import { Popover, usePopoverAnchor } from '../components/Popover';
import {
  IconArrowLeft,
  IconCheck,
  IconCloudCheck,
  IconCopy,
  IconInfo,
  IconDots,
  IconDownload,
  IconHistory,
  IconKeyboard,
  IconShare,
  IconUpload
} from './icons';

/* ----------------------------------------------------------------------- */
/* Shared bits                                                             */
/* ----------------------------------------------------------------------- */

let POPOVER_TRIGGER_SELECTOR = '[data-header-popover-trigger]';

let IconButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ theme }) => theme.color.text};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.textSubtle};
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

/* ----------------------------------------------------------------------- */
/* BackButton                                                              */
/* ----------------------------------------------------------------------- */

interface BackButtonProps {
  onClick?: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <IconButton type="button" title="Go back" aria-label="Go back" onClick={onClick}>
      <IconArrowLeft />
    </IconButton>
  );
}

/* ----------------------------------------------------------------------- */
/* TitleButton                                                             */
/* ----------------------------------------------------------------------- */

let TitleTriggerBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  max-width: 280px;
  padding: 0 8px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }

  &:disabled {
    cursor: default;
    color: ${({ theme }) => theme.color.textMuted};
  }

  &:disabled:hover {
    background: transparent;
  }

  & > .title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > .placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
    font-weight: 500;
  }
`;

let PopoverInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
`;

let LocationField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let LocationLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: #222;
  user-select: none;
`;

let StaticValue = styled.div`
  display: inline-flex;
  align-items: center;
  width: 100%;
  padding: 0 10px;
  height: 36px;
  border-radius: 6px;
  background: #efefef;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: 14px;
  font-weight: 500;
`;

interface TitleButtonProps {
  title: string;
  /** Optional location label shown read-only inside the popover. Set to
   *  `null` or `undefined` to hide the field entirely. */
  location?: string | null;
  readOnly?: boolean;
  onTitleChange: (title: string) => void;
}

export function TitleButton({ title, location, readOnly, onTitleChange }: TitleButtonProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = usePopoverAnchor('left');
  let isReadOnly = !!readOnly;

  return (
    <>
      <TitleTriggerBtn
        ref={triggerRef}
        type="button"
        data-header-popover-trigger="true"
        onClick={isReadOnly ? undefined : toggle}
        disabled={isReadOnly}
        title={title || 'Untitled'}
      >
        {title ? (
          <span className="title-text">{title}</span>
        ) : (
          <span className="placeholder">Untitled</span>
        )}
      </TitleTriggerBtn>
      {!isReadOnly && (
        <Popover
          open={open}
          anchor={anchor}
          width={300}
          ignoreClickOnSelector={POPOVER_TRIGGER_SELECTOR}
          onClose={closeMenu}
        >
          <PopoverInner>
            <Input
              label="Title"
              placeholder="Untitled"
              autoFocus
              value={title}
              onInput={value => onTitleChange(value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  closeMenu();
                }
              }}
            />
            {location !== null && location !== undefined && (
              <LocationField>
                <LocationLabel>Location</LocationLabel>
                <StaticValue>{location}</StaticValue>
              </LocationField>
            )}
          </PopoverInner>
        </Popover>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* CloudStatus                                                             */
/* ----------------------------------------------------------------------- */

let CloudWrap = styled.span<{ $status?: 'saved' | 'pending' | 'saving' | 'error' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: ${({ $status, theme }) =>
    $status === 'error'
      ? theme.color.danger
      : $status === 'pending' || $status === 'saving'
        ? theme.color.warning
        : theme.color.text};

  svg {
    width: 16px;
    height: 16px;
  }
`;

let getCloudStatusLabel = (status: 'saved' | 'pending' | 'saving' | 'error') => {
  if (status === 'pending') return 'Saving changes shortly';
  if (status === 'saving') return 'Saving document';
  if (status === 'error') return 'Could not save document';
  return 'Document is saved automatically';
};

export function CloudStatus({
  status = 'saved'
}: {
  status?: 'saved' | 'pending' | 'saving' | 'error';
}) {
  let label = getCloudStatusLabel(status);

  return (
    <Tooltip content={label} side="bottom">
      <CloudWrap role="status" aria-label={label} $status={status}>
        <IconCloudCheck />
      </CloudWrap>
    </Tooltip>
  );
}

/* ----------------------------------------------------------------------- */
/* ShareButton                                                             */
/* ----------------------------------------------------------------------- */

let ShareTriggerWrap = styled.span`
  display: inline-flex;

  /* The metorial Button doesn't expose data attributes by default; tag
     the wrapper so the popover's outside-click handler can ignore it. */
  > button {
    cursor: pointer;
  }
`;

let SectionLabel = styled.div`
  padding: 4px 14px 4px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let RowDivider = styled.div`
  height: 1px;
  margin: 6px 0;
  background: ${({ theme }) => theme.color.border};
`;

let RowAction = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }

  & > .icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: ${({ theme }) => theme.color.textMuted};
    border-radius: 6px;
  }

  & > .icon svg {
    width: 16px;
    height: 16px;
  }

  & > .label {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  & > .label > .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > .label > .desc {
    font-size: 11.5px;
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let PersonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
`;

let PersonInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

let PersonName = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let PersonEmail = styled.span`
  font-size: 11.5px;
  color: ${({ theme }) => theme.color.textSubtle};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let PersonMeta = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 0;
`;

let RoleBadge = styled.span<{ $role: 'editor' | 'viewer' }>`
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 11.5px;
  font-weight: 500;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.bgAlt};
  color: ${({ theme }) => theme.color.textMuted};
  border: 1px solid ${({ theme }) => theme.color.border};
  text-transform: capitalize;
`;

let PersonActivity = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.color.textSubtle};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
`;

type PersonTimestamp = Date | string | number | null | undefined;

function toDate(value: PersonTimestamp): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a past timestamp as a short relative label, e.g. "2h ago",
 * "Yesterday", "3d ago", "Mar 14". Future timestamps fall back to the
 * absolute date to avoid awkward "in 5m" output.
 */
function formatRelative(date: Date): string {
  let now = Date.now();
  let diffMs = now - date.getTime();
  if (diffMs < 0) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }
  let sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  let min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  let hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  let day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  });
}

interface ActivityLabel {
  text: string;
  fullDate: string | null;
}

function describePersonActivity(
  lastEditedAt: PersonTimestamp,
  lastViewedAt: PersonTimestamp
): ActivityLabel {
  let edited = toDate(lastEditedAt);
  if (edited) {
    return {
      text: `Edited ${formatRelative(edited)}`,
      fullDate: edited.toLocaleString()
    };
  }
  let viewed = toDate(lastViewedAt);
  if (viewed) {
    return {
      text: `Viewed ${formatRelative(viewed)}`,
      fullDate: viewed.toLocaleString()
    };
  }
  return { text: 'Never viewed', fullDate: null };
}

let PopoverList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px 0;
`;

let FooterText = styled.div`
  padding: 6px 14px 10px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.color.textSubtle};
`;

export interface SharedPerson {
  name: string;
  email: string;
  imageUrl?: string;
  role: 'editor' | 'viewer';
  /** When this person last edited the document. `null` / omitted means
   *  they have never edited it. Accepts `Date`, ISO string, or epoch ms. */
  lastEditedAt?: PersonTimestamp;
  /** When this person last opened the document. `null` / omitted means
   *  they have never viewed it. Accepts `Date`, ISO string, or epoch ms. */
  lastViewedAt?: PersonTimestamp;
}

interface ShareButtonProps {
  documentLink: string;
  people: SharedPerson[];
  onCopyLink: () => void;
}

export function ShareButton({ documentLink, people, onCopyLink }: ShareButtonProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = usePopoverAnchor('right');
  let [copied, setCopied] = useState(false);

  let handleCopy = useCallback(() => {
    onCopyLink();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [onCopyLink]);

  return (
    <>
      <ShareTriggerWrap data-header-popover-trigger="true">
        <Button
          ref={triggerRef}
          type="button"
          variant="solid"
          size="2"
          iconLeft={<IconShare />}
          onClick={toggle}
          title="Share this document"
        >
          Share
        </Button>
      </ShareTriggerWrap>
      <Popover
        open={open}
        anchor={anchor}
        align="right"
        width={320}
        ignoreClickOnSelector={POPOVER_TRIGGER_SELECTOR}
        onClose={closeMenu}
      >
        <PopoverList>
          <SectionLabel>Document link</SectionLabel>
          <RowAction type="button" onClick={handleCopy}>
            <span className="icon">{copied ? <IconCheck /> : <IconCopy />}</span>
            <span className="label">
              <span className="title">{copied ? 'Copied to clipboard' : 'Copy link'}</span>
              <span className="desc" title={documentLink}>
                {documentLink}
              </span>
            </span>
          </RowAction>
          <RowDivider />
          <SectionLabel>People with access</SectionLabel>
          {people.map(p => {
            let activity = describePersonActivity(p.lastEditedAt, p.lastViewedAt);
            return (
              <PersonRow key={p.email}>
                <Avatar name={p.name} imageUrl={p.imageUrl} email={p.email} size={28} />
                <PersonInfo>
                  <PersonName>{p.name}</PersonName>
                  <PersonEmail>{p.email}</PersonEmail>
                </PersonInfo>
                <PersonMeta>
                  <RoleBadge $role={p.role}>{p.role}</RoleBadge>
                  <PersonActivity title={activity.fullDate ?? activity.text}>
                    {activity.text}
                  </PersonActivity>
                </PersonMeta>
              </PersonRow>
            );
          })}
          {people.length === 0 && <FooterText>No collaborators yet.</FooterText>}
        </PopoverList>
      </Popover>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* SettingsButton                                                          */
/* ----------------------------------------------------------------------- */

export interface PageWidthOption {
  id: 'default' | 'medium' | 'full';
  label: string;
  /** CSS value passed to theme.size.contentWidth. */
  value: string;
}

export let PAGE_WIDTH_OPTIONS: PageWidthOption[] = [
  { id: 'default', label: 'Default', value: '720px' },
  { id: 'medium', label: 'Medium', value: '1000px' },
  { id: 'full', label: 'Full', value: '100%' }
];

let PageWidthRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 4px 14px 12px;
`;

let PageWidthBox = styled.button<{ $selected?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 10px 10px;
  border: 1.5px solid
    ${({ $selected, theme }) => ($selected ? theme.color.accent : theme.color.border)};
  border-radius: 10px;
  background: ${({ $selected, theme }) =>
    $selected ? theme.color.accentSoft : theme.color.bg};
  color: ${({ theme }) => theme.color.text};
  cursor: pointer;
  transition:
    border-color ${({ theme }) => theme.motion.fast},
    background ${({ theme }) => theme.motion.fast},
    box-shadow ${({ theme }) => theme.motion.fast};
  font: inherit;
  box-shadow: ${({ $selected, theme }) =>
    $selected ? `0 0 0 3px ${theme.color.accentSoft}` : '0 0 0 0 transparent'};

  &:hover {
    border-color: ${({ $selected, theme }) =>
      $selected ? theme.color.accent : theme.color.borderStrong};
    background: ${({ $selected, theme }) =>
      $selected ? theme.color.accentSoft : theme.color.bgAlt};
  }

  & > .label {
    font-size: 12.5px;
    font-weight: 500;
    color: ${({ $selected, theme }) => ($selected ? theme.color.accent : theme.color.text)};
  }
`;

let PageWidthIconSvg = styled.svg<{ $selected?: boolean }>`
  display: block;
  width: 60px;
  height: 36px;
  color: ${({ $selected, theme }) => ($selected ? theme.color.accent : theme.color.textMuted)};
  transition: color ${({ theme }) => theme.motion.fast};
`;

interface PageWidthIconProps {
  /** Horizontal inset of the page rails from the icon edges, in
   *  viewBox units. Smaller = wider page. */
  inset: number;
  selected: boolean;
}

/**
 * Visual indicator for a page width preset: two vertical "page rails"
 * with three centered text lines, sized to convey how wide content sits
 * inside the page. The rails get heavier strokes than the lines and are
 * tinted with the accent color when the option is selected.
 */
function PageWidthIcon({ inset, selected }: PageWidthIconProps) {
  let VB_W = 60;
  let left = inset;
  let right = VB_W - inset;
  // Rails span vertically with 7px top/bottom whitespace
  let railTop = 7;
  let railBottom = 29;
  // Three text lines stacked between the rails. The first and third
  // lines stop short of the rails to imply a paragraph (Notion-style).
  let linePadOuter = 3;
  let linePadShort = 7;
  return (
    <PageWidthIconSvg viewBox={`0 0 ${VB_W} 36`} aria-hidden $selected={selected}>
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        {/* Page rails */}
        <line x1={left} y1={railTop} x2={left} y2={railBottom} strokeWidth={1.5} />
        <line x1={right} y1={railTop} x2={right} y2={railBottom} strokeWidth={1.5} />
        {/* Three text lines centered between the rails */}
        <line
          x1={left + linePadOuter}
          y1={13}
          x2={right - linePadOuter}
          y2={13}
          strokeWidth={1.5}
          opacity={0.55}
        />
        <line
          x1={left + linePadOuter}
          y1={18}
          x2={right - linePadOuter}
          y2={18}
          strokeWidth={1.5}
          opacity={0.55}
        />
        <line
          x1={left + linePadOuter}
          y1={23}
          x2={right - linePadShort}
          y2={23}
          strokeWidth={1.5}
          opacity={0.55}
        />
      </g>
    </PageWidthIconSvg>
  );
}

let PAGE_WIDTH_INSETS: Record<PageWidthOption['id'], number> = {
  default: 14,
  medium: 7,
  full: 2
};

interface SettingsButtonProps {
  contentWidth: string;
  readOnly?: boolean;
  onContentWidthChange: (value: string) => void;
  onImport: () => void;
  onExport: () => void;
  onPageInfo: () => void;
  onVersionHistory: () => void;
  onKeyboardShortcuts: () => void;
}

export function SettingsButton({
  contentWidth,
  readOnly,
  onContentWidthChange,
  onImport,
  onExport,
  onPageInfo,
  onVersionHistory,
  onKeyboardShortcuts
}: SettingsButtonProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = usePopoverAnchor('right');

  let wrap = (cb: () => void) => () => {
    cb();
    closeMenu();
  };

  return (
    <>
      <IconButton
        ref={triggerRef}
        type="button"
        data-header-popover-trigger="true"
        title="Page settings"
        aria-label="Page settings"
        $active={open}
        onClick={toggle}
      >
        <IconDots />
      </IconButton>
      <Popover
        open={open}
        anchor={anchor}
        align="right"
        width={300}
        ignoreClickOnSelector={POPOVER_TRIGGER_SELECTOR}
        onClose={closeMenu}
      >
        <PopoverList>
          <SectionLabel>Page width</SectionLabel>
          <PageWidthRow>
            {PAGE_WIDTH_OPTIONS.map(opt => {
              let selected = opt.value === contentWidth;
              return (
                <PageWidthBox
                  key={opt.id}
                  type="button"
                  $selected={selected}
                  onClick={() => onContentWidthChange(opt.value)}
                  aria-pressed={selected}
                >
                  <PageWidthIcon inset={PAGE_WIDTH_INSETS[opt.id]} selected={selected} />
                  <span className="label">{opt.label}</span>
                </PageWidthBox>
              );
            })}
          </PageWidthRow>
          <RowDivider />
          <SectionLabel>Document</SectionLabel>
          <RowAction type="button" onClick={wrap(onPageInfo)}>
            <span className="icon">
              <IconInfo />
            </span>
            <span className="label">
              <span className="title">Page info</span>
              <span className="desc">Editors, viewers, words and characters</span>
            </span>
          </RowAction>
          <RowAction type="button" onClick={wrap(onVersionHistory)}>
            <span className="icon">
              <IconHistory />
            </span>
            <span className="label">
              <span className="title">Version history</span>
            </span>
          </RowAction>
          {!readOnly && (
            <RowAction type="button" onClick={wrap(onImport)}>
              <span className="icon">
                <IconUpload />
              </span>
              <span className="label">
                <span className="title">Import</span>
                <span className="desc">Replace contents with a .md file</span>
              </span>
            </RowAction>
          )}
          <RowAction type="button" onClick={wrap(onExport)}>
            <span className="icon">
              <IconDownload />
            </span>
            <span className="label">
              <span className="title">Export</span>
              <span className="desc">Download as .md file</span>
            </span>
          </RowAction>
          <RowDivider />
          <SectionLabel>Help</SectionLabel>
          <RowAction type="button" onClick={wrap(onKeyboardShortcuts)}>
            <span className="icon">
              <IconKeyboard />
            </span>
            <span className="label">
              <span className="title">Keyboard shortcuts</span>
              <span className="desc">Editing &amp; markdown shortcuts</span>
            </span>
          </RowAction>
        </PopoverList>
      </Popover>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* AvatarTrigger (just the avatar with a tooltip)                          */
/* ----------------------------------------------------------------------- */

let AvatarTooltipBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;

  & > .name {
    font-weight: 600;
  }

  & > .email {
    font-size: 11.5px;
    opacity: 0.78;
  }
`;

let AvatarTriggerWrap = styled.span`
  display: inline-flex;
  cursor: pointer;
  transition: transform 120ms ease;

  &:hover {
    transform: scale(1.04);
  }
`;

interface CurrentUserDisplayProps {
  name: string;
  imageUrl?: string;
  email?: string;
}

export function CurrentUserDisplay({ name, imageUrl, email }: CurrentUserDisplayProps) {
  let tooltipContent = email ? (
    <AvatarTooltipBody>
      <span className="name">{name}</span>
      <span className="email">{email}</span>
    </AvatarTooltipBody>
  ) : (
    name
  );

  return (
    <Tooltip content={tooltipContent} side="bottom">
      <AvatarTriggerWrap aria-label={email ? `${name} (${email})` : name}>
        <Avatar name={name} imageUrl={imageUrl} email={email} size={28} noTooltip />
      </AvatarTriggerWrap>
    </Tooltip>
  );
}

/* ----------------------------------------------------------------------- */
/* Generic header shell pieces                                             */
/* ----------------------------------------------------------------------- */

export let HeaderSection = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

export let HeaderDivider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: ${({ theme }) => theme.color.border};
  flex-shrink: 0;
`;

interface HeaderRightProps {
  children: ReactNode;
}

export let HeaderRight = ({ children }: HeaderRightProps) => (
  <HeaderSection style={{ justifyContent: 'flex-end' }}>{children}</HeaderSection>
);
