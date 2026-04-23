import { theme } from '@metorial/ui';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { EntryWrapper } from '../session/components/entry';

export let Output = styled.div`
  display: flex;

  &[data-position='server'] {
    justify-content: flex-end;
  }
`;

export let Wrapper = styled.div`
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
  width: 100%;
  overflow: hidden;
  background: ${theme.colors.background};

  &[data-error='true'] {
    border-color: ${theme.colors.red600};
    background: ${theme.colors.red100};
    box-shadow: 0 0 10px rgba(229, 72, 77, 0.2);
  }
`;

export let Header = styled.header`
  padding: 10px 12px 10px 10px;
  border-bottom: 1px solid ${theme.colors.gray400};
  font-size: 12px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  [data-error='true'] & {
    border-bottom-color: ${theme.colors.red300};
    color: ${theme.colors.red800};
  }
`;

export let HeaderSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

export let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
`;

export let ID = styled.span`
  height: 18px;
  min-width: 18px;
  border-radius: 3px;
  background: ${theme.colors.gray300};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 3px;

  [data-error='true'] & {
    background: ${theme.colors.red300};
    color: ${theme.colors.red800};
  }
`;

export let Title = styled.p`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

export let InlineCode = styled.code`
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
  min-width: 0;
`;

export let Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export let Sections = styled.div`
  display: flex;
  flex-direction: column;
`;

export let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray400};
  }

  [data-error='true'] &:not(:last-child) {
    border-bottom-color: ${theme.colors.red300};
  }
`;

export let SectionHeader = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  letter-spacing: 0.03em;
`;

export let EmptyState = styled.div`
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

export let ErrorSection = styled.div`
  padding: 10px 15px;
  background: ${theme.colors.red100};
  border-top: 1px solid ${theme.colors.red300};
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export let ErrorRow = styled.div`
  display: flex;
  gap: 8px;
`;

export let ErrorLabel = styled.span`
  font-weight: 600;
  color: ${theme.colors.red700};
  min-width: 60px;
  flex-shrink: 0;
`;

export let ErrorValue = styled.span`
  color: ${theme.colors.red800};
  word-break: break-word;
`;

export let GroupWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export let GroupTrigger = styled(EntryWrapper).attrs({
  as: 'button',
  type: 'button'
})`
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  color: ${theme.colors.gray600};

  > span {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
`;

export let GroupTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  color: ${theme.colors.gray600};

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }
`;

export let GroupActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  color: ${theme.colors.gray600};

  time {
    font-size: 13px;
  }
`;

export let GroupContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 30px;
`;

export let AnimatedGroupContent = styled(motion.div)`
  overflow: hidden;
`;

export let MessageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export let SummaryTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-wrap: wrap;

  strong {
    font-weight: 600;
    color: ${theme.colors.gray900};
  }
`;

export let OverviewStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export let OverviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let CapabilityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let OverviewHint = styled.div`
  font-size: 12px;
  color: ${theme.colors.gray700};
`;

export let OverviewEntityIcon = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray300};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray700};

  svg {
    width: 16px;
    height: 16px;
  }
`;

export let ResourceMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  color: ${theme.colors.gray700};
  align-items: center;
`;

export let ResourceMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  strong {
    font-weight: 600;
    color: ${theme.colors.gray800};
  }
`;

export let MetaCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};

  [data-error='true'] & {
    border-color: ${theme.colors.red600};
    background: ${theme.colors.red200};
  }
`;

export let MetaHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
`;

export let MetaDescription = styled.div`
  font-size: 12px;
  line-height: 1.45;
  color: ${theme.colors.gray800};
  word-break: break-word;
`;

export let MediaWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
`;

export let MediaPreview = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 320px;
    border-radius: 6px;
    display: block;
  }

  audio {
    width: 100%;
  }
`;

export let MessageBlockWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

export let MessageBlockHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${theme.colors.gray700};

  svg {
    width: 14px;
    height: 14px;
  }
`;

export let ResourceLinkRow = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  color: ${theme.colors.gray800};
  font-size: 12px;
  text-decoration: none;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

export let StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;

  &[data-variant='error'] {
    background: ${theme.colors.red100};
    color: ${theme.colors.red800};
    border: 1px solid ${theme.colors.red300};
  }

  &[data-variant='success'] {
    background: ${theme.colors.green100};
    color: ${theme.colors.green800};
    border: 1px solid ${theme.colors.green300};
  }
`;

export let BlockStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
