import {
  messageInputToMcpBasic,
  messageOutputToMcpBasic,
  translateMessageToMcp
} from './translateToMcp';

export let messageTranslator = {
  toMcp: translateMessageToMcp,
  outputToMcpBasic: messageOutputToMcpBasic,
  inputToMcpBasic: messageInputToMcpBasic
};
