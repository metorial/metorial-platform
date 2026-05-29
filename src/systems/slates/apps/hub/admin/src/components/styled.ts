import { Flex } from '@metorial/ui';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';

export let EmptyState = styled(Flex)`
  padding: 80px 40px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  text-align: center;
`;

export let MonoText = styled.span`
  font-family: monospace;
`;

export let MonoCode = styled.code`
  font-family: monospace;
  font-size: 12px;
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
`;

export let FormWrapper = styled.div`
  max-width: 480px;
`;

export let SlateLogoImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  background: #f1f5f9;
`;

export let SlateLogoPlaceholder = styled(Flex)`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  font-size: 16px;
  color: #94a3b8;
`;

export let LogViewer = styled.div`
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 16px;
  border-radius: 8px;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

export let LogLine = styled.div<{ $type?: 'error' | 'warning' | 'success' }>`
  ${p => p.$type === 'error' && 'color: #f87171;'}
  ${p => p.$type === 'warning' && 'color: #fbbf24;'}
  ${p => p.$type === 'success' && 'color: #4ade80;'}
`;

export let SectionHeader = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
`;

export let DetailSection = styled.div`
  margin-bottom: 24px;
`;

export let TextLink = styled(Link)`
  font-size: 13px;
  color: #2563eb;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export let FilterButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${p => (p.$active ? '#3b82f6' : '#e2e8f0')};
  border-radius: 6px;
  background: ${p => (p.$active ? '#eff6ff' : '#fff')};
  color: ${p => (p.$active ? '#3b82f6' : '#64748b')};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: ${p => (p.$active ? '#3b82f6' : '#cbd5e1')};
  }
`;
