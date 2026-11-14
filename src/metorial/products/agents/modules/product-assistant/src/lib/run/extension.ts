import type { StateItem } from '../../types';
import type { Agent, SessionEvent } from '../open-harness';

export type AgentRunStateWriter = {
  items: StateItem[];
  createItemId: () => string;
};

export type AgentRunToolAdapter = {
  onInputStart?: (d: { toolCallId: string; writer: AgentRunStateWriter }) => void;
  onInputDelta?: (d: {
    toolCallId: string;
    partialInput: unknown;
    writer: AgentRunStateWriter;
  }) => void;
  onStart?: (d: { toolCallId: string; input: unknown; writer: AgentRunStateWriter }) => void;
  onDone?: (d: { toolCallId: string; output: unknown; writer: AgentRunStateWriter }) => void;
  onError?: (d: { toolCallId: string; error: string; writer: AgentRunStateWriter }) => void;
};

export type AgentRunExtension = {
  tools?: Record<string, AgentRunToolAdapter>;
  onEvent?: (d: { event: SessionEvent; writer: AgentRunStateWriter }) => void;
  close?: () => Promise<void> | void;
};

let extensions = new WeakMap<Agent, AgentRunExtension[]>();

export let attachAgentRunExtension = (agent: Agent, extension: AgentRunExtension) => {
  let existing = extensions.get(agent) ?? [];
  extensions.set(agent, [...existing, extension]);

  return agent;
};

export let getAgentRunExtensions = (agent: Agent) => extensions.get(agent) ?? [];
