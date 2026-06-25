import { styled } from 'styled-components';
import { Flex } from '@metorial-io/ui';

// Empty state container used in list pages
export let EmptyState = styled(Flex)`
  padding: 80px 40px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  text-align: center;
`;

// Monospace text for identifiers
export let MonoText = styled.span`
  font-family: monospace;
`;

// Monospace code block with background
export let MonoCode = styled.code`
  font-family: monospace;
  font-size: 12px;
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
`;

// Form content wrapper with max width
export let FormWrapper = styled.div`
  max-width: 480px;
`;

// File input styling
export let FileInput = styled.input`
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  transition: all 0.15s;

  &:hover {
    border-color: #cbd5e1;
  }

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::file-selector-button {
    padding: 6px 12px;
    margin-right: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
    color: #374151;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: #f1f5f9;
    }
  }
`;

// Slate logo image
export let SlateLogoImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  background: #f1f5f9;
`;

// Slate logo placeholder
export let SlateLogoPlaceholder = styled(Flex)`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  font-size: 16px;
  color: #94a3b8;
`;
