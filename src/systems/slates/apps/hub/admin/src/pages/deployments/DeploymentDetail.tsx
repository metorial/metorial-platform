import { renderWithLoader } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Datalist,
  Flex,
  Group,
  InlineCopy,
  RenderDate,
  Text
} from '@metorial-io/ui';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deploymentStatusColors } from '../../constants/statusColors.js';
import { redeploySlateDeployment, useBuildOutput, useInternalLogs, useSlate, useSlateDeployment } from '../../state/index.js';
import { BackLink } from '../../components/BackLink.js';
import {
  LogViewer,
  MonoCode,
  TextLink
} from '../../components/styled.js';

type BuildStep = {
  name: string;
  type: string;
  status: string;
  logs: { timestamp: number; message: string }[];
};

let BuildStepView = ({ step }: { step: BuildStep }) => {
  let logs = step.logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(log => log.message)
    .join('\n');

  return (
    <Flex direction="column" gap={8}>
      <Flex align="center" gap={8}>
        <Text size="2" weight="medium">
          {step.name}
        </Text>
        <Badge color="gray" size="1">
          {step.type}
        </Badge>
        <Badge color={step.status === 'failed' ? 'red' : 'green'} size="1">
          {step.status}
        </Badge>
      </Flex>
      {logs && <LogViewer>{logs}</LogViewer>}
    </Flex>
  );
};

export let DeploymentDetail = () => {
  let { slateId, deploymentId } = useParams<{ slateId: string; deploymentId: string }>();
  let slate = useSlate(slateId);
  let deployment = useSlateDeployment(slateId, deploymentId);
  let buildOutput = useBuildOutput(slateId, deploymentId);
  let internalLogs = useInternalLogs(slateId, deploymentId);

  let [redeploying, setRedeploying] = useState(false);

  let handleRedeploy = async () => {
    if (!slateId || !deploymentId) return;
    if (!confirm('This will cancel any ongoing deployments for this version and start a new one. Continue?')) return;
    setRedeploying(true);
    try {
      await redeploySlateDeployment(slateId, deploymentId);
    } finally {
      setRedeploying(false);
    }
  };

  return renderWithLoader({ slate, deployment })(({ slate, deployment }) => {
    let slateData = slate.data!;
    let deploymentData = deployment.data!;
    let buildSteps = (buildOutput.data ?? []) as BuildStep[];
    let logs = (internalLogs.data ?? []) as { message: string; args: any[]; ts: string | null }[];

    return (
      <Flex direction="column" gap={24}>
        <Flex align="center" gap={12}>
          <BackLink to={`/slates/${slateId}`}>
            Back to {slateData.name || slateData.identifier}
          </BackLink>
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="outline" onClick={handleRedeploy} disabled={redeploying}>
              {redeploying ? 'Redeploying...' : 'Redeploy'}
            </Button>
          </div>
        </Flex>

        <Group.Wrapper>
          <Group.Header title="Deployment Details" />
          <Group.Content>
            <Datalist
              items={[
                {
                  label: 'Deployment ID',
                  value: (
                    <Flex align="center" gap={6}>
                      <MonoCode>{deploymentData.id}</MonoCode>
                      <InlineCopy value={deploymentData.id} />
                    </Flex>
                  )
                },
                {
                  label: 'Status',
                  value: (
                    <Badge color={deploymentStatusColors[deploymentData.status] || 'gray'}>
                      {deploymentData.status}
                    </Badge>
                  )
                },
                {
                  label: 'Version',
                  value: (
                    <Flex align="center" gap={8}>
                      {deploymentData.version?.id ? (
                        <Link
                          to={`/slates/${slateId}/versions/${deploymentData.version.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Badge color="blue">v{deploymentData.version?.version ?? '-'}</Badge>
                        </Link>
                      ) : (
                        <Badge color="blue">v{deploymentData.version?.version ?? '-'}</Badge>
                      )}
                      {deploymentData.version?.isCurrent && (
                        <Badge color="green" size="1">
                          Current
                        </Badge>
                      )}
                    </Flex>
                  )
                },
                {
                  label: 'Slate',
                  value: (
                    <TextLink to={`/slates/${slateId}`}>
                      {slateData.name || slateData.identifier}
                    </TextLink>
                  )
                },
                { label: 'Created', value: <RenderDate date={deploymentData.createdAt} /> }
              ]}
            />
          </Group.Content>
        </Group.Wrapper>

        {deploymentData.error && (
          <Group.Wrapper>
            <Group.Header title="Error" />
            <Group.Content>
              <Flex
                direction="column"
                gap={12}
                style={{
                  padding: 16,
                  background: '#fef2f2',
                  borderRadius: 8,
                  border: '1px solid #fecaca'
                }}
              >
                <Flex align="center" gap={8}>
                  <Badge color="red">{deploymentData.error.code}</Badge>
                </Flex>
                <Text size="2">{deploymentData.error.message}</Text>
              </Flex>
            </Group.Content>
          </Group.Wrapper>
        )}

        <Group.Wrapper>
          <Group.Header title="Build Output" />
          <Group.Content>
            {buildSteps.length > 0 ? (
              <Flex direction="column" gap={16}>
                {buildSteps.map((step, i) => (
                  <BuildStepView key={i} step={step} />
                ))}
              </Flex>
            ) : (
              <Text size="2" color="gray600">
                No build output available yet.
              </Text>
            )}
          </Group.Content>
        </Group.Wrapper>

        <Group.Wrapper>
          <Group.Header title="Internal Logs" />
          <Group.Content>
            {logs.length > 0 ? (
              <LogViewer>
                {logs
                  .map(l => {
                    let ts = l.ts ? new Date(l.ts).toISOString() : '';
                    let line = ts ? `[${ts}] ${l.message}` : l.message;
                    if (l.args && l.args.length > 0) {
                      line += ' ' + JSON.stringify(l.args, null, 2);
                    }
                    return line;
                  })
                  .join('\n')}
              </LogViewer>
            ) : (
              <Text size="2" color="gray600">
                No internal logs available.
              </Text>
            )}
          </Group.Content>
        </Group.Wrapper>
      </Flex>
    );
  });
};
