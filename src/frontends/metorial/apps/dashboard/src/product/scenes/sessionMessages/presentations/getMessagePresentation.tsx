import {
  RiArrowRightSLine,
  RiChatQuoteLine,
  RiCheckboxCircleLine,
  RiExchangeLine,
  RiFileListLine,
  RiFileTextLine,
  RiFolderLine,
  RiToolsLine
} from '@remixicon/react';
import { InlineCode, SummaryTitle } from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput, MessagePresentation } from '../types';
import {
  asRecord,
  getDisplayName,
  getMessageTransportMeta,
  getMethodParams,
  getMethodResult
} from '../utils';
import { getInitializeOverviewSections } from './initialize';
import { getPromptGetOverviewSections } from './promptGet';
import { getPromptsOverviewSections } from './prompts';
import { getResourceReadOverviewSections } from './resourceRead';
import { getResourceTemplatesOverviewSections } from './resourceTemplates';
import { getResourcesOverviewSections } from './resources';
import { getToolCallOverviewSections } from './toolCall';
import { getToolsOverviewSections } from './tools';

export let getMessagePresentation = ({
  input,
  message,
  method,
  output
}: {
  input: Record<string, any> | null;
  message: DashboardInstanceSessionsMessagesGetOutput;
  method: string;
  output: Record<string, any> | null;
}): MessagePresentation => {
  let transportMeta = getMessageTransportMeta(message);
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let clientInfo = asRecord(params?.clientInfo) ?? transportMeta?.client ?? null;
  let serverInfo = asRecord(result?.serverInfo) ?? transportMeta?.server ?? null;
  let clientName = getDisplayName(clientInfo, 'Client');
  let serverName = getDisplayName(serverInfo, 'Server');

  if (method === 'initialize') {
    return {
      defaultViewMode: 'overview',
      label: 'Initialization',
      overviewSections: getInitializeOverviewSections({ input, output, transportMeta }),
      summaryIcon: <RiExchangeLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>initialized MCP connection with</span>
          <strong>{serverName}</strong>
          <span>on Metorial</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'notifications/initialized') {
    return {
      hideCard: true,
      label: 'Initialization Confirmed',
      summaryIcon: <RiCheckboxCircleLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>confirmed initialization.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Resources',
      overviewSections: getResourcesOverviewSections({ output }),
      summaryIcon: <RiFileListLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available resources.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/templates/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Resource Templates',
      overviewSections: getResourceTemplatesOverviewSections({ output }),
      summaryIcon: <RiFolderLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested resource templates.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'tools/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Tools',
      overviewSections: getToolsOverviewSections({ output }),
      summaryIcon: <RiToolsLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available tools.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'prompts/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Prompts',
      overviewSections: getPromptsOverviewSections({ output }),
      summaryIcon: <RiChatQuoteLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available prompts.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'tools/call') {
    let toolName = params?.name ? String(params.name) : 'unknown tool';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Tool Call</span>
          <InlineCode>{toolName}</InlineCode>
        </>
      ),
      overviewSections: getToolCallOverviewSections({ input, output }),
      summaryIcon: <RiToolsLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>called tool</span>
          <strong>{toolName}</strong>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/read') {
    let resourceName = params?.uri ? String(params.uri) : 'unknown resource';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Resource Read</span>
          <InlineCode>{resourceName}</InlineCode>
        </>
      ),
      overviewSections: getResourceReadOverviewSections({ input, output }),
      summaryIcon: <RiFileTextLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested resource</span>
          <strong>{resourceName}</strong>
        </SummaryTitle>
      )
    };
  }

  if (method === 'prompts/get') {
    let promptName = params?.name ? String(params.name) : 'unknown prompt';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Prompt Get</span>
          <InlineCode>{promptName}</InlineCode>
        </>
      ),
      overviewSections: getPromptGetOverviewSections({ input, output }),
      summaryIcon: <RiChatQuoteLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested prompt</span>
          <strong>{promptName}</strong>
        </SummaryTitle>
      )
    };
  }

  return {
    label: method,
    summaryIcon: <RiArrowRightSLine />,
    summaryText: (
      <SummaryTitle>
        <strong>{clientName}</strong>
        <span>sent</span>
        <strong>{method}</strong>
      </SummaryTitle>
    )
  };
};
