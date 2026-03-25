package triggers

import (
	"encoding/json"
	"time"
)

// ProvidersTriggersListOutputItemsInputSchema represents the providers triggers list output items input schema type.
type ProvidersTriggersListOutputItemsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger payload input shape
	Schema map[string]any `json:"schema"`
}

// ProvidersTriggersListOutputItemsOutputSchema represents the providers triggers list output items output schema type.
type ProvidersTriggersListOutputItemsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger delivery output shape
	Schema map[string]any `json:"schema"`
}

// ProvidersTriggersListOutputItemsInvocationAutoRegistration represents the providers triggers list output items invocation auto registration type.
type ProvidersTriggersListOutputItemsInvocationAutoRegistration struct {
	// Status - Whether automatic webhook registration is supported
	Status string `json:"status"`
}

// ProvidersTriggersListOutputItemsInvocationAutoUnregistration represents the providers triggers list output items invocation auto unregistration type.
type ProvidersTriggersListOutputItemsInvocationAutoUnregistration struct {
	// Status - Whether automatic webhook removal is supported
	Status string `json:"status"`
}

// ProvidersTriggersListOutputItemsInvocation represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type ProvidersTriggersListOutputItemsInvocation struct {
	Type *string `json:"type,omitempty"`
	// IntervalSeconds - Polling interval in seconds for polling-based triggers
	IntervalSeconds    *float64                                                      `json:"interval_seconds,omitempty"`
	AutoRegistration   *ProvidersTriggersListOutputItemsInvocationAutoRegistration   `json:"auto_registration,omitempty"`
	AutoUnregistration *ProvidersTriggersListOutputItemsInvocationAutoUnregistration `json:"auto_unregistration,omitempty"`
}

// ProvidersTriggersListOutputItems represents the providers triggers list output items type.
type ProvidersTriggersListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider trigger identifier
	Id string `json:"id"`
	// Key - Trigger key used when subscribing callbacks
	Key string `json:"key"`
	// Name - Display name of the trigger
	Name string `json:"name"`
	// Description - Trigger description
	Description  *string                                       `json:"description,omitempty"`
	InputSchema  *ProvidersTriggersListOutputItemsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersTriggersListOutputItemsOutputSchema `json:"output_schema,omitempty"`
	Invocation   ProvidersTriggersListOutputItemsInvocation    `json:"invocation"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Provider specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersTriggersListOutputPagination represents the providers triggers list output pagination type.
type ProvidersTriggersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersTriggersListOutput represents the providers triggers list output type.
type ProvidersTriggersListOutput struct {
	Items      []ProvidersTriggersListOutputItems    `json:"items"`
	Pagination ProvidersTriggersListOutputPagination `json:"pagination"`
}

// MapProvidersTriggersListOutputFromJSON deserializes JSON data into a ProvidersTriggersListOutput.
func MapProvidersTriggersListOutputFromJSON(data []byte) (*ProvidersTriggersListOutput, error) {
	var v ProvidersTriggersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersTriggersListOutputToJSON serializes a ProvidersTriggersListOutput to JSON.
func MapProvidersTriggersListOutputToJSON(v *ProvidersTriggersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersTriggersListQuery represents the providers triggers list query type.
type ProvidersTriggersListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// ProviderVersionId - Provider version to list triggers for
	ProviderVersionId string `json:"provider_version_id"`
}

// MapProvidersTriggersListQueryFromJSON deserializes JSON data into a ProvidersTriggersListQuery.
func MapProvidersTriggersListQueryFromJSON(data []byte) (*ProvidersTriggersListQuery, error) {
	var v ProvidersTriggersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersTriggersListQueryToJSON serializes a ProvidersTriggersListQuery to JSON.
func MapProvidersTriggersListQueryToJSON(v *ProvidersTriggersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
