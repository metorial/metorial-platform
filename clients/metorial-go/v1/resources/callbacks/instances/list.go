package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesListOutputItemsTriggersProviderTriggerInputSchema represents the callbacks instances list output items triggers provider trigger input schema type.
type CallbacksInstancesListOutputItemsTriggersProviderTriggerInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger payload input shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesListOutputItemsTriggersProviderTriggerOutputSchema represents the callbacks instances list output items triggers provider trigger output schema type.
type CallbacksInstancesListOutputItemsTriggersProviderTriggerOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger delivery output shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoRegistration represents the callbacks instances list output items triggers provider trigger invocation auto registration type.
type CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoRegistration struct {
	// Status - Whether automatic webhook registration is supported
	Status string `json:"status"`
}

// CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoUnregistration represents the callbacks instances list output items triggers provider trigger invocation auto unregistration type.
type CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoUnregistration struct {
	// Status - Whether automatic webhook removal is supported
	Status string `json:"status"`
}

// CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocation represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocation struct {
	Type *string `json:"type,omitempty"`
	// IntervalSeconds - Polling interval in seconds for polling-based triggers
	IntervalSeconds    *float64                                                                              `json:"interval_seconds,omitempty"`
	AutoRegistration   *CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoRegistration   `json:"auto_registration,omitempty"`
	AutoUnregistration *CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocationAutoUnregistration `json:"auto_unregistration,omitempty"`
}

// CallbacksInstancesListOutputItemsTriggersProviderTrigger represents the callbacks instances list output items triggers provider trigger type.
type CallbacksInstancesListOutputItemsTriggersProviderTrigger struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider trigger identifier
	Id string `json:"id"`
	// Key - Trigger key used when subscribing callbacks
	Key string `json:"key"`
	// Name - Display name of the trigger
	Name string `json:"name"`
	// Description - Trigger description
	Description  *string                                                               `json:"description,omitempty"`
	InputSchema  *CallbacksInstancesListOutputItemsTriggersProviderTriggerInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *CallbacksInstancesListOutputItemsTriggersProviderTriggerOutputSchema `json:"output_schema,omitempty"`
	Invocation   CallbacksInstancesListOutputItemsTriggersProviderTriggerInvocation    `json:"invocation"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Provider specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksInstancesListOutputItemsTriggers represents the callbacks instances list output items triggers type.
type CallbacksInstancesListOutputItemsTriggers struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique receiver trigger identifier
	Id string `json:"id"`
	// Source - How this trigger is invoked by the provider backend
	Source string `json:"source"`
	// PollIntervalSeconds - Polling interval in seconds when the trigger uses polling
	PollIntervalSeconds *float64 `json:"poll_interval_seconds,omitempty"`
	// NextPollAt - Next scheduled poll timestamp for polling triggers
	NextPollAt *time.Time `json:"next_poll_at,omitempty"`
	// LastPolledAt - Last successful poll timestamp for polling triggers
	LastPolledAt *time.Time `json:"last_polled_at,omitempty"`
	// WebhookUrl - Provider webhook URL registered for this trigger when webhook delivery is used
	WebhookUrl *string `json:"webhook_url,omitempty"`
	// IsWebhookRegistered - Whether webhook registration is currently active for this trigger
	IsWebhookRegistered *bool                                                     `json:"is_webhook_registered,omitempty"`
	ProviderTrigger     *CallbacksInstancesListOutputItemsTriggersProviderTrigger `json:"provider_trigger,omitempty"`
}

// CallbacksInstancesListOutputItems represents the callbacks instances list output items type.
type CallbacksInstancesListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback instance identifier
	Id string `json:"id"`
	// Status - Whether the callback instance is currently attached to a deployment/config pair
	Status string `json:"status"`
	// RegistrationStatus - Registration state of the underlying trigger receiver
	RegistrationStatus string `json:"registration_status"`
	// Triggers - Resolved trigger registrations for this callback instance
	Triggers []CallbacksInstancesListOutputItemsTriggers `json:"triggers"`
	// CreatedAt - Timestamp when the callback instance was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback instance was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksInstancesListOutputPagination represents the callbacks instances list output pagination type.
type CallbacksInstancesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksInstancesListOutput represents the callbacks instances list output type.
type CallbacksInstancesListOutput struct {
	Items      []CallbacksInstancesListOutputItems    `json:"items"`
	Pagination CallbacksInstancesListOutputPagination `json:"pagination"`
}

// MapCallbacksInstancesListOutputFromJSON deserializes JSON data into a CallbacksInstancesListOutput.
func MapCallbacksInstancesListOutputFromJSON(data []byte) (*CallbacksInstancesListOutput, error) {
	var v CallbacksInstancesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesListOutputToJSON serializes a CallbacksInstancesListOutput to JSON.
func MapCallbacksInstancesListOutputToJSON(v *CallbacksInstancesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksInstancesListQuery represents the callbacks instances list query type.
type CallbacksInstancesListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by callback instance ID(s)
	Id *any `json:"id,omitempty"`
	// Status - Filter by callback instance status
	Status *any `json:"status,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// MapCallbacksInstancesListQueryFromJSON deserializes JSON data into a CallbacksInstancesListQuery.
func MapCallbacksInstancesListQueryFromJSON(data []byte) (*CallbacksInstancesListQuery, error) {
	var v CallbacksInstancesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesListQueryToJSON serializes a CallbacksInstancesListQuery to JSON.
func MapCallbacksInstancesListQueryToJSON(v *CallbacksInstancesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
