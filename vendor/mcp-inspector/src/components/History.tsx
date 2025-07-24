import { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { cx } from 'class-variance-authority';
import { useState } from 'react';
import JsonView from './JsonView';

const HistoryAndNotifications = ({
  requestHistory,
  serverNotifications,
  direction
}: {
  requestHistory: Array<{ request: string; response?: string }>;
  serverNotifications: ServerNotification[];
  direction: 'horizontal' | 'vertical';
}) => {
  const [expandedRequests, setExpandedRequests] = useState<{
    [key: number]: boolean;
  }>({});
  const [expandedNotifications, setExpandedNotifications] = useState<{
    [key: number]: boolean;
  }>({});

  const toggleRequestExpansion = (index: number) => {
    setExpandedRequests(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleNotificationExpansion = (index: number) => {
    setExpandedNotifications(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div
      className={cx('bg-card overflow-hidden flex h-full', {
        'flex-col': direction == 'horizontal',
        'flex-row': direction == 'vertical'
      })}
    >
      <div
        className={cx('flex-1 overflow-y-auto p-4', {
          'border-b': direction == 'horizontal',
          'border-r': direction == 'vertical'
        })}
      >
        <h2 className="text-lg font-semibold mb-4">History</h2>
        {requestHistory.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No history yet</p>
        ) : (
          <ul className="space-y-3">
            {requestHistory
              .slice()
              .reverse()
              .map((request, index) => (
                <li key={index} className="text-sm text-foreground bg-secondary p-2 rounded">
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => toggleRequestExpansion(requestHistory.length - 1 - index)}
                  >
                    <span className="font-mono">
                      {requestHistory.length - index}. {JSON.parse(request.request).method}
                    </span>
                    <span>
                      {expandedRequests[requestHistory.length - 1 - index] ? '▼' : '▶'}
                    </span>
                  </div>
                  {expandedRequests[requestHistory.length - 1 - index] && (
                    <>
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-blue-600">Request:</span>
                        </div>

                        <JsonView data={request.request} className="bg-background" />
                      </div>
                      {request.response && (
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-green-600">Response:</span>
                          </div>
                          <JsonView data={request.response} className="bg-background" />
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Server Notifications</h2>
        {serverNotifications.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No notifications yet</p>
        ) : (
          <ul className="space-y-3">
            {serverNotifications
              .slice()
              .reverse()
              .map((notification, index) => {
                let isDebug = notification.method.startsWith(
                  'notifications/metorial_gateway/debug/'
                );
                let expanded = expandedNotifications[serverNotifications.length - 1 - index];
                let method: string = notification.method;
                let payload = JSON.stringify(notification, null, 2);
                let title = method;

                if (isDebug) {
                  method = notification.method.replace(
                    'notifications/metorial_gateway/debug/',
                    ''
                  ) as any;
                  title = method;

                  expanded = true;

                  if (method == 'output') {
                    title = 'MCP Server Output';
                    payload = (notification.params?.lines ?? ([] as any)).join('\n');
                  } else if (method == 'note') {
                    title = (notification.params?.title ?? '') as string;
                    payload = (notification.params?.message ?? '') as string;
                    if (!payload) expanded = false;
                  } else {
                    payload = JSON.stringify(notification.params ?? {});

                    title =
                      {
                        init: 'Initialization'
                      }[method] ?? method;
                  }
                }

                return (
                  <li key={index} className="text-sm text-foreground bg-secondary p-2 rounded">
                    <div
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => toggleNotificationExpansion(index)}
                    >
                      <div className="flex items-center">
                        {isDebug && (
                          <span className="bg-blue-400 text-white px-2 py-1 rounded-full text-xs font-semibold mr-2">
                            Debug
                          </span>
                        )}

                        <span className="font-mono">
                          {!isDebug && <>{serverNotifications.length - index}. </>}

                          {title ?? method}
                        </span>
                      </div>

                      {!isDebug && <span>{expanded ? '▼' : '▶'}</span>}
                    </div>
                    {expanded && (
                      <div className="mt-2">
                        {/* <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-purple-600">
                            Details:
                          </span>
                        </div> */}

                        {method == 'output' ? (
                          ((notification.params?.lines ?? []) as string[]).map((line, i) => (
                            <div key={i} className="bg-background p-2 rounded mb-2">
                              {line}
                            </div>
                          ))
                        ) : method == 'note' ? (
                          <div className="bg-background p-2 rounded mb-2">{payload}</div>
                        ) : (
                          <JsonView data={payload} className="bg-background" />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default HistoryAndNotifications;
