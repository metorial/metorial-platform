package triggers

import (
	"encoding/json"
	"time"
)

// ProvidersTriggersGetOutputInputSchema represents the providers triggers get output input schema type.
type ProvidersTriggersGetOutputInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger payload input shape
	Schema map[string]any `json:"schema"`
}

// ProvidersTriggersGetOutputOutputSchema represents the providers triggers get output output schema type.
type ProvidersTriggersGetOutputOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger delivery output shape
	Schema map[string]any `json:"schema"`
}

// ProvidersTriggersGetOutputInvocationAutoRegistration represents the providers triggers get output invocation auto registration type.
type ProvidersTriggersGetOutputInvocationAutoRegistration struct {
	// Status - Whether automatic webhook registration is supported
	Status string `json:"status"`
}

// ProvidersTriggersGetOutputInvocationAutoUnregistration represents the providers triggers get output invocation auto unregistration type.
type ProvidersTriggersGetOutputInvocationAutoUnregistration struct {
	// Status - Whether automatic webhook removal is supported
	Status string `json:"status"`
}

// ProvidersTriggersGetOutputInvocation represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type ProvidersTriggersGetOutputInvocation struct {
	Type *string `json:"type,omitempty"`
	// IntervalSeconds - Polling interval in seconds for polling-based triggers
	IntervalSeconds    *float64                                                `json:"interval_seconds,omitempty"`
	AutoRegistration   *ProvidersTriggersGetOutputInvocationAutoRegistration   `json:"auto_registration,omitempty"`
	AutoUnregistration *ProvidersTriggersGetOutputInvocationAutoUnregistration `json:"auto_unregistration,omitempty"`
}

// ProvidersTriggersGetOutput represents the providers triggers get output type.
type ProvidersTriggersGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider trigger identifier
	Id string `json:"id"`
	// Key - Trigger key used when subscribing callbacks
	Key string `json:"key"`
	// Name - Display name of the trigger
	Name string `json:"name"`
	// Description - Trigger description
	Description  *string                                 `json:"description,omitempty"`
	InputSchema  *ProvidersTriggersGetOutputInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersTriggersGetOutputOutputSchema `json:"output_schema,omitempty"`
	Invocation   ProvidersTriggersGetOutputInvocation    `json:"invocation"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Provider specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProvidersTriggersGetOutputFromJSON deserializes JSON data into a ProvidersTriggersGetOutput.
func MapProvidersTriggersGetOutputFromJSON(data []byte) (*ProvidersTriggersGetOutput, error) {
	var v ProvidersTriggersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersTriggersGetOutputToJSON serializes a ProvidersTriggersGetOutput to JSON.
func MapProvidersTriggersGetOutputToJSON(v *ProvidersTriggersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
