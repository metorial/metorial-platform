package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/callbacks/destinations"
)

// CallbacksDestinationsEndpoint provides access to manage callback webhook destinations.
type CallbacksDestinationsEndpoint struct {
	client *endpoint.Client
}

// NewCallbacksDestinationsEndpoint creates a new CallbacksDestinationsEndpoint.
func NewCallbacksDestinationsEndpoint(client *endpoint.Client) *CallbacksDestinationsEndpoint {
	return &CallbacksDestinationsEndpoint{client: client}
}

// CallbacksDestinationsEndpointListParams contains optional query parameters for List.
type CallbacksDestinationsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// CallbacksDestinationsEndpointCreateBody contains the request body for Create.
type CallbacksDestinationsEndpointCreateBody struct {
	// Name - Display name for the callback destination
	Name string `json:"name"`
	// Description - Optional callback destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Webhook URL that should receive callback deliveries
	Url string `json:"url"`
}

// CallbacksDestinationsEndpointUpdateBody contains the request body for Update.
type CallbacksDestinationsEndpointUpdateBody struct {
	// Name - Updated callback destination name
	Name *string `json:"name,omitempty"`
	// Description - Updated destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Updated destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Updated webhook URL for callback deliveries
	Url *string `json:"url,omitempty"`
}

// List returns a paginated list of callback destinations.
func (e *CallbacksDestinationsEndpoint) List(instanceId string, params *CallbacksDestinationsEndpointListParams) (*destinations.CallbacksDestinationsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "callback-destinations"},
		Query: query,
	}
	var result destinations.CallbacksDestinationsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific callback destination.
func (e *CallbacksDestinationsEndpoint) Get(instanceId string, callbackDestinationId string) (*destinations.CallbacksDestinationsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callback-destinations", callbackDestinationId},
	}
	var result destinations.CallbacksDestinationsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new callback destination.
func (e *CallbacksDestinationsEndpoint) Create(instanceId string, body *CallbacksDestinationsEndpointCreateBody) (*destinations.CallbacksDestinationsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callback-destinations"},
		Body: body,
	}
	var result destinations.CallbacksDestinationsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a callback destination.
func (e *CallbacksDestinationsEndpoint) Update(instanceId string, callbackDestinationId string, body *CallbacksDestinationsEndpointUpdateBody) (*destinations.CallbacksDestinationsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callback-destinations", callbackDestinationId},
		Body: body,
	}
	var result destinations.CallbacksDestinationsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives a callback destination.
func (e *CallbacksDestinationsEndpoint) Delete(instanceId string, callbackDestinationId string) (*destinations.CallbacksDestinationsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callback-destinations", callbackDestinationId},
	}
	var result destinations.CallbacksDestinationsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
