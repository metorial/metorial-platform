import { CodeBlock } from '@metorial/code';
import { Callout, theme, useCopy } from '@metorial/ui';
import {
  RiCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiKey2Line,
  RiLinkM
} from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useMemo, useRef, useState } from 'react';
import { useScroll } from 'react-use';
import styled, { css, keyframes } from 'styled-components';
import { ConnectionType, connectionTypes } from './connectionTypes';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

let SectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let CredentialGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let CredentialCard = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: ${theme.colors.gray400};
    box-shadow: 0 6px 24px -12px rgba(0, 0, 0, 0.12);
  }
`;

let CredentialIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.primary600};
  background: linear-gradient(
    135deg,
    ${theme.colors.primary100} 0%,
    ${theme.colors.iris300} 100%
  );
  border: 1px solid ${theme.colors.primary200};
`;

let CredentialBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

let CredentialLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.gray600};
`;

let CredentialValue = styled.code`
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  padding: 4px 8px;
  color: ${theme.colors.gray900};
  background: ${theme.colors.gray100};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

let CredentialActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

let IconButton = styled.button<{ $success?: boolean }>`
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  color: ${theme.colors.gray700};
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    background: ${theme.colors.gray200};
    border-color: ${theme.colors.gray300};
    color: ${theme.colors.gray900};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: transparent;
    border-color: transparent;
    color: ${theme.colors.gray700};
  }

  ${p =>
    p.$success &&
    css`
      color: ${theme.colors.green900};
      background: ${theme.colors.green200};
      border-color: ${theme.colors.green400};

      &:hover {
        color: ${theme.colors.green900};
        background: ${theme.colors.green200};
        border-color: ${theme.colors.green400};
      }
    `}
`;

let ClientScroller = styled.div`
  position: relative;
`;

let ClientScrollArea = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 4px;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.gray300};
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.gray400};
  }
`;

let ClientScrollShadow = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 48px;
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.2s ease;

  ${p =>
    p.$side === 'left'
      ? css`
          left: 0;
          background: linear-gradient(
            to right,
            #fff 0%,
            rgba(255, 255, 255, 0) 100%
          );
        `
      : css`
          right: 0;
          background: linear-gradient(
            to left,
            #fff 0%,
            rgba(255, 255, 255, 0) 100%
          );
        `}
`;

let ClientChip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  position: relative;
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  background: #fff;
  transition: all 0.2s ease;
  overflow: hidden;
  height: 40px;
  padding: 0 20px;

  &:hover {
    border-color: ${theme.colors.gray500};
    box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.15);
  }

  ${p =>
    p.$active &&
    css`
      border-color: transparent;
      box-shadow:
        0 0 0 1.5px ${theme.colors.gray900},
        0 10px 24px -14px rgba(0, 0, 0, 0.3);

      &:hover {
        border-color: transparent;
        box-shadow:
          0 0 0 1.5px ${theme.colors.gray900},
          0 10px 24px -14px rgba(0, 0, 0, 0.3);
      }
    `}
`;

let ClientLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray900};
  text-align: center;
  line-height: 1.2;
`;

let Timeline = styled.ol`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let TimelineStep = styled(motion.li)`
  position: relative;
  display: grid;
  grid-template-columns: 32px 1fr;
  column-gap: 14px;
`;

let TimelineRail = styled.div`
  position: relative;
  display: flex;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 30px;
    bottom: -16px;
    width: 1.5px;
    background: linear-gradient(
      180deg,
      ${theme.colors.gray400} 0%,
      ${theme.colors.gray300} 100%
    );
  }

  ${TimelineStep}:last-child &::before {
    display: none;
  }
`;

let TimelineNumber = styled.div`
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: ${theme.colors.gray900};
  background: #fff;
  border: 1.5px solid ${theme.colors.gray400};
  box-shadow: 0 2px 6px -4px rgba(0, 0, 0, 0.25);
`;

let TimelineBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
  padding-top: 3px;
`;

