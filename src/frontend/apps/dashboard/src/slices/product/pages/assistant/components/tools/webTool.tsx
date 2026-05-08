import type { AssistantLiveStateItem } from '@metorial/state';
import { Error, theme } from '@metorial/ui';
import { Fragment } from 'react/jsx-runtime';
import styled from 'styled-components';
import {
  JsonBlock,
  ScrollSection,
  ToolContentStack,
  ToolDisclosureCard,
  ToolSection,
  ToolSectionLabel
} from './shared';

type WebItem = Extract<AssistantLiveStateItem, { type: 'web' }>;

let OperationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let OperationCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.blue800} 16%, transparent);
  background: color-mix(in srgb, ${theme.colors.blue800} 4%, ${theme.colors.background});
  box-shadow: inset 0 0 0 1px color-mix(in srgb, ${theme.colors.blue800} 4%, transparent);
`;

let OperationTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

let OperationTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let WebStepBadge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, ${theme.colors.blue800} 10%, transparent);
  color: ${theme.colors.blue800};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

let OperationDetail = styled.div`
  font-size: 12px;
  line-height: 1.5;
  color: color-mix(in srgb, ${theme.colors.foreground} 60%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
`;

let ResultList = styled.div`
  display: flex;
  flex-direction: column;
`;

let ResultRow = styled.a`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  text-decoration: none;
  color: inherit;

  & + & {
    border-top: 1px solid color-mix(in srgb, ${theme.colors.foreground} 8%, transparent);
  }

  &:hover {
    background: color-mix(in srgb, ${theme.colors.blue800} 4%, transparent);
  }
`;

let ResultTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${theme.colors.foreground};
`;

let ResultUrl = styled.div`
  font-size: 11px;
  color: ${theme.colors.blue800};
  word-break: break-all;
`;

let ResultDescription = styled.div`
  font-size: 12px;
  line-height: 1.5;
  color: color-mix(in srgb, ${theme.colors.foreground} 60%, transparent);
`;

let getStatus = (item: WebItem): 'running' | 'completed' | 'failed' => {
  return item.operations.some(operation => operation.status == 'failed')
    ? 'failed'
    : item.operations.some(operation => operation.status == 'running')
      ? 'running'
      : 'completed';
};

let getSummary = (item: WebItem) => {
  let status = getStatus(item);
  let resultCount = item.operations.reduce(
    (total, operation) =>
      total + (operation.type == 'search' ? (operation.results?.length ?? 0) : 0),
    0
  );
  let searchCount = item.operations.filter(operation => operation.type == 'search').length;
  let fetchCount = item.operations.filter(operation => operation.type == 'fetch').length;

  if (status == 'running') {
    if (searchCount && fetchCount) return 'Browsing the web';
    if (searchCount) return 'Searching the web';
    return 'Fetching web content';
  }

  if (resultCount > 0) {
    return `Found ${resultCount} web result${resultCount == 1 ? '' : 's'}`;
  }

  if (fetchCount > 0) return 'Fetched web content';
  return 'Searched the web';
};

let getSecondaryText = (item: WebItem) => {
  let firstSearch = item.operations.find(operation => operation.type == 'search');
  if (firstSearch?.query) return firstSearch.query;

  let firstFetch = item.operations.find(operation => operation.type == 'fetch');
  if (firstFetch?.url) {
    return firstFetch.url.length > 72 ? `${firstFetch.url.slice(0, 69)}...` : firstFetch.url;
  }

  return null;
};

export let WebToolCard = (p: { item: WebItem }) => {
  let item = p.item;
  let status = getStatus(item);

  return (
    <ToolDisclosureCard
      summary={getSummary(item)}
      secondaryText={getSecondaryText(item)}
      status={status}
      defaultOpen={status != 'completed'}
      autoCollapseOnComplete={!item.operations.some(operation => operation.status == 'failed')}
    >
      <ToolContentStack>
        <OperationList>
          {item.operations.map(operation => (
            <Fragment key={operation.id}>
              {operation.type == 'search' && (
                <>
                  {!!operation.results?.length && (
                    <ToolSection>
                      <ScrollSection>
                        <ResultList>
                          {operation.results.map(result => (
                            <ResultRow
                              key={`${operation.id}:${result.url}`}
                              href={result.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ResultTitle>{result.title}</ResultTitle>
                              <ResultUrl>{result.url}</ResultUrl>
                              {result.description && (
                                <ResultDescription>{result.description}</ResultDescription>
                              )}
                            </ResultRow>
                          ))}
                        </ResultList>
                      </ScrollSection>
                    </ToolSection>
                  )}
                </>
              )}

              {operation.type == 'fetch' && operation.content && (
                <ToolSection>
                  <ToolSectionLabel>Content</ToolSectionLabel>
                  <JsonBlock value={operation.content} language="markdown" />
                </ToolSection>
              )}

              {operation.error && <Error>{operation.error.message}</Error>}
            </Fragment>
          ))}
        </OperationList>
      </ToolContentStack>
    </ToolDisclosureCard>
  );
};
