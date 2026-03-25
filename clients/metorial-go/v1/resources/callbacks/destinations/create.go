package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsCreateOutput represents the callbacks destinations create output type.
type CallbacksDestinationsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback destination identifier
	Id string `json:"id"`
	// Status - Callback destination lifecycle status
	Status string `json:"status"`
	// Name - Display name for the callback destination
	Name string `json:"name"`
	// Description - Optional destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Webhook URL that receives callback deliveries
	Url string `json:"url"`
	// Method - HTTP method used for webhook delivery
	Method string `json:"method"`
	// CreatedAt - Timestamp when the callback destination was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback destination was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksDestinationsCreateOutputFromJSON deserializes JSON data into a CallbacksDestinationsCreateOutput.
func MapCallbacksDestinationsCreateOutputFromJSON(data []byte) (*CallbacksDestinationsCreateOutput, error) {
	var v CallbacksDestinationsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsCreateOutputToJSON serializes a CallbacksDestinationsCreateOutput to JSON.
func MapCallbacksDestinationsCreateOutputToJSON(v *CallbacksDestinationsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksDestinationsCreateBody represents the callbacks destinations create body type.
type CallbacksDestinationsCreateBody struct {
	// Name - Display name for the callback destination
	Name string `json:"name"`
	// Description - Optional callback destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Webhook URL that should receive callback deliveries
	Url string `json:"url"`
}

// MapCallbacksDestinationsCreateBodyFromJSON deserializes JSON data into a CallbacksDestinationsCreateBody.
func MapCallbacksDestinationsCreateBodyFromJSON(data []byte) (*CallbacksDestinationsCreateBody, error) {
	var v CallbacksDestinationsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsCreateBodyToJSON serializes a CallbacksDestinationsCreateBody to JSON.
func MapCallbacksDestinationsCreateBodyToJSON(v *CallbacksDestinationsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
