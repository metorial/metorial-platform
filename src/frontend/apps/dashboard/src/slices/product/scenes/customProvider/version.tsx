import React from 'react';
import {
  DashboardInstanceCustomProvidersGetOutput,
  DashboardInstanceCustomProvidersVersionsGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCustomProviderDeployment,
  useCustomProviderDeploymentLogs,
  useCustomProviderVersion
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  CenteredSpinner,
  Group,
  RenderDate,
  Spacer,
  Text,
  theme,
  Tooltip
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

const CUSTOM_SERVER_VERSION_STATUS_BADGES = {
  current: <Badge color="blue">Current</Badge>,
  available: <Badge color="gray">Available</Badge>,
  deployment_succeeded: <Badge color="gray">Available</Badge>,
  succeeded: <Badge color="gray">Available</Badge>,
  queued: <Badge color="orange">Deploying</Badge>,
  deploying: <Badge color="orange">Deploying</Badge>,
  failed: <Badge color="red">Deployment Failed</Badge>,
  deployment_failed: <Badge color="red">Deployment Failed</Badge>
} satisfies Record<string, React.ReactNode>;

const CUSTOM_SERVER_VERSION_STATUS_BADGES_BY_KEY: Record<string, React.ReactNode> =
  CUSTOM_SERVER_VERSION_STATUS_BADGES;

export let CustomServerVersionStatus = ({
  version
}: {
  version: DashboardInstanceCustomProvidersVersionsGetOutput;
}) => {
  let status =
    CUSTOM_SERVER_VERSION_STATUS_BADGES_BY_KEY[version.status ?? ''] ?? version.status;

  let isCurrentForEnvironment = version.environments?.some(
    environment => environment.isCurrentVersionForEnvironment
  );

  if (!isCurrentForEnvironment) {
    return status;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {status}
      <Badge color="blue">Current</Badge>
    </span>
  );
};

export let CustomServerVersion = ({
  versionId,
  customServer
}: {
  versionId: string;
  customServer: DashboardInstanceCustomProvidersGetOutput | undefined | null;
}) => {
  let instance = useCurrentInstance();
  let version = useCustomProviderVersion(
    instance.data?.id,
    customServer?.id ?? versionId,
    versionId
  );
  let deployment = useCustomProviderDeployment(
    instance.data?.id,
    customServer?.id,
    version.data?.deployment?.id
  );
  let deploymentLogs = useCustomProviderDeploymentLogs(
    instance.data?.id,
    customServer?.id,
    version.data?.deployment?.id,
    deployment.data?.status
  );

  let logsData = deploymentLogs.data;
  let steps: Step[] = (() => {
    if (logsData?.steps && logsData.steps.length > 0) {
      let rawSteps = logsData.steps.map((s, i) => ({
        id: s.id ?? `step-${i}`,
        type: s.type ?? 'unknown',
        status: s.status ?? deploymentStatusToStepStatus(deployment.data?.status),
        index: i,
        logs: (s.logs ?? []).map(l => ({
          type: 'info',
          line: l.message ?? '',
          timestamp: l.timestamp ?? null
        }))
      }));

      let activeSteps = rawSteps.filter(
        s => s.logs.length > 0 || s.status === 'running' || s.status === 'failed'
      );

      let merged: Step[] = [];
      for (let step of activeSteps) {
        let prev = merged[merged.length - 1];
        if (prev && prev.type === step.type) {
          prev.logs = [...prev.logs, ...step.logs];
          if (step.status === 'failed') prev.status = 'failed';
          else if (step.status === 'running' && prev.status !== 'failed')
            prev.status = 'running';
        } else {
          merged.push({ ...step, index: merged.length });
        }
      }

      return merged;
    }

    return [];
  })();

  return renderWithLoader({ version, deployment })(({ version, deployment }) => (
    <>
      <Attributes
        attributes={[
          { label: 'Version', content: <ID id={String(version.data.index ?? '')} /> },
          { label: 'Version ID', content: <ID id={version.data.id} /> },
          {
            label: 'Provider ID',
            content: version.data.providerId ? (
              <ID id={version.data.providerId} />
            ) : (
              <span style={{ color: theme.colors.gray600 }}>N/A</span>
            )
          },
          { label: 'Status', content: <CustomServerVersionStatus version={version.data} /> },
          { label: 'Created By', content: deployment.data.actor?.name ?? 'Unknown' },
          { label: 'Created', content: <RenderDate date={version.data.createdAt} /> }
        ]}
      />

      <Spacer height={15} />

      {deployment.data.commit && (
        <>
          <Attributes
            itemWidth="400px"
            attributes={[
              {
                label: 'Commit',
                content: deployment.data.commit.message ?? 'N/A'
              },
              {
                label: 'Type',
                content: deployment.data.commit.type ?? 'N/A'
              }
            ]}
          />

          <Spacer height={15} />
        </>
      )}

      <Group.Wrapper>
        <Group.Header
          title="Deployment Details"
          description="Details about the deployment of this version."
        />

        {deploymentLogs.isLoading && steps.length === 0 && (
          <Group.Row>
            <CenteredSpinner />
          </Group.Row>
        )}

        {steps.map(step => (
          <StepDetails key={step.id} step={step} />
        ))}

        {!deploymentLogs.isLoading && steps.length === 0 && (
          <Group.Row>
            <StepEmptyState>
              <Text size="2" color="gray600">
                No deployment logs available yet.
              </Text>
            </StepEmptyState>
          </Group.Row>
        )}
      </Group.Wrapper>

      <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />
    </>
  ));
};

type Step = {
  id: string;
  type: string;
  status: string;
  index: number;
  logs: { type: string; line: string; timestamp: Date | null }[];
};

let deploymentStatusToStepStatus = (status: string | null | undefined): string =>
  (
    ({
      queued: 'running',
      deploying: 'running',
      failed: 'failed',
      deployed: 'completed',
      completed: 'completed',
      succeeded: 'completed'
    }) as Record<string, string>
  )[status ?? ''] ?? 'completed';

let stepTypeLabels: Record<string, string> = {
  started: 'Deployment Started',
  remote_server_connection_test: 'Remote Provider Connection Test',
  remote_oauth_auto_discovery: 'Remote OAuth Auto Discovery',
  deploying: 'Deploying Provider',
  deployed: 'Deployment Completed',
  lambda_deploy_create: 'Creating Managed Deployment',
  lambda_deploy_publish: 'Publishing Managed Deployment',
  lambda_deploy_build: 'Building Managed Deployment',
  build: 'Building',
  deploy: 'Deploying',
  discover: 'Discovering Provider Capabilities',
  discovering: 'Discovering Provider Capabilities'
};

let StepWrapper = styled.div`
  padding: 15px;
  display: flex;
  flex-direction: column;
`;

let StepHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: default;
`;

let StepHeaderMain = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

let StepHeaderTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  color: ${theme.colors.gray800};
`;

let StepHeaderExcerptWrapper = styled(motion.div)`
  position: relative;
  flex-grow: 1;
`;

let StepHeaderExcerptLine = styled(motion.div)`
  font-size: 12px;
  color: ${theme.colors.gray600};
  position: absolute;
  top: 5px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
`;

let StepHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

let StepLogs = styled(motion.div)`
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  max-height: 400px;
  overflow-y: auto;
`;

let StepEmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 15px;
`;

let StepLogLine = styled.div`
  display: grid;
  grid-template-columns: 100px auto;
  padding: 7px 15px;
  transition: background 0.2s;
  cursor: default;

  &:hover {
    background: ${theme.colors.gray300};
  }
`;

let StepLogTs = styled.span`
  color: ${theme.colors.gray600};
  font-size: 12px;
  margin-right: 10px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
`;

let StepLogLineContent = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray800};
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', monospace;
`;

let StepDetails = ({ step }: { step: Step }) => {
  let [isExpanded, setIsExpanded] = useState(false);
  let logsRef = useRef<HTMLDivElement>(null);
  let logCountRef = useRef(step.logs.length);

  let currentLine = (() => {
    for (let i = step.logs.length - 1; i >= 0; i--) {
      if (step.logs[i].line.trim()) return step.logs[i].line;
    }
    return undefined;
  })();

  useEffect(() => {
    if (step.status == 'running' || step.status == 'failed') {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [step.status]);

  useEffect(() => {
    if (step.logs.length > logCountRef.current && logsRef.current && isExpanded) {
      logsRef.current.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
    }
    logCountRef.current = step.logs.length;
  }, [step.logs.length, isExpanded]);

  return (
    <Group.Row>
      <StepWrapper
        onClick={() => {
          if (isExpanded) return;
          setIsExpanded(true);
        }}
      >
        <StepHeader>
          <StepHeaderMain>
            <StepHeaderTitle
              style={{
                color: step.status == 'failed' ? theme.colors.red700 : undefined
              }}
            >
              {stepTypeLabels[step.type] ?? step.type}
            </StepHeaderTitle>

            <AnimatePresence>
              {currentLine && !isExpanded && (
                <StepHeaderExcerptWrapper
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 20 }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AnimatePresence>
                    <StepHeaderExcerptLine
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      key={currentLine}
                    >
                      {currentLine}
                    </StepHeaderExcerptLine>
                  </AnimatePresence>
                </StepHeaderExcerptWrapper>
              )}
            </AnimatePresence>
          </StepHeaderMain>

          <StepHeaderActions>
            <Tooltip content="Expand step details">
              <Button
                iconLeft={
                  <RiArrowDownSLine
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                  />
                }
                variant="soft"
                size="1"
                onClick={e => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              />
            </Tooltip>
          </StepHeaderActions>
        </StepHeader>
      </StepWrapper>

      <AnimatePresence>
        {isExpanded && (
          <StepLogs
            ref={logsRef}
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            onAnimationComplete={() => {
              if (logsRef.current) {
                logsRef.current.scrollTo({ top: logsRef.current.scrollHeight });
              }
            }}
          >
            <Spacer height={5} />
            {step.logs.length === 0 && step.status === 'running' && (
              <StepEmptyState>
                <CenteredSpinner size={16} />
                <Text size="1" color="gray600">
                  Waiting for output...
                </Text>
              </StepEmptyState>
            )}
            {step.logs.map((log, index) => (
              <StepLogLine key={index} data-log-type={log.type}>
                <StepLogTs>{log.timestamp?.toLocaleTimeString() ?? '--:--:--'}</StepLogTs>
                <StepLogLineContent>{log.line}</StepLogLineContent>
              </StepLogLine>
            ))}
            <Spacer height={5} />
          </StepLogs>
        )}
      </AnimatePresence>
    </Group.Row>
  );
};
