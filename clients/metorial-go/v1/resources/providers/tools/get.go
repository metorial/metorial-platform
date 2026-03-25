package tools

import (
	"encoding/json"
	"time"
)

// ProvidersToolsGetOutputInputSchema represents the providers tools get output input schema type.
type ProvidersToolsGetOutputInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ProvidersToolsGetOutputOutputSchema represents the providers tools get output output schema type.
type ProvidersToolsGetOutputOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ProvidersToolsGetOutputTags represents the providers tools get output tags type.
type ProvidersToolsGetOutputTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ProvidersToolsGetOutput represents the providers tools get output type.
type ProvidersToolsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique tool identifier
	Id string `json:"id"`
	// Key - Tool key
	Key string `json:"key"`
	// Name - Display name of the tool
	Name string `json:"name"`
	// Description - Tool description
	Description *string `json:"description,omitempty"`
	// Capabilities - Tool capabilities
	Capabilities map[string]any `json:"capabilities"`
	// Constraints - Tool constraints
	Constraints []string `json:"constraints"`
	// Instructions - Tool usage instructions
	Instructions []string                             `json:"instructions"`
	InputSchema  *ProvidersToolsGetOutputInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersToolsGetOutputOutputSchema `json:"output_schema,omitempty"`
	Tags         *ProvidersToolsGetOutputTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProvidersToolsGetOutputFromJSON deserializes JSON data into a ProvidersToolsGetOutput.
func MapProvidersToolsGetOutputFromJSON(data []byte) (*ProvidersToolsGetOutput, error) {
	var v ProvidersToolsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersToolsGetOutputToJSON serializes a ProvidersToolsGetOutput to JSON.
func MapProvidersToolsGetOutputToJSON(v *ProvidersToolsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
