import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';

export type ChatExplorerTarget = {
  chatId?: string | null;
  channelId?: string | null;
  threadId?: string | null;
  chatConnectionId?: string | null;
  chatInstanceId?: string | null;
};

export let useChatExplorerPath = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return (target?: ChatExplorerTarget) => {
    let path = Paths.instance.chatExplorer(organization.data, project.data, instance.data);
    if (path == '#') return path;

    let params = new URLSearchParams();
    if (target?.chatId) params.set('chat_id', target.chatId);
    if (target?.channelId) params.set('channel_id', target.channelId);
    if (target?.threadId) params.set('thread_id', target.threadId);
    if (target?.chatConnectionId) params.set('chat_connection_id', target.chatConnectionId);
    if (target?.chatInstanceId) params.set('chat_instance_id', target.chatInstanceId);

    let query = params.toString();
    return query ? `${path}?${query}` : path;
  };
};
