import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { SlateInvocationStack } from '../lib/invocation/stack';
import type { SlateInvocationBaseParams, SlatesRequest } from '../lib/invocation/types';

let include = {
  deployment: {
    include: {
      slateVersion: true
    }
  },
  slateInvocationAttachment: {
    include: {
      attachments: true
    }
  }
};

class slateInvocationServiceImpl {
  async createInvocation(
    d: SlateInvocationBaseParams & { initialMessages?: SlatesRequest[] }
  ) {
    return new SlateInvocationStack(d);
  }

  async createInvocationWithState(
    d: SlateInvocationBaseParams & {
      initialMessages?: SlatesRequest[];
      config: Record<string, any>;
      session: { id: string; state: Record<string, any> };
      auth: { authenticationMethodId: string; data: Record<string, any> } | null;
    }
  ) {
    return this.createInvocation({
      ...d,
      initialMessages: [
        {
          jsonrpc: '2.0',
          method: 'slates/config.set',
          params: { config: d.config }
        },
        ...(d.auth
          ? [
              {
                jsonrpc: '2.0' as const,
                method: 'slates/auth.set' as const,
                params: {
                  authenticationMethodId: d.auth.authenticationMethodId,
                  output: d.auth.data
                }
              }
            ]
          : []),
        {
          jsonrpc: '2.0',
          method: 'slates/session.start',
          params: { sessionId: d.session.id, state: d.session.state }
        },
        ...(d.initialMessages ?? [])
      ]
    });
  }

  async sendUpdatedConfig(d: {
    stack: SlateInvocationStack;
    previousConfig: Record<string, any> | null;
    newConfig: Record<string, any>;
  }) {
    return await d.stack.invoke('slates/config.changed', {
      previousConfig: d.previousConfig,
      newConfig: d.newConfig
    });
  }

  async getDefaultConfig(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/config.get_default', {});
  }

  async getConfigSchema(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/config.schema.get', {});
  }

  async getProviderInfo(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/provider.identify', {});
  }

  async listAuthMethods(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/auth.methods.list', {});
  }

  async getAuthMethod(d: { stack: SlateInvocationStack; authenticationMethodId: string }) {
    return await d.stack.invoke('slates/auth.method.get', {
      authenticationMethodId: d.authenticationMethodId
    });
  }

  async getDefaultAuthInput(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
  }) {
    return await d.stack.invoke('slates/auth.input.get_default', {
      authenticationMethodId: d.authenticationMethodId
    });
  }

  async sendUpdatedAuthInput(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    previousInput: Record<string, any> | null;
    newInput: Record<string, any>;
  }) {
    return await d.stack.invoke('slates/auth.input.changed', {
      authenticationMethodId: d.authenticationMethodId,
      previousInput: d.previousInput,
      newInput: d.newInput
    });
  }

  async getAuthOutput(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    input: Record<string, any>;
  }) {
    return await d.stack.invoke('slates/auth.output.get', {
      authenticationMethodId: d.authenticationMethodId,
      input: d.input
    });
  }

  async getOAuthCallback(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    code: string;
    state: string;
    redirectUri: string;
    input: Record<string, any>;
    callbackState: Record<string, any> | undefined;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }) {
    return await d.stack.invoke('slates/auth.authorization_callback.handle', {
      authenticationMethodId: d.authenticationMethodId,
      code: d.code,
      state: d.state,
      redirectUri: d.redirectUri,
      input: d.input,
      callbackState: d.callbackState,
      clientId: d.clientId,
      clientSecret: d.clientSecret,
      scopes: d.scopes
    });
  }

  async getOAuthUrl(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    redirectUri: string;
    state: string;
    input: Record<string, any>;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }) {
    return await d.stack.invoke('slates/auth.authorization_url.get', {
      authenticationMethodId: d.authenticationMethodId,
      redirectUri: d.redirectUri,
      state: d.state,
      input: d.input,
      clientId: d.clientId,
      clientSecret: d.clientSecret,
      scopes: d.scopes
    });
  }

  async getAuthProfile(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    output: Record<string, any>;
    input: Record<string, any>;
    scopes: string[];
  }) {
    return await d.stack.invoke('slates/auth.profile.get', {
      authenticationMethodId: d.authenticationMethodId,
      output: d.output,
      input: d.input,
      scopes: d.scopes
    });
  }

  async refreshOAuthToken(d: {
    stack: SlateInvocationStack;
    authenticationMethodId: string;
    output: Record<string, any>;
    input: Record<string, any>;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  }) {
    return await d.stack.invoke('slates/auth.token_refresh.handle', {
      authenticationMethodId: d.authenticationMethodId,
      output: d.output,
      input: d.input,
      clientId: d.clientId,
      clientSecret: d.clientSecret,
      scopes: d.scopes
    });
  }

  async listActions(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/actions.list', {});
  }

  async getAction(d: { stack: SlateInvocationStack; actionId: string }) {
    return await d.stack.invoke('slates/action.get', { actionId: d.actionId });
  }

  async invokeToolAction(d: {
    stack: SlateInvocationStack;
    actionId: string;
    input: Record<string, any>;
  }) {
    return await d.stack.invoke('slates/action.tool.invoke', {
      actionId: d.actionId,
      input: d.input
    });
  }

  async listTriggerGroups(d: { stack: SlateInvocationStack }) {
    return await d.stack.invoke('slates/trigger_groups.list', {});
  }

  async startManualWebhookRegistration(d: {
    stack: SlateInvocationStack;
    triggerGroupId: string;
    webhookUrl: string;
  }) {
    return await d.stack.invoke('slates/trigger_group.webhook.manual_setup', {
      triggerGroupId: d.triggerGroupId,
      webhookUrl: d.webhookUrl
    });
  }

  async finishManualWebhookRegistration(d: {
    stack: SlateInvocationStack;
    triggerGroupId: string;
    webhookUrl: string;
    partialWebhookRegistrationPayload: any;
    userWebhookRegistrationPayload: any;
  }) {
    return await d.stack.invoke('slates/trigger_group.webhook.manual_finish', {
      triggerGroupId: d.triggerGroupId,
      webhookUrl: d.webhookUrl,
      partialWebhookRegistrationPayload: d.partialWebhookRegistrationPayload,
      userWebhookRegistrationPayload: d.userWebhookRegistrationPayload
    });
  }

  async processWebhookRequest(d: {
    stack: SlateInvocationStack;
    triggerGroupId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: { encoding: 'base64'; content: string } | null;
    webhookRegistrationPayload: any;
  }) {
    return await d.stack.invoke('slates/trigger_group.webhook.process', {
      triggerGroupId: d.triggerGroupId,
      url: d.url,
      method: d.method,
      headers: d.headers,
      body: d.body,
      webhookRegistrationPayload: d.webhookRegistrationPayload
    });
  }

  async pollTriggerGroup(d: { stack: SlateInvocationStack; triggerGroupId: string; state: any }) {
    return await d.stack.invoke('slates/trigger_group.polling.poll', {
      triggerGroupId: d.triggerGroupId,
      state: d.state
    });
  }

  async DANGEROUSLY_getSlateInvocationById(d: { id: string }) {
    let slateInvocation = await db.slateInvocation.findFirst({
      where: {
        id: d.id
      },
      include
    });
    if (!slateInvocation) throw new ServiceError(notFoundError('slate.invocation'));
    return slateInvocation;
  }
}

export let slateInvocationService = Service.create(
  'slateInvocationService',
  () => new slateInvocationServiceImpl()
).build();
