import { describe, expect, it } from 'vitest';
import { checkToolAccess } from './toolFilter';

let createTool = (key: string) =>
  ({
    id: `ptl_${key}`,
    key: `${key}_67228`,
    callableId: key,
    value: {
      key,
      mcpToolType: {
        type: 'tool.callable'
      }
    }
  }) as any;

let sessionProvider = {
  toolFilter: {
    type: 'v1.allow_all'
  },
  deployment: {
    toolFilter: {
      type: 'v1.allow_all'
    }
  },
  config: {
    toolFilter: {
      type: 'v1.filter',
      filters: [
        {
          type: 'tool_keys',
          keys: ['add', 'divide']
        }
      ]
    }
  },
  authConfig: null
} as any;

describe('checkToolAccess', () => {
  it('matches tool key filters against callable ids for session-tagged tools', () => {
    let addTool = createTool('add');
    let subtractTool = createTool('subtract');

    expect(checkToolAccess(addTool, sessionProvider, 'list')).toEqual({ allowed: true });
    expect(checkToolAccess(subtractTool, sessionProvider, 'list')).toEqual({
      allowed: false
    });
  });

  it('matches regex filters against callable ids for session-tagged tools', () => {
    let divideTool = createTool('divide');
    let sessionProviderWithRegex = {
      ...sessionProvider,
      config: {
        toolFilter: {
          type: 'v1.filter',
          filters: [
            {
              type: 'tool_regex',
              pattern: '^div'
            }
          ]
        }
      }
    } as any;

    expect(checkToolAccess(divideTool, sessionProviderWithRegex, 'list')).toEqual({
      allowed: true
    });
  });
});
