import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';
import {
  getWebhookSetupErrorMessages,
  orderJsonSchemaPropertiesByRequired
} from './webhookRegistrationSetup';

// The delivery setup schema as the API returns it: properties out of order, `required` in order.
let schema: JSONSchema7 = {
  type: 'object',
  properties: {
    topicName: { type: 'string', title: 'Topic name' },
    oauthClientId: { type: 'string', title: 'OAuth client ID' },
    subscriptionName: { type: 'string', title: 'Subscription name' },
    pushServiceAccountEmail: { type: 'string', title: 'Push service account' }
  },
  required: ['oauthClientId', 'topicName', 'subscriptionName', 'pushServiceAccountEmail']
};

describe('setup schema field order', () => {
  it('orders the fields the way `required` lists them', () => {
    expect(Object.keys(orderJsonSchemaPropertiesByRequired(schema).properties!)).toEqual([
      'oauthClientId',
      'topicName',
      'subscriptionName',
      'pushServiceAccountEmail'
    ]);
  });

  it('keeps fields that are not required after the required ones, in their own order', () => {
    let ordered = orderJsonSchemaPropertiesByRequired({
      type: 'object',
      properties: {
        note: { type: 'string' },
        secret: { type: 'string' },
        label: { type: 'string' },
        url: { type: 'string' }
      },
      required: ['url', 'secret']
    });

    expect(Object.keys(ordered.properties!)).toEqual(['url', 'secret', 'note', 'label']);
  });

  it('leaves a schema without `required` or without properties alone', () => {
    let withoutRequired: JSONSchema7 = {
      type: 'object',
      properties: { b: { type: 'string' }, a: { type: 'string' } }
    };

    expect(orderJsonSchemaPropertiesByRequired(withoutRequired)).toBe(withoutRequired);
    expect(orderJsonSchemaPropertiesByRequired(null)).toBeNull();
  });

  it('does not change the schema it was given', () => {
    orderJsonSchemaPropertiesByRequired(schema);

    expect(Object.keys(schema.properties!)[0]).toBe('topicName');
  });
});

describe('setup error messages', () => {
  let validationError = {
    status: 400,
    code: 'invalid_data',
    message: 'Invalid webhook setup configuration.',
    entity: 'webhook_registration.user_config',
    errors: [
      {
        origin: 'string',
        code: 'invalid_format',
        format: 'regex',
        pattern: '/^projects\\/[^/\\s]+\\/topics\\/[^/\\s]+$/',
        path: ['topicName'],
        message:
          'Invalid string: must match pattern /^projects\\/[^/\\s]+\\/topics\\/[^/\\s]+$/'
      }
    ]
  };

  it('has nothing to show without an error', () => {
    expect(getWebhookSetupErrorMessages({ schema, error: null })).toEqual({
      message: null,
      fieldErrors: {}
    });
  });

  it('names the failing field by its title, keyed the way the form shows field errors', () => {
    let res = getWebhookSetupErrorMessages({ schema, error: validationError });

    expect(res.fieldErrors).toEqual({
      'Topic name': 'Topic name is not in the expected format.'
    });
    expect(res.message).toBe('Invalid webhook setup configuration. Check Topic name.');
  });

  it('reports every failing field once', () => {
    let res = getWebhookSetupErrorMessages({
      schema,
      error: {
        ...validationError,
        errors: [
          ...validationError.errors,
          { code: 'too_small', path: ['topicName'], message: 'Too small' },
          {
            code: 'invalid_type',
            path: ['oauthClientId'],
            message: 'Invalid input: expected string, received undefined'
          }
        ]
      }
    });

    expect(res.fieldErrors).toEqual({
      'Topic name': 'Topic name is not in the expected format.',
      'OAuth client ID': 'OAuth client ID is not valid.'
    });
    expect(res.message).toBe(
      'Invalid webhook setup configuration. Check Topic name, OAuth client ID.'
    );
  });

  it('falls back to the formatted key for a field without a title', () => {
    let res = getWebhookSetupErrorMessages({
      schema: { type: 'object', properties: { signingSecret: { type: 'string' } } },
      error: {
        message: 'Invalid webhook setup configuration.',
        errors: [
          { code: 'invalid_format', path: ['signingSecret'], message: 'Invalid string' }
        ]
      }
    });

    expect(res.fieldErrors).toEqual({
      'Signing Secret': 'Signing Secret is not in the expected format.'
    });
  });

  it('keys a nested field by the titles on its path', () => {
    let res = getWebhookSetupErrorMessages({
      schema: {
        type: 'object',
        properties: {
          google: {
            type: 'object',
            title: 'Google',
            properties: { topicName: { type: 'string', title: 'Topic name' } }
          }
        }
      },
      error: {
        message: 'Invalid webhook setup configuration.',
        errors: [{ code: 'invalid_format', path: ['google', 'topicName'], message: 'Invalid' }]
      }
    });

    expect(res.fieldErrors).toEqual({
      'Google > Topic name': 'Topic name is not in the expected format.'
    });
  });

  it('puts a failure it cannot place on a field into the message, with the server detail', () => {
    let res = getWebhookSetupErrorMessages({ schema: null, error: validationError });

    expect(res.fieldErrors).toEqual({});
    expect(res.message).toBe(
      'Invalid webhook setup configuration. topicName: Invalid string: must match pattern /^projects\\/[^/\\s]+\\/topics\\/[^/\\s]+$/'
    );
  });

  it("shows the integration's own message as it arrives", () => {
    let res = getWebhookSetupErrorMessages({
      schema,
      error: {
        message:
          'Unable to finish webhook setup: Topic name must look like projects/<project>/topics/<name>.'
      }
    });

    expect(res).toEqual({
      message:
        'Unable to finish webhook setup: Topic name must look like projects/<project>/topics/<name>.',
      fieldErrors: {}
    });
  });

  it('still says something when the server sent no message', () => {
    expect(getWebhookSetupErrorMessages({ schema, error: {} }).message).toBe(
      'Setup could not be completed.'
    );
  });
});
