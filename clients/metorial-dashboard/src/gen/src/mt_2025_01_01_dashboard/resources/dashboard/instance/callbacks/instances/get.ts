import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesGetOutput = {
  object: 'callback.instance';
  id: string;
  integrationInstanceId: string;
  integrationInstanceProviderId: string;
  status: 'attached' | 'detached';
  registrationStatus:
    | 'pending'
    | 'registering'
    | 'registered'
    | 'renewing'
    | 'failed'
    | 'unregistering'
    | 'unregistered';
  registrationGeneration: number;
  registrationTransitionVersion: number;
  registrationError: {
    code: string;
    message: string | null;
    metadata: Record<string, any> | null;
    at: Date | null;
  } | null;
  lastRegistrationSyncError: {
    code: string;
    message: string | null;
    at: Date | null;
  } | null;
  verificationMechanism: 'path_secret_only' | 'hub' | 'provider' | null;
  verificationSpecHash: string | null;
  deployment: {
    object: 'provider.deployment#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  config: {
    object: 'provider.config#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  authConfig: {
    object: 'provider.auth_config#preview';
    id: string;
    isDefault: boolean;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  webhookUrl: string | null;
  receiverPathSecret: {
    object: 'callback.receiver_path_secret#metadata';
    id: string;
    generation: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  triggers: {
    object: 'callback.instance.trigger';
    id: string;
    active: boolean;
    authoritativeStateVersion: number;
    source: 'polling' | 'webhook';
    pollIntervalSeconds: number | null;
    nextPollAt: Date | null;
    lastPolledAt: Date | null;
    webhookUrl: string | null;
    isWebhookRegistered: boolean | null;
    registrationStatus:
      | 'pending'
      | 'registering'
      | 'registered'
      | 'renewing'
      | 'failed'
      | 'unregistering'
      | 'unregistered';
    registrationGeneration: number;
    registrationTransitionVersion: number;
    registrationError: {
      code: string;
      message: string | null;
      metadata: Record<string, any> | null;
      at: Date | null;
    } | null;
    verificationMechanism: 'path_secret_only' | 'hub' | 'provider';
    verificationSpecHash: string | null;
    providerTrigger: {
      object: 'provider.capabilities.trigger';
      id: string;
      key: string;
      name: string;
      description: string | null;
      inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      eventTypes: string[];
      invocation:
        | { type: 'polling'; intervalSeconds: number }
        | {
            type: 'webhook';
            autoRegistration: { status: 'supported' | 'unsupported' };
            autoUnregistration: { status: 'supported' | 'unsupported' };
            http: {
              verification:
                | {
                    mechanism: 'hub';
                    baseline: 'receiver_path_secret';
                    allowedSecretRefs: (
                      | {
                          source: 'auth_config';
                          name: string;
                          credentialKey: string;
                          authMethods?: string[] | undefined;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'oauth_credentials';
                          name: string;
                          credentialKey: string;
                          authMethods?: string[] | undefined;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'callback_secret';
                          name: string;
                          callbackSecretKey: string;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'registration';
                          name: string;
                          registrationKey: string;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'generated';
                          name: string;
                          binding: 'receiver' | 'receiver_trigger';
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                    )[];
                    rules: {
                      id: string;
                      phase: 'bootstrap' | 'delivery' | 'lifecycle';
                      maxBodyBytes?: number | undefined;
                      when: {
                        methods: (
                          | 'GET'
                          | 'POST'
                          | 'PUT'
                          | 'PATCH'
                          | 'DELETE'
                          | 'HEAD'
                          | 'OPTIONS'
                        )[];
                        registrationStatuses?:
                          | (
                              | 'pending'
                              | 'registering'
                              | 'registered'
                              | 'renewing'
                              | 'failed'
                              | 'unregistering'
                              | 'unregistered'
                            )[]
                          | undefined;
                        matcher?:
                          | {
                              method?:
                                | 'GET'
                                | 'POST'
                                | 'PUT'
                                | 'PATCH'
                                | 'DELETE'
                                | 'HEAD'
                                | 'OPTIONS'
                                | undefined;
                              hasQueryParam?: string | undefined;
                              lacksQueryParam?: string | undefined;
                              hasHeader?: string | undefined;
                              jsonBodyField?:
                                | { path: string; equals?: string | undefined }
                                | undefined;
                              formBodyField?:
                                | { path: string; equals?: string | undefined }
                                | undefined;
                            }
                          | undefined;
                      };
                      result:
                        | { type: 'sync_only' }
                        | { type: 'dispatch'; scope: 'receiver_trigger' }
                        | { type: 'dispatch'; scope: 'verified_items' };
                      replay?:
                        | {
                            kind: 'enforced';
                            freshness:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                };
                            deduplicate?:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | undefined;
                          }
                        | {
                            kind: 'enforced';
                            freshness?:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | undefined;
                            deduplicate:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                };
                          }
                        | {
                            kind: 'not_applicable';
                            reason: 'bootstrap_sync_only';
                          }
                        | undefined;
                      verify:
                        | { type: 'path_secret' }
                        | {
                            type: 'static_token';
                            secretName: string;
                            selector:
                              | { source: 'header'; headerName: string }
                              | { source: 'query'; queryParam: string }
                              | { source: 'json_pointer'; pointer: string };
                          }
                        | {
                            type: 'raw_hmac';
                            secretName: string;
                            algorithm: 'sha256' | 'sha512';
                            signature: {
                              headerName: string;
                              encoding: 'hex' | 'base64' | 'base64url';
                              prefix?: string | undefined;
                              duplicateHeaderPolicy:
                                | 'reject'
                                | 'allow_identical'
                                | 'preserve';
                              multipleSignaturePolicy:
                                | 'reject'
                                | 'any_valid'
                                | 'all_valid';
                            };
                            message: (
                              | { source: 'body' }
                              | { source: 'method' }
                              | { source: 'url' }
                              | { source: 'header'; headerName: string }
                              | { source: 'query'; queryParam: string }
                              | { source: 'literal'; value: string }
                            )[];
                          }
                        | {
                            type: 'ed25519';
                            publicKeyName: string;
                            publicKeyEncoding: 'hex' | 'base64' | 'base64url';
                            signature: {
                              headerName: string;
                              encoding: 'hex' | 'base64' | 'base64url';
                              prefix?: string | undefined;
                              duplicateHeaderPolicy:
                                | 'reject'
                                | 'allow_identical'
                                | 'preserve';
                              multipleSignaturePolicy:
                                | 'reject'
                                | 'any_valid'
                                | 'all_valid';
                            };
                            message: (
                              | { source: 'body' }
                              | { source: 'method' }
                              | { source: 'url' }
                              | { source: 'header'; headerName: string }
                              | { source: 'query'; queryParam: string }
                              | { source: 'literal'; value: string }
                            )[];
                          }
                        | {
                            type: 'preset';
                            preset:
                              | 'slack.v0'
                              | 'stripe.v1'
                              | 'zoom.v0'
                              | 'hubspot.v3'
                              | 'gitlab.standard.v1'
                              | 'zendesk.v1'
                              | 'typeform.v1'
                              | 'linear.v1'
                              | 'graph.change_notification.v1'
                              | 'jira.oauth_dynamic_webhook.v1'
                              | 'discord.interactions.v1';
                          };
                    }[];
                  }
                | {
                    mechanism: 'provider';
                    baseline: 'receiver_path_secret';
                    reason: string;
                    allowedSecretRefs: (
                      | {
                          source: 'auth_config';
                          name: string;
                          credentialKey: string;
                          authMethods?: string[] | undefined;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'oauth_credentials';
                          name: string;
                          credentialKey: string;
                          authMethods?: string[] | undefined;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'callback_secret';
                          name: string;
                          callbackSecretKey: string;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'registration';
                          name: string;
                          registrationKey: string;
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                      | {
                          source: 'generated';
                          name: string;
                          binding: 'receiver' | 'receiver_trigger';
                          encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
                        }
                    )[];
                    rules: {
                      id: string;
                      phase: 'bootstrap' | 'delivery' | 'lifecycle';
                      maxBodyBytes?: number | undefined;
                      when: {
                        methods: (
                          | 'GET'
                          | 'POST'
                          | 'PUT'
                          | 'PATCH'
                          | 'DELETE'
                          | 'HEAD'
                          | 'OPTIONS'
                        )[];
                        registrationStatuses?:
                          | (
                              | 'pending'
                              | 'registering'
                              | 'registered'
                              | 'renewing'
                              | 'failed'
                              | 'unregistering'
                              | 'unregistered'
                            )[]
                          | undefined;
                        matcher?:
                          | {
                              method?:
                                | 'GET'
                                | 'POST'
                                | 'PUT'
                                | 'PATCH'
                                | 'DELETE'
                                | 'HEAD'
                                | 'OPTIONS'
                                | undefined;
                              hasQueryParam?: string | undefined;
                              lacksQueryParam?: string | undefined;
                              hasHeader?: string | undefined;
                              jsonBodyField?:
                                | { path: string; equals?: string | undefined }
                                | undefined;
                              formBodyField?:
                                | { path: string; equals?: string | undefined }
                                | undefined;
                            }
                          | undefined;
                      };
                      result:
                        | { type: 'sync_only' }
                        | { type: 'dispatch'; scope: 'receiver_trigger' }
                        | { type: 'dispatch'; scope: 'verified_items' };
                      replay?:
                        | {
                            kind: 'enforced';
                            freshness:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                };
                            deduplicate?:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | undefined;
                          }
                        | {
                            kind: 'enforced';
                            freshness?:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  format:
                                    | 'unix_seconds'
                                    | 'unix_milliseconds'
                                    | 'rfc3339';
                                  maxAgeSeconds: number;
                                  maxFutureSkewSeconds: number;
                                }
                              | undefined;
                            deduplicate:
                              | {
                                  source: 'preset';
                                  presetField:
                                    | 'timestamp'
                                    | 'delivery_id'
                                    | 'event_id'
                                    | 'subscription_id'
                                    | 'client_state'
                                    | 'resource'
                                    | 'webhook_id'
                                    | 'interaction_id'
                                    | 'issued_at';
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'header';
                                  headerName: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                }
                              | {
                                  source: 'json_pointer';
                                  pointer: string;
                                  ttlSeconds: number;
                                  scope: 'request' | 'verified_item';
                                };
                          }
                        | {
                            kind: 'not_applicable';
                            reason: 'bootstrap_sync_only';
                          }
                        | undefined;
                      verify: {
                        type: 'provider';
                        verifierId:
                          | 'quickbooks.delivery.v1'
                          | 'kofi.delivery.v1'
                          | 'braintree.delivery.v1'
                          | 'paypal.delivery.v1'
                          | 'notion.delivery.v1'
                          | 'asana.delivery.v1'
                          | 'cursor.delivery.v1'
                          | 'google_calendar.delivery.v1'
                          | 'graph.change_notification.provider.v1'
                          | 'meta.delivery.v1'
                          | 'zoom.delivery.v1';
                        allowedSecretRefs: string[];
                        allowedBootstrapCaptureRefs: string[];
                      };
                    }[];
                  }
                | {
                    mechanism: 'path_secret_only';
                    baseline: 'receiver_path_secret';
                    reason: string;
                  }
                | null;
            };
          };
      providerId: string;
      providerSpecificationId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceCallbacksInstancesGetOutput =
  mtMap.object<DashboardInstanceCallbacksInstancesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    integrationInstanceId: mtMap.objectField(
      'integration_instance_id',
      mtMap.passthrough()
    ),
    integrationInstanceProviderId: mtMap.objectField(
      'integration_instance_provider_id',
      mtMap.passthrough()
    ),
    status: mtMap.objectField('status', mtMap.passthrough()),
    registrationStatus: mtMap.objectField(
      'registration_status',
      mtMap.passthrough()
    ),
    registrationGeneration: mtMap.objectField(
      'registration_generation',
      mtMap.passthrough()
    ),
    registrationTransitionVersion: mtMap.objectField(
      'registration_transition_version',
      mtMap.passthrough()
    ),
    registrationError: mtMap.objectField(
      'registration_error',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        at: mtMap.objectField('at', mtMap.date())
      })
    ),
    lastRegistrationSyncError: mtMap.objectField(
      'last_registration_sync_error',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough()),
        at: mtMap.objectField('at', mtMap.date())
      })
    ),
    verificationMechanism: mtMap.objectField(
      'verification_mechanism',
      mtMap.passthrough()
    ),
    verificationSpecHash: mtMap.objectField(
      'verification_spec_hash',
      mtMap.passthrough()
    ),
    deployment: mtMap.objectField(
      'deployment',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    config: mtMap.objectField(
      'config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    authConfig: mtMap.objectField(
      'auth_config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    webhookUrl: mtMap.objectField('webhook_url', mtMap.passthrough()),
    receiverPathSecret: mtMap.objectField(
      'receiver_path_secret',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        generation: mtMap.objectField('generation', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    triggers: mtMap.objectField(
      'triggers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          active: mtMap.objectField('active', mtMap.passthrough()),
          authoritativeStateVersion: mtMap.objectField(
            'authoritative_state_version',
            mtMap.passthrough()
          ),
          source: mtMap.objectField('source', mtMap.passthrough()),
          pollIntervalSeconds: mtMap.objectField(
            'poll_interval_seconds',
            mtMap.passthrough()
          ),
          nextPollAt: mtMap.objectField('next_poll_at', mtMap.date()),
          lastPolledAt: mtMap.objectField('last_polled_at', mtMap.date()),
          webhookUrl: mtMap.objectField('webhook_url', mtMap.passthrough()),
          isWebhookRegistered: mtMap.objectField(
            'is_webhook_registered',
            mtMap.passthrough()
          ),
          registrationStatus: mtMap.objectField(
            'registration_status',
            mtMap.passthrough()
          ),
          registrationGeneration: mtMap.objectField(
            'registration_generation',
            mtMap.passthrough()
          ),
          registrationTransitionVersion: mtMap.objectField(
            'registration_transition_version',
            mtMap.passthrough()
          ),
          registrationError: mtMap.objectField(
            'registration_error',
            mtMap.object({
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough()),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              at: mtMap.objectField('at', mtMap.date())
            })
          ),
          verificationMechanism: mtMap.objectField(
            'verification_mechanism',
            mtMap.passthrough()
          ),
          verificationSpecHash: mtMap.objectField(
            'verification_spec_hash',
            mtMap.passthrough()
          ),
          providerTrigger: mtMap.objectField(
            'provider_trigger',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              key: mtMap.objectField('key', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              inputSchema: mtMap.objectField(
                'input_schema',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  schema: mtMap.objectField('schema', mtMap.passthrough())
                })
              ),
              outputSchema: mtMap.objectField(
                'output_schema',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  schema: mtMap.objectField('schema', mtMap.passthrough())
                })
              ),
              eventTypes: mtMap.objectField(
                'event_types',
                mtMap.array(mtMap.passthrough())
              ),
              invocation: mtMap.objectField(
                'invocation',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      intervalSeconds: mtMap.objectField(
                        'interval_seconds',
                        mtMap.passthrough()
                      ),
                      autoRegistration: mtMap.objectField(
                        'auto_registration',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      autoUnregistration: mtMap.objectField(
                        'auto_unregistration',
                        mtMap.object({
                          status: mtMap.objectField(
                            'status',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      http: mtMap.objectField(
                        'http',
                        mtMap.object({
                          verification: mtMap.objectField(
                            'verification',
                            mtMap.union([
                              mtMap.unionOption(
                                'object',
                                mtMap.object({
                                  mechanism: mtMap.objectField(
                                    'mechanism',
                                    mtMap.passthrough()
                                  ),
                                  baseline: mtMap.objectField(
                                    'baseline',
                                    mtMap.passthrough()
                                  ),
                                  allowedSecretRefs: mtMap.objectField(
                                    'allowedSecretRefs',
                                    mtMap.array(
                                      mtMap.union([
                                        mtMap.unionOption(
                                          'object',
                                          mtMap.object({
                                            source: mtMap.objectField(
                                              'source',
                                              mtMap.passthrough()
                                            ),
                                            name: mtMap.objectField(
                                              'name',
                                              mtMap.passthrough()
                                            ),
                                            credentialKey: mtMap.objectField(
                                              'credentialKey',
                                              mtMap.passthrough()
                                            ),
                                            authMethods: mtMap.objectField(
                                              'authMethods',
                                              mtMap.array(mtMap.passthrough())
                                            ),
                                            encoding: mtMap.objectField(
                                              'encoding',
                                              mtMap.passthrough()
                                            ),
                                            callbackSecretKey:
                                              mtMap.objectField(
                                                'callbackSecretKey',
                                                mtMap.passthrough()
                                              ),
                                            registrationKey: mtMap.objectField(
                                              'registrationKey',
                                              mtMap.passthrough()
                                            ),
                                            binding: mtMap.objectField(
                                              'binding',
                                              mtMap.passthrough()
                                            )
                                          })
                                        )
                                      ])
                                    )
                                  ),
                                  rules: mtMap.objectField(
                                    'rules',
                                    mtMap.array(
                                      mtMap.object({
                                        id: mtMap.objectField(
                                          'id',
                                          mtMap.passthrough()
                                        ),
                                        phase: mtMap.objectField(
                                          'phase',
                                          mtMap.passthrough()
                                        ),
                                        maxBodyBytes: mtMap.objectField(
                                          'maxBodyBytes',
                                          mtMap.passthrough()
                                        ),
                                        when: mtMap.objectField(
                                          'when',
                                          mtMap.object({
                                            methods: mtMap.objectField(
                                              'methods',
                                              mtMap.array(mtMap.passthrough())
                                            ),
                                            registrationStatuses:
                                              mtMap.objectField(
                                                'registrationStatuses',
                                                mtMap.array(mtMap.passthrough())
                                              ),
                                            matcher: mtMap.objectField(
                                              'matcher',
                                              mtMap.object({
                                                method: mtMap.objectField(
                                                  'method',
                                                  mtMap.passthrough()
                                                ),
                                                hasQueryParam:
                                                  mtMap.objectField(
                                                    'hasQueryParam',
                                                    mtMap.passthrough()
                                                  ),
                                                lacksQueryParam:
                                                  mtMap.objectField(
                                                    'lacksQueryParam',
                                                    mtMap.passthrough()
                                                  ),
                                                hasHeader: mtMap.objectField(
                                                  'hasHeader',
                                                  mtMap.passthrough()
                                                ),
                                                jsonBodyField:
                                                  mtMap.objectField(
                                                    'jsonBodyField',
                                                    mtMap.object({
                                                      path: mtMap.objectField(
                                                        'path',
                                                        mtMap.passthrough()
                                                      ),
                                                      equals: mtMap.objectField(
                                                        'equals',
                                                        mtMap.passthrough()
                                                      )
                                                    })
                                                  ),
                                                formBodyField:
                                                  mtMap.objectField(
                                                    'formBodyField',
                                                    mtMap.object({
                                                      path: mtMap.objectField(
                                                        'path',
                                                        mtMap.passthrough()
                                                      ),
                                                      equals: mtMap.objectField(
                                                        'equals',
                                                        mtMap.passthrough()
                                                      )
                                                    })
                                                  )
                                              })
                                            )
                                          })
                                        ),
                                        result: mtMap.objectField(
                                          'result',
                                          mtMap.union([
                                            mtMap.unionOption(
                                              'object',
                                              mtMap.object({
                                                type: mtMap.objectField(
                                                  'type',
                                                  mtMap.passthrough()
                                                ),
                                                scope: mtMap.objectField(
                                                  'scope',
                                                  mtMap.passthrough()
                                                )
                                              })
                                            )
                                          ])
                                        ),
                                        replay: mtMap.objectField(
                                          'replay',
                                          mtMap.union([
                                            mtMap.unionOption(
                                              'object',
                                              mtMap.object({
                                                kind: mtMap.objectField(
                                                  'kind',
                                                  mtMap.passthrough()
                                                ),
                                                freshness: mtMap.objectField(
                                                  'freshness',
                                                  mtMap.union([
                                                    mtMap.unionOption(
                                                      'object',
                                                      mtMap.object({
                                                        source:
                                                          mtMap.objectField(
                                                            'source',
                                                            mtMap.passthrough()
                                                          ),
                                                        presetField:
                                                          mtMap.objectField(
                                                            'presetField',
                                                            mtMap.passthrough()
                                                          ),
                                                        format:
                                                          mtMap.objectField(
                                                            'format',
                                                            mtMap.passthrough()
                                                          ),
                                                        maxAgeSeconds:
                                                          mtMap.objectField(
                                                            'maxAgeSeconds',
                                                            mtMap.passthrough()
                                                          ),
                                                        maxFutureSkewSeconds:
                                                          mtMap.objectField(
                                                            'maxFutureSkewSeconds',
                                                            mtMap.passthrough()
                                                          ),
                                                        headerName:
                                                          mtMap.objectField(
                                                            'headerName',
                                                            mtMap.passthrough()
                                                          ),
                                                        pointer:
                                                          mtMap.objectField(
                                                            'pointer',
                                                            mtMap.passthrough()
                                                          )
                                                      })
                                                    )
                                                  ])
                                                ),
                                                deduplicate: mtMap.objectField(
                                                  'deduplicate',
                                                  mtMap.union([
                                                    mtMap.unionOption(
                                                      'object',
                                                      mtMap.object({
                                                        source:
                                                          mtMap.objectField(
                                                            'source',
                                                            mtMap.passthrough()
                                                          ),
                                                        presetField:
                                                          mtMap.objectField(
                                                            'presetField',
                                                            mtMap.passthrough()
                                                          ),
                                                        ttlSeconds:
                                                          mtMap.objectField(
                                                            'ttlSeconds',
                                                            mtMap.passthrough()
                                                          ),
                                                        scope:
                                                          mtMap.objectField(
                                                            'scope',
                                                            mtMap.passthrough()
                                                          ),
                                                        headerName:
                                                          mtMap.objectField(
                                                            'headerName',
                                                            mtMap.passthrough()
                                                          ),
                                                        pointer:
                                                          mtMap.objectField(
                                                            'pointer',
                                                            mtMap.passthrough()
                                                          )
                                                      })
                                                    )
                                                  ])
                                                ),
                                                reason: mtMap.objectField(
                                                  'reason',
                                                  mtMap.passthrough()
                                                )
                                              })
                                            )
                                          ])
                                        ),
                                        verify: mtMap.objectField(
                                          'verify',
                                          mtMap.object({
                                            type: mtMap.objectField(
                                              'type',
                                              mtMap.passthrough()
                                            ),
                                            verifierId: mtMap.objectField(
                                              'verifierId',
                                              mtMap.passthrough()
                                            ),
                                            allowedSecretRefs:
                                              mtMap.objectField(
                                                'allowedSecretRefs',
                                                mtMap.array(mtMap.passthrough())
                                              ),
                                            allowedBootstrapCaptureRefs:
                                              mtMap.objectField(
                                                'allowedBootstrapCaptureRefs',
                                                mtMap.array(mtMap.passthrough())
                                              )
                                          })
                                        )
                                      })
                                    )
                                  ),
                                  reason: mtMap.objectField(
                                    'reason',
                                    mtMap.passthrough()
                                  )
                                })
                              )
                            ])
                          )
                        })
                      )
                    })
                  )
                ])
              ),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              providerSpecificationId: mtMap.objectField(
                'provider_specification_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

