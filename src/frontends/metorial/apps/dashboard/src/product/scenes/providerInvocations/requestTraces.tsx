import { CodeBlock } from '@metorial/code';
import { Badge, Datalist, RenderDate, Text } from '@metorial/ui';
import { RiArrowDownLine, RiArrowUpLine, RiTimeLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import {
  formatDuration,
  formatJsonTextForDisplay,
  getMethodBadgeColor,
  getResponseBadgeColor,
  headersToItems,
  isEmptyValue,
  normalizeContentType,
  prismLanguageForContentType,
  renderJsonCodeBlock
} from './helpers';
import {
  BodySubHeader,
  ContentTypeTag,
  Divider,
  ExchangeLabel,
  ExchangeSide,
  HeadersCard,
  MethodBadge,
  RequestCard,
  RequestList,
  RequestMeta,
  RequestMetaItem,
  RequestTopRow,
  Section,
  SectionHeading,
  SectionSubHeading,
  Url
} from './styled';

let renderStructuredBody = (body: any): ReactNode => {
  let contentType: string | null = null;
  let raw: unknown = body;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if ('contentType' in body || 'text' in body) {
      contentType = normalizeContentType((body as any).contentType);
      raw = (body as any).text ?? (body as any).body ?? null;
    }
  }

  let tag = contentType ? <ContentTypeTag>{contentType}</ContentTypeTag> : null;

  if (contentType === 'application/x-www-form-urlencoded' && typeof raw === 'string') {
    let params: { label: ReactNode; value: ReactNode }[] = [];
    try {
      let searchParams = new URLSearchParams(raw);
      searchParams.forEach((value, key) => {
        params.push({ label: key, value });
      });
    } catch {}

    if (params.length > 0) {
      return (
        <>
          <BodySubHeader>
            <SectionSubHeading>Body</SectionSubHeading>
            {tag}
          </BodySubHeader>
          <HeadersCard>
            <Datalist items={params} />
          </HeadersCard>
        </>
      );
    }
  }

  if (contentType?.includes('json') && typeof raw === 'string') {
    let formattedJson = formatJsonTextForDisplay(raw);

    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <CodeBlock
          lineNumbers={false}
          code={formattedJson.code}
          language="json"
          padding="12px"
        />
      </>
    );
  }

  if (typeof raw === 'string') {
    return (
      <>
        <BodySubHeader>
          <SectionSubHeading>Body</SectionSubHeading>
          {tag}
        </BodySubHeader>
        <CodeBlock
          lineNumbers={false}
          code={raw}
          language={prismLanguageForContentType(contentType)}
          padding="12px"
        />
      </>
    );
  }

  return (
    <>
      <BodySubHeader>
        <SectionSubHeading>Body</SectionSubHeading>
        {tag}
      </BodySubHeader>
      {renderJsonCodeBlock(raw)}
    </>
  );
};

let ExchangePart = ({
  label,
  icon,
  headers,
  body
}: {
  label: string;
  icon: ReactNode;
  headers: unknown;
  body: unknown;
}) => {
  let hasHeaders = !isEmptyValue(headers);
  let hasBody = !isEmptyValue(body);
  let headerItems = hasHeaders ? headersToItems(headers) : null;

  if (!hasHeaders && !hasBody) {
    return (
      <ExchangeSide>
        <ExchangeLabel>
          {icon}
          {label}
        </ExchangeLabel>
        <Text size="1" color="gray600">
          No payload captured.
        </Text>
      </ExchangeSide>
    );
  }

  return (
    <ExchangeSide>
      <ExchangeLabel>
        {icon}
        {label}
      </ExchangeLabel>

      {headerItems ? (
        <ExchangeSide>
          <SectionSubHeading>Headers</SectionSubHeading>
          <HeadersCard>
            <Datalist items={headerItems} />
          </HeadersCard>
        </ExchangeSide>
      ) : hasHeaders ? (
        <ExchangeSide>
          <SectionSubHeading>Headers</SectionSubHeading>
          {renderJsonCodeBlock(headers)}
        </ExchangeSide>
      ) : null}

      {hasBody ? <ExchangeSide>{renderStructuredBody(body)}</ExchangeSide> : null}
    </ExchangeSide>
  );
};

export let RequestTraces = ({ requestTraces }: { requestTraces: any[] }) => {
  if (!requestTraces?.length) return null;

  return (
    <Section>
      <SectionHeading>
        <span>External Request{requestTraces.length > 1 ? 's' : ''}</span>
        <Text size="1" color="gray600">
          {requestTraces.length} captured
        </Text>
      </SectionHeading>

      <RequestList>
        {requestTraces.map((trace, index) => {
          let method = trace?.request?.method;
          let url = trace?.request?.url;
          let responseStatus = trace?.response?.status;
          let responseStatusText = trace?.response?.statusText;
          let duration = formatDuration(trace?.durationMs);

          return (
            <RequestCard key={`${trace?.startedAt ?? 'trace'}-${index}`}>
              <RequestTopRow>
                <MethodBadge color={getMethodBadgeColor(method)}>
                  {method ?? 'REQUEST'}
                </MethodBadge>
                {url ? <Url>{url}</Url> : null}
                {typeof responseStatus === 'number' ? (
                  <Badge color={getResponseBadgeColor(responseStatus)}>
                    {responseStatus}
                    {responseStatusText ? ` ${responseStatusText}` : ''}
                  </Badge>
                ) : null}
              </RequestTopRow>

              <RequestMeta>
                {duration ? (
                  <RequestMetaItem>
                    <RiTimeLine size={12} />
                    {duration}
                  </RequestMetaItem>
                ) : null}
                {trace?.startedAt ? (
                  <RequestMetaItem>
                    <RenderDate date={new Date(trace.startedAt)} />
                  </RequestMetaItem>
                ) : null}
              </RequestMeta>

              <Divider />

              <ExchangePart
                label="Request"
                icon={<RiArrowUpLine />}
                headers={trace?.request?.headers}
                body={trace?.request?.body}
              />

              <ExchangePart
                label="Response"
                icon={<RiArrowDownLine />}
                headers={trace?.response?.headers}
                body={trace?.response?.body}
              />
            </RequestCard>
          );
        })}
      </RequestList>
    </Section>
  );
};
