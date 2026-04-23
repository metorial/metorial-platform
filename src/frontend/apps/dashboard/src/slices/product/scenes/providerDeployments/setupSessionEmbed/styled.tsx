import { theme } from '@metorial/ui';
import styled from 'styled-components';

export let ManagedCredentialsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
`;

export let ManagedCredentialsColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

export let ManagedCredentialsPreview = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 20px;
  border-left: 1px solid ${theme.colors.gray300};
  align-self: stretch;

  @media (max-width: 800px) {
    padding-left: 0;
    padding-top: 16px;
    border-left: none;
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

export let ManagedCredentialsPreviewFrame = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  min-height: 100%;
`;

export let ManagedCredentialsPreviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export let ManagedCredentialsMetaRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

export let SummaryField = styled.div`
  display: flex;
  flex-direction: column;
`;

export let SummaryFieldValue = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray300};
`;

export let SummaryFieldMeta = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

export let ManagedCredentialsPreviewBrand = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

export let ManagedCredentialsPreviewBrandImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

export let ManagedCredentialsPreviewConnection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
`;

export let ManagedCredentialsPreviewConnector = styled.div`
  flex: 1;
  height: 1px;
  background: ${theme.colors.gray300};
`;

export let ManagedCredentialsPreviewAction = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  background: ${theme.colors.gray900};
  color: ${theme.colors.background};
  font-size: 14px;
  font-weight: 600;
`;

export let ManagedCredentialsPreviewTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export let ManagedCredentialsPreviewCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed ${theme.colors.gray400};
  background: ${theme.colors.background};
`;

export let FlatConnectForm = styled.div`
  display: flex;
  flex-direction: column;
`;

export let FlatConnectSection = styled.section`
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 14px;
  margin-top: 15px;
  border: 1px solid ${theme.colors.gray300};
`;

export let FlatInlineField = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 15px;
`;