let TimelineText = styled.div`
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray900};

  code {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    padding: 1px 6px;
    background: ${theme.colors.gray200};
    border: 1px solid ${theme.colors.gray300};
    border-radius: 5px;
  }
`;

let CodeCard = styled.div`
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  background: #fff;
  box-shadow: 0 6px 18px -14px rgba(0, 0, 0, 0.25);
`;

let CodeCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 6px 14px;
  background: ${theme.colors.gray100};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let CodeCardLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let CodeLanguageDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.$color};
  box-shadow: 0 0 0 2px ${theme.colors.gray200};
`;

let CodeCardBody = styled.div`
  & > div {
    border: none !important;
    border-radius: 0 !important;
  }

  pre {
    white-space: pre-wrap !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
`;

let pulse = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

let Pending = styled.span`
  display: inline-block;
  animation: ${pulse} 1.4s ease-in-out infinite;
  color: ${theme.colors.gray500};
`;

let languageDotColor: Record<string, string> = {
  bash: '#4ade80',
  shell: '#4ade80',
  sh: '#4ade80',
  json: '#fbbf24',
  typescript: '#3b82f6',
  javascript: '#f7df1e'
};

let LuxeCodeBlock = ({
  code,
  language = 'bash',
  label
}: {
  code: string;
  language?: string;
  label?: string;
}) => {
  let copy = useCopy();
  let dotColor = languageDotColor[language] ?? theme.colors.gray500;

  return (
    <CodeCard>
      <CodeCardHeader>
        <CodeCardLabel>
          <CodeLanguageDot $color={dotColor} />
          {label ?? language}
        </CodeCardLabel>
        <IconButton
          type="button"
          aria-label="Copy"
          onClick={() => copy.copy(code)}
          $success={copy.copied}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copy.copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-flex' }}
              >
                <RiCheckLine size={15} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-flex' }}
              >
                <RiFileCopyLine size={15} />
              </motion.span>
            )}
          </AnimatePresence>
        </IconButton>
      </CodeCardHeader>

      <CodeCardBody>
        <CodeBlock code={code} language={language} lineNumbers={false} />
      </CodeCardBody>
    </CodeCard>
  );
};

let CredentialRow = ({
  label,
  value,
  copyValue,
  icon,
  secret
}: {
  label: string;
  value: string;
  copyValue: string;
  icon: ReactNode;
  secret?: boolean;
}) => {
  let copy = useCopy();
  let [revealed, setRevealed] = useState(false);

  let hasValue = value && value !== '...';
  let shouldMask = secret && hasValue && !revealed;
  let displayValue = shouldMask ? '•'.repeat(Math.min(Math.max(value.length, 12), 40)) : value;

  return (
    <CredentialCard>
      <CredentialIcon>{icon}</CredentialIcon>

      <CredentialBody>
        <CredentialLabel>{label}</CredentialLabel>
        <CredentialValue title={hasValue && !shouldMask ? value : undefined}>
          {hasValue ? displayValue : <Pending>waiting...</Pending>}
        </CredentialValue>
      </CredentialBody>

      <CredentialActions>
        {secret && hasValue && (
          <IconButton
            type="button"
            aria-label={revealed ? 'Hide value' : 'Reveal value'}
            onClick={() => setRevealed(r => !r)}
          >
            {revealed ? <RiEyeOffLine size={15} /> : <RiEyeLine size={15} />}
          </IconButton>
        )}
        <IconButton
          type="button"
          aria-label="Copy"
          disabled={!hasValue}
          onClick={() => hasValue && copy.copy(copyValue || value)}
          $success={copy.copied}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copy.copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-flex' }}
              >
                <RiCheckLine size={15} />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-flex' }}
              >
                <RiFileCopyLine size={15} />
              </motion.span>
            )}
          </AnimatePresence>
        </IconButton>
      </CredentialActions>
    </CredentialCard>
  );
};

type McpConnectionInstructionsSceneProps = {
  name?: string | null;
  endpointLabel?: string;
  endpointValue?: string | null;
  endpointCopyValue?: string;
  tokenLabel?: string;
  tokenValue?: string | null;
  tokenCopyValue?: string;
  snippetUrl?: string | null;
  snippetToken?: string | null;
  emptyState?: ReactNode;
};

export let McpConnectionInstructionsScene = ({
  name,
  endpointLabel = 'Endpoint',
  endpointValue,
  endpointCopyValue,
  tokenLabel,
  tokenValue,
  tokenCopyValue,
  snippetUrl,
  snippetToken,
  emptyState
}: McpConnectionInstructionsSceneProps) => {
  let [tab, setTab] = useState<ConnectionType>('cursor');

  let connection = useMemo(() => {
    if (!snippetUrl || !snippetToken) return null;
    return connectionTypes[tab].getConnection({
      name,
      url: snippetUrl,
      token: snippetToken
    });
  }, [name, snippetToken, snippetUrl, tab]);

  let activeName = connectionTypes[tab].name;

  let clientScrollRef = useRef<HTMLDivElement>(null);
  let clientScroll = useScroll(clientScrollRef as any);
  let scrollLeftVisible = clientScroll.x > 4;
  let scrollRightVisible = (() => {
    let el = clientScrollRef.current;
    if (!el) return true;
    return clientScroll.x + el.clientWidth < el.scrollWidth - 4;
  })();

  return (
    <Wrapper>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Credentials</SectionLabel>

        <CredentialGroup>
          <CredentialRow
            label={endpointLabel}
            value={endpointValue ?? '...'}
            copyValue={endpointCopyValue ?? endpointValue ?? ''}
            icon={<RiLinkM size={16} />}
          />

          {tokenLabel && (
            <CredentialRow
              label={tokenLabel}
              value={tokenValue ?? '...'}
              copyValue={tokenCopyValue ?? tokenValue ?? ''}
              icon={<RiKey2Line size={16} />}
              secret
            />
          )}
        </CredentialGroup>
      </div>

      {connection ? (
        <>
          <div>
            <SectionLabel style={{ marginBottom: 10 }}>Choose your client</SectionLabel>

            <ClientScroller>
              <ClientScrollArea ref={clientScrollRef}>
                {(
                  Object.entries(connectionTypes) as [
                    ConnectionType,
                    (typeof connectionTypes)[ConnectionType]
                  ][]
                ).map(([id, value]) => {
                  let active = id === tab;
                  return (
                    <ClientChip
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      $active={active}
                      aria-pressed={active}
                    >
                      <ClientLabel>{value.name}</ClientLabel>
                    </ClientChip>
                  );
                })}
              </ClientScrollArea>

              <ClientScrollShadow
                $side="left"
                style={{ opacity: scrollLeftVisible ? 1 : 0 }}
              />
              <ClientScrollShadow
                $side="right"
                style={{ opacity: scrollRightVisible ? 1 : 0 }}
              />
            </ClientScroller>
          </div>

          <div>
            <SectionLabel style={{ marginBottom: 12 }}>Setup for {activeName}</SectionLabel>

            <Timeline>
              {connection.steps.map((step, idx) => (
                <TimelineStep
                  key={`${tab}-${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <TimelineRail>
                    <TimelineNumber>{idx + 1}</TimelineNumber>
                  </TimelineRail>

                  <TimelineBody>
                    <TimelineText>{step.text}</TimelineText>

                    {'command' in step && step.command && (
                      <LuxeCodeBlock code={step.command} language="bash" />
                    )}
                  </TimelineBody>
                </TimelineStep>
              ))}
            </Timeline>

            {'config' in connection && connection.config && (
              <motion.div
                key={`${tab}-config`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: connection.steps.length * 0.04
                }}
                style={{ marginTop: 14, marginLeft: 46 }}
              >
                <LuxeCodeBlock
                  code={JSON.stringify(connection.config, null, 2)}
                  language="json"
                  label="configuration"
                />
              </motion.div>
            )}
          </div>
        </>
      ) : (
        (emptyState ?? (
          <Callout color="gray">
            This connection is not ready yet. Once both an endpoint and token are available,
            client-specific setup instructions will appear here.
          </Callout>
        ))
      )}
    </Wrapper>
  );
};
