import {
  DashboardInstanceCustomServersDeploymentsGetOutput,
  DashboardInstanceCustomServersGetOutput,
  DashboardInstanceCustomServersVersionsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCustomServerDeployment,
  useCustomServerVersion
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Group,
  RenderDate,
  Spacer,
  theme,
  Tooltip
} from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { CustomServerEventsTable } from './events';

export let CustomServerVersionStatus = ({
  version
}: {
  version: DashboardInstanceCustomServersVersionsGetOutput;
}) =>
  ({
    current: <Badge color="blue">Current</Badge>,
    available: <Badge color="gray">Available</Badge>,
    deploying: <Badge color="orange">Deploying</Badge>,
    deployment_failed: <Badge color="red">Deployment Failed</Badge>
  })[version.status] ?? version.status;

export let CustomServerVersion = ({
  versionId,
  customServer
}: {
  versionId: string;
  customServer: DashboardInstanceCustomServersGetOutput | undefined | null;
}) => {
  let instance = useCurrentInstance();
  let version = useCustomServerVersion(
    instance.data?.id,
    customServer?.id ?? versionId,
    versionId
  );
  let deployment = useCustomServerDeployment(
    instance.data?.id,
    customServer?.id,
    version.data?.deploymentId
  );

  return renderWithLoader({ version, deployment })(({ version, deployment }) => (
    <>
      <Attributes
        attributes={[
          { label: 'Version', content: <ID id={`v${version.data.versionIndex}`} /> },
          { label: 'Version ID', content: <ID id={version.data.id} /> },
          {
            label: 'Server Version ID',
            content: version.data.serverVersion?.id ? (
              <ID id={version.data.serverVersion?.id} />
            ) : (
              <span style={{ color: theme.colors.gray600 }}>N/A</span>
            )
          },
          { label: 'Status', content: <CustomServerVersionStatus version={version.data} /> },
          { label: 'Created By', content: deployment.data.creatorActor.email },
          { label: 'Created', content: <RenderDate date={version.data.createdAt} /> }
        ]}
      />

      <Spacer height={15} />

      <Group.Wrapper>
        <Group.Header
          title="Deployment Details"
          description="Details about the deployment of this version."
        />

        {deployment.data.steps
          .sort((a, b) => a.index - b.index)
          .map(step => (
            <StepDetails key={step.id} step={step} />
          ))}
      </Group.Wrapper>

      {(version.data.status == 'current' || version.data.status == 'available') && (
        <>
          <Spacer height={15} />

          <Box title="Events" description="Important events related to this server version.">
            <CustomServerEventsTable
              customServer={customServer}
              filters={{ versionId, limit: 15, order: 'desc' }}
            />
          </Box>
        </>
      )}

      <link rel="stylesheet" href="https://fonts.metorial.com/jetbrains-mono.css" />
    </>
  ));
};

type Step = DashboardInstanceCustomServersDeploymentsGetOutput['steps'][number];

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

  let currentLine = step.logs[step.logs.length - 1]?.line;

  useEffect(() => {
    if (step.status == 'running' || step.status == 'failed') {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [step.status]);

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
              {
                {
                  started: 'Deployment Started',
                  remote_server_connection_test: 'Remote Server Connection Test',
                  remote_oauth_auto_discovery: 'Remote OAuth Auto Discovery',
                  deploying: 'Deploying Server',
                  deployed: 'Deployment Completed',
                  lambda_deploy_create: 'Creating Managed Deployment',
                  lambda_deploy_build: 'Building Managed Deployment',
                  discovering: 'Discovering Server Capabilities'
                }[step.type]
              }
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
          <StepLogs initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            <Spacer height={5} />
            {step.logs.map((log, index) => (
              <StepLogLine key={index} data-log-type={log.type}>
                <StepLogTs>{log.timestamp.toLocaleTimeString()}</StepLogTs>
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
