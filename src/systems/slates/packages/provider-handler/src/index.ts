import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { createSlatesProviderProtoHandler, type SlatesParticipant } from '@slates/proto';
import {
  runWithContext,
  type Slate,
  SlateContext,
  SlateLogger,
  type SlateLogListener
} from '@slates/provider';
import { getAction, getActionWithType, getAuthMethod, mapAction, mapAuthMethod } from './spec';
import { State } from './state';
import { toJsonSchema, validate } from './validation';

export let createProviderHandler = <ConfigType extends {}, AuthType extends {}>(
  slate: Slate<ConfigType, AuthType>,
  listeners: SlateLogListener[]
) =>
  createSlatesProviderProtoHandler(async manager => {
    let protocol = new State<string | null>(null);
    let participants = new State<SlatesParticipant[] | null>(null);

    let auth = new State<{ authenticationMethodId: string; output: AuthType } | null>(null);
    let config = new State<{ value: ConfigType } | null>(null);
    let session = new State<{ id: string; state: any } | null>(null);

    let logger = new SlateLogger(listeners);

    let getContextBasic = () => {
      let currentProtocol = protocol.get();
      let currentParticipants = participants.get();

      if (!currentProtocol || !currentParticipants) {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Connection context has not been initialized'
          })
        );
      }

      return {
        protocol: currentProtocol,
        participants: currentParticipants
      };
    };

    let getContextFull = () => {
      let basic = getContextBasic();

      let currentConfig = config.get();
      let currentSession = session.get();
      let currentAuth = auth.get();

      if (
        !currentConfig ||
        !currentSession ||
        (!currentAuth && slate.spec.auth.authStack.length > 0)
      ) {
        throw new ServiceError(
          preconditionFailedError({
            message: 'Session context has not been initialized'
          })
        );
      }

      return {
        ...basic,
        config: currentConfig.value,
        session: currentSession,
        auth: currentAuth
      };
    };

    let getEmptyContext = () => new SlateContext({}, {}, {}, slate.spec as any, logger);

    manager.onNotification('slates/hello', async ({ params }) => {
      protocol.set(params.protocol);
    });

    manager.onNotification('slates/participant.set', async ({ params }) => {
      if (!protocol.get()) {
        throw new ServiceError(
          preconditionFailedError({ message: 'Connection protocol has not been initialized' })
        );
      }

      participants.set(params.participants);
    });

    manager.onNotification('slates/auth.set', async ({ params }) => {
      getContextBasic();
      getAuthMethod(slate, params.authenticationMethodId); // validate method ID

      let valRes = validate(
        slate.spec.authSchema,
        params.output,
        'auth',
        `Invalid authentication output for method ID: ${params.authenticationMethodId}`
      );

      auth.set({
        authenticationMethodId: params.authenticationMethodId,
        output: valRes
      });
    });

    manager.onNotification('slates/config.set', async ({ params }) => {
      getContextBasic();

      let value = validate(
        slate.spec.configSchema,
        params.config,
        'config',
        'Invalid configuration'
      );

      config.set({ value });
    });

    manager.onNotification('slates/session.start', async ({ params }) => {
      getContextBasic();

      session.set({
        id: params.sessionId,
        state: params.state
      });
    });

    manager.onRequest('slates/config.changed', async ({ params }) => {
      getContextBasic();

      let newConfig = validate(
        slate.spec.config.configSchema,
        params.newConfig,
        'config',
        'Invalid configuration'
      );

      let configChanged = slate.spec.config.handlers.configChanged;
      if (!configChanged) {
        return { success: true, config: newConfig };
      }

      let updatedConfig = await configChanged({
        previousConfig: params.previousConfig as ConfigType | null,
        newConfig
      });

      return { success: true, config: updatedConfig?.config ?? newConfig };
    });

    manager.onRequest('slates/config.get_default', async () => {
      getContextBasic();

      let getDefaultConfig = slate.spec.config.handlers.getDefaultConfig;
      if (!getDefaultConfig) {
        return { config: null };
      }

      let defaultConfig = await getDefaultConfig();
      return { config: defaultConfig };
    });

    manager.onRequest('slates/config.schema.get', async () => {
      getContextBasic();

      return { schema: toJsonSchema(slate.spec.configSchema) };
    });

    manager.onRequest('slates/provider.identify', async () => {
      getContextBasic();

      return {
        protocol: 'slates@2026-01-01',
        provider: {
          type: 'provider',
          id: slate.spec.key,
          name: slate.spec.name,
          description: slate.spec.description,
          metadata: slate.spec.parameters.metadata
        }
      };
    });

    manager.onRequest('slates/auth.methods.list', async () => {
      getContextBasic();

      return {
        authenticationMethods: slate.spec.auth.authStack.map(m => mapAuthMethod(slate, m))
      };
    });

    manager.onRequest('slates/auth.method.get', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      return {
        authenticationMethod: mapAuthMethod(slate, authMethod)
      };
    });

    manager.onRequest('slates/auth.input.get_default', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if (!authMethod.getDefaultInput) {
        return { input: null };
      }

      return {
        input: await runWithContext(getEmptyContext(), () => authMethod.getDefaultInput!())
      };
    });

    manager.onRequest('slates/auth.input.changed', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if (!authMethod.onInputChanged) {
        return { success: true, input: params.newInput };
      }

      let updatedInput = await runWithContext(getEmptyContext(), () =>
        authMethod.onInputChanged!({
          previousInput: params.previousInput as any | null,
          newInput: params.newInput
        })
      );

      return { success: true, input: updatedInput?.input ?? params.newInput };
    });

    manager.onRequest('slates/auth.output.get', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      let input = params.input;

      if (authMethod.inputSchema) {
        input = validate(
          authMethod.inputSchema,
          input,
          'auth',
          `Invalid authentication input for method ID: ${params.authenticationMethodId}`
        );
      }

      if ('getOutput' in authMethod) {
        let outputRes = await runWithContext(getEmptyContext(), () =>
          authMethod.getOutput({ input })
        );
        return { output: outputRes.output };
      }

      return { output: input as any };
    });

    manager.onRequest('slates/auth.authorization_callback.handle', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if ('handleCallback' in authMethod) {
        let callbackRes = await runWithContext(getEmptyContext(), () =>
          authMethod.handleCallback({
            code: params.code,
            state: params.state,
            redirectUri: params.redirectUri,
            input: params.input,
            clientId: params.clientId,
            clientSecret: params.clientSecret,
            scopes: params.scopes,
            callbackState: params.callbackState || {}
          })
        );

        return {
          output: callbackRes.output,
          input: callbackRes.input
        };
      }

      throw new ServiceError(
        preconditionFailedError({
          message: `Authentication method does not support authorization callback handling: ${params.authenticationMethodId}`
        })
      );
    });

    manager.onRequest('slates/auth.authorization_url.get', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if ('getAuthorizationUrl' in authMethod) {
        let urlRes = await runWithContext(getEmptyContext(), () =>
          authMethod.getAuthorizationUrl({
            redirectUri: params.redirectUri,
            state: params.state,
            input: params.input,
            clientId: params.clientId,
            clientSecret: params.clientSecret,
            scopes: params.scopes
          })
        );

        return {
          authorizationUrl: urlRes.url,
          input: urlRes.input,
          callbackState: urlRes.callbackState
        };
      }

      throw new ServiceError(
        preconditionFailedError({
          message: `Authentication method does not support authorization URL retrieval: ${params.authenticationMethodId}`
        })
      );
    });

    manager.onRequest('slates/auth.profile.get', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if (authMethod.getProfile) {
        let profileRes = await runWithContext(
          getEmptyContext(),
          () =>
            authMethod.getProfile!({
              output: params.output as any,
              input: params.input,
              scopes: params.scopes
            })!
        );

        return {
          profile: profileRes.profile
        };
      }

      throw new ServiceError(
        preconditionFailedError({
          message: `Authentication method does not support profile retrieval: ${params.authenticationMethodId}`
        })
      );
    });

    manager.onRequest('slates/auth.token_refresh.handle', async ({ params }) => {
      getContextBasic();
      let authMethod = getAuthMethod(slate, params.authenticationMethodId);

      if ('handleTokenRefresh' in authMethod && authMethod.handleTokenRefresh) {
        let refreshRes = await runWithContext(getEmptyContext(), () =>
          authMethod.handleTokenRefresh!({
            output: params.output as any,
            input: params.input,
            clientId: params.clientId,
            clientSecret: params.clientSecret,
            scopes: params.scopes
          })
        );

        return {
          output: refreshRes.output,
          input: refreshRes.input
        };
      }

      throw new ServiceError(
        preconditionFailedError({
          message: `Authentication method does not support token refresh handling: ${params.authenticationMethodId}`
        })
      );
    });

    manager.onRequest('slates/actions.list', async () => {
      getContextBasic();

      return {
        actions: slate.actions.map(a => mapAction(slate, a))
      };
    });

    manager.onRequest('slates/action.get', async ({ params }) => {
      getContextBasic();
      let action = getAction(slate, params.actionId);

      return {
        action: mapAction(slate, action)
      };
    });

    manager.onRequest('slates/action.tool.invoke', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'tool', params.actionId);

      let input = validate(
        action.inputSchema,
        params.input,
        'input',
        `Invalid input for tool ID: ${params.actionId}`
      );

      let context = new SlateContext(ctx.config, input, ctx.auth?.output!, slate.spec, logger);
      let res = await runWithContext(context, () => action.handleInvocation(context));

      return { output: res.output, message: res.message };
    });

    manager.onRequest('slates/action.trigger.map_event', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'trigger', params.actionId);

      let input = validate(
        action.inputSchema,
        params.input,
        'input',
        `Invalid event for trigger ID: ${params.actionId}`
      );

      let context = new SlateContext(ctx.config, input, ctx.auth?.output!, slate.spec, logger);
      let res = await runWithContext(context, () => action.handleEvent(context));

      return { id: res.id, type: res.type, output: res.output };
    });

    manager.onRequest('slates/action.trigger.poll_events', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'trigger', params.actionId);

      if (!action.pollEvents) {
        throw new ServiceError(
          badRequestError({
            message: `Trigger action does not support polling: ${params.actionId}`
          })
        );
      }

      let context = new SlateContext(
        ctx.config,
        { state: params.state },
        ctx.auth?.output!,
        slate.spec,
        logger
      );
      let res = await runWithContext(context, () => action.pollEvents!(context));

      return { inputs: res.inputs, updatedState: res.updatedState };
    });

    manager.onRequest('slates/action.trigger.webhook_handle', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'trigger', params.actionId);

      if (!action.handleRequest) {
        throw new ServiceError(
          badRequestError({
            message: `Trigger action does not support webhook requests: ${params.actionId}`
          })
        );
      }

      let req = new Request(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.body
          ? Uint8Array.from(atob(params.body.content), c => c.charCodeAt(0))
          : null
      });

      let context = new SlateContext(
        ctx.config,
        { request: req, state: params.state },
        ctx.auth?.output!,
        slate.spec,
        logger
      );
      let res = await runWithContext(context, () => action.handleRequest!(context));

      return { inputs: res.inputs, updatedState: res.updatedState };
    });

    manager.onRequest('slates/action.trigger.webhook_register', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'trigger', params.actionId);

      if (!action.autoRegisterWebhook) {
        throw new ServiceError(
          badRequestError({
            message: `Trigger action does not support webhook auto-registration: ${params.actionId}`
          })
        );
      }

      let context = new SlateContext(
        ctx.config,
        { webhookBaseUrl: params.webhookBaseUrl },
        ctx.auth?.output!,
        slate.spec,
        logger
      );
      let res = await runWithContext(context, () => action.autoRegisterWebhook!(context));

      return { registrationDetails: res.registrationDetails, state: res.state };
    });

    manager.onRequest('slates/action.trigger.webhook_unregister', async ({ params }) => {
      let ctx = getContextFull();
      let action = getActionWithType(slate, 'trigger', params.actionId);

      if (!action.autoUnregisterWebhook) {
        throw new ServiceError(
          badRequestError({
            message: `Trigger action does not support webhook auto-unregistration: ${params.actionId}`
          })
        );
      }

      let context = new SlateContext(
        ctx.config,
        {
          webhookBaseUrl: params.webhookBaseUrl,
          registrationDetails: params.registrationDetails,
          state: params.state
        },
        ctx.auth?.output!,
        slate.spec,
        logger
      );
      await runWithContext(context, () => action.autoUnregisterWebhook!(context));

      return {};
    });
  });
