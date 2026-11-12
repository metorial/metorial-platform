# Managed trigger delivery

Pure functions the hub uses for trigger groups that deliver through shared provider infrastructure. They choose the saved delivery config a registration should use and authenticate what arrives for one. The first transport is Google Pub/Sub, for Gmail, Forms, Meet and Cloud Storage.

Nothing is provisioned here. The package holds no state, reads no environment, stores no key and makes no network call other than fetching Google's public signing keys to verify a push token. The topic, the push subscription and their IAM bindings are created by a person in their own Google Cloud project, following the setup document the integration shows them.

## Delivery configs

A trigger group asks for managed delivery by declaring `googlePubSub: { product }` in its invocation. The product is `gmail`, `forms`, `meet` or `storage`. Such a group registers automatically, and it also declares a setup a person completes once per Google OAuth app. The saved result of that setup is a delivery config.

In the hub a delivery config is a webhook registration of type `manual` on that trigger group:

- The platform operator creates a global one for the platform's managed Google OAuth app. Every tenant whose connection uses that app delivers through it.
- A customer creates one in their own workspace for their own Google OAuth app. Only that customer's registrations can use it.

Its saved payload is what the integration returned when the setup was finished:

```json
{
  "oauthClientId": "CLIENT_ID.apps.googleusercontent.com",
  "googlePubSub": {
    "projectId": "cloud-project",
    "topicName": "projects/cloud-project/topics/TOPIC",
    "subscriptionName": "projects/cloud-project/subscriptions/SUBSCRIPTION",
    "pushServiceAccountEmail": "PUSH_ACCOUNT@cloud-project.iam.gserviceaccount.com",
    "audience": "https://HUB_TRIGGER_HOST/receive/URL_KEY"
  }
}
```

`audience` is the config's own receive URL. The push subscription must use it as both its endpoint and its token audience, and sign with `pushServiceAccountEmail`. The payload contains no credential: the descriptor is public configuration, and the token on each push is what proves a delivery is genuine.

## Choosing a config

`selectTriggerDeliveryConfig({ invocation, oauthClientId, configs })` is called before a registration or renewal reaches the provider.

- It returns `undefined` for a trigger group that does not ask for managed delivery.
- It fails when the capability is one it does not know, or when the connection has no OAuth client ID.
- Otherwise it returns `{ bindingId, infrastructure: { googlePubSub } }` for the first config, in the order given, whose payload is a valid delivery config for exactly that OAuth client ID. `bindingId` is the config's `id`. It returns `undefined` when none matches.

The caller decides which configs are candidates and in what order. The hub passes the tenant's own active configs for the integration and trigger group first, oldest first, then the global ones. It never loads another tenant's. When nothing matches, the registration fails with `trigger_delivery_config_missing` and is tried again as soon as a matching config is finished.

The integration receives only the `googlePubSub` descriptor, saves it with its registration, and returns the routing keys of what it registered: the mailbox address, the form ID, the event subscription or the bucket notification. The hub stores those keys under the `bindingId`.

## Receiving a push

A push arrives on the config's receive URL. `authenticateTriggerDelivery({ invocation, payload, request })` verifies it against that config's payload and returns one of:

- `{ ok: true, routingKeys }` when Google's signature, issuer, expiry, audience, verified push-account email and subscription name all match. The routing keys name the registrations the message addresses.
- `{ ok: true, routingKeys: [] }` for an authenticated message that is malformed or belongs to another subscription. Rejecting it would only make Pub/Sub redeliver it.
- `{ ok: false, status }` for anything else, including a payload that is not a delivery config (`404`) and a signing-key outage (`503`), so the sender retries.

The hub hands the unchanged request to every active registration that holds a matching key under that config's `bindingId`, and acknowledges the push once those hand-offs are stored. A failed hand-off rejects the push so Pub/Sub repeats it; registrations that had already accepted it drop the repeat by its idempotency key. Each registration's integration verifies the request again against its own saved descriptor. Verification here is not a substitute for that.

## Shared watches

Google keeps one Gmail watch per mailbox and one Forms watch per form and event type for each Cloud project. Registrations that share a config and a routing key therefore share the provider watch, and each receives the events. The hub does not ask a provider to remove a watch while another registration holds the same key under the same config.

## Removing a config

When a config is deleted, the hub unregisters the registrations that deliver through it and registers the ones still in use again. They pick up another matching config if there is one, and otherwise fail with `trigger_delivery_config_missing`. The topic and subscription are left alone, because nothing here created them.

## Verification

Run the `test` and `check-types` scripts. The tests are offline: they cover choosing a config, payloads that are not delivery configs, the two failures that keep their own message, and push authentication with routing-key extraction for accepted, rejected and unroutable pushes.
