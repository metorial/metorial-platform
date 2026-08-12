import type { ProductAssistantTypes } from '@metorial/db';

export type MessagePart = ProductAssistantTypes.MessagePart;
export type InputMessage = ProductAssistantTypes.InputMessage;
export type ItemStatus = ProductAssistantTypes.ItemStatus;
export type Message = ProductAssistantTypes.Message;
export type ToolCallState = ProductAssistantTypes.ToolCallState;
export type FileExploreOperation = ProductAssistantTypes.FileExploreOperation;
export type FileWriteChange = ProductAssistantTypes.FileWriteChange;
export type WebSearchResult = ProductAssistantTypes.WebSearchResult;
export type WebOperation = ProductAssistantTypes.WebOperation;
export type StateItem = ProductAssistantTypes.StateItem;
export type State = ProductAssistantTypes.State;

export type AssistantMessageSerializedContent = ProductAssistantTypes.MessageSerializedContent;
export type AssistantRunUsage = ProductAssistantTypes.RunUsage;
export type AssistantRunCost = ProductAssistantTypes.RunCost;
export type AssistantRunMetadata = ProductAssistantTypes.RunMetadata;
export type SubspaceMcpToolList = ProductAssistantTypes.SubspaceMcpToolList;

export type AssistantRequestStatus =
  | 'pending'
  | 'waiting_for_user'
  | 'completed'
  | 'cancelled'
  | 'failed';
