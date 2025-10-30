import {
  GetLogEventsCommand,
  GetLogEventsCommandOutput
} from '@aws-sdk/client-cloudwatch-logs';
import { RegisterTaskDefinitionCommand } from '@aws-sdk/client-ecs';
import { awsEcs, awsLogs, awsRegion } from './aws';

interface LogFetchOptions {
  logGroupName: string;
  logStreamName: string;
  nextToken?: string;
  startFromHead?: boolean;
  limit?: number;
}

interface LogResult {
  events: Array<{
    timestamp: number;
    message: string;
  }>;
  nextForwardToken?: string;
  nextBackwardToken?: string;
}

export let ensureTaskDefinition = async (d: {
  taskName: string;
  logGroupName: string;
  env: Record<string, string>;
  executionRoleArn: string;
  taskRoleArn: string;
  buildImageUri: string;
}) => {
  return await awsEcs.send(
    new RegisterTaskDefinitionCommand({
      family: d.taskName,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '2048',
      memory: '4096',
      executionRoleArn: d.executionRoleArn,
      taskRoleArn: d.taskRoleArn,
      containerDefinitions: [
        {
          name: 'lambda-builder',
          image: d.buildImageUri,
          essential: true,
          environment: Object.entries(d.env).map(([name, value]) => ({ name, value })),
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': d.logGroupName,
              'awslogs-region': awsRegion!,
              'awslogs-stream-prefix': 'builder'
            }
          }
        }
      ]
    })
  );
};

export let getEcsLogs = async (options: LogFetchOptions): Promise<LogResult> => {
  let params: any = {
    logGroupName: options.logGroupName,
    logStreamName: options.logStreamName,
    startFromHead: options.startFromHead ?? true,
    limit: options.limit ?? 100
  };

  if (options.nextToken) {
    params.nextToken = options.nextToken;
  }

  try {
    let response: GetLogEventsCommandOutput = await awsLogs.send(
      new GetLogEventsCommand(params)
    );

    return {
      events: (response.events || []).map(event => ({
        timestamp: event.timestamp || 0,
        message: event.message || ''
      })),
      nextForwardToken: response.nextForwardToken,
      nextBackwardToken: response.nextBackwardToken
    };
  } catch (error: any) {
    // Log stream might not exist yet if task just started
    if (error.name === 'ResourceNotFoundException') {
      return {
        events: [],
        nextForwardToken: undefined,
        nextBackwardToken: undefined
      };
    }
    throw error;
  }
};

export let getEcsLogStreamName = (
  taskArn: string,
  containerName: string = 'lambda-builder'
) => {
  let taskId = taskArn.split('/').pop();
  return `builder/${containerName}/${taskId}`;
};
