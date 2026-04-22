import { Badge, theme } from '@metorial/ui';
import styled from 'styled-components';

export let SectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

export let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export let SectionHeading = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export let SectionSubHeading = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.gray600};
  letter-spacing: 0.04em;
`;

export let Card = styled.div`
  padding: 14px 16px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
`;

export let RequestList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export let RequestCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.background};
`;

export let RequestTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

export let RequestMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: ${theme.colors.gray600};
`;

export let RequestMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

export let Url = styled.code`
  flex: 1 1 auto;
  min-width: 0;
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 6px;
  padding: 6px 8px;
  color: ${theme.colors.foreground};
  word-break: break-all;
`;

export let Divider = styled.div`
  height: 1px;
  background: ${theme.colors.gray300};
`;

export let ExchangeSide = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export let ExchangeLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${theme.colors.gray700};

  svg {
    width: 12px;
    height: 12px;
  }
`;

export let MethodBadge = styled(Badge)``;

export let HeadersCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
  padding: 12px 14px;

  dt {
    font-family:
      'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: ${theme.colors.gray700};
  }

  dd {
    font-family:
      'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    word-break: break-all;
  }
`;

export let ContentTypeTag = styled.span`
  display: inline-flex;
  align-items: center;
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray200};
  border-radius: 4px;
  padding: 2px 6px;
`;

export let BodySubHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
