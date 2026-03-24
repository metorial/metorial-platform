package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/callbacks"
)

// CallbacksEndpoint provides access to manage webhook-style callbacks backed by subspace trigger receivers.
type CallbacksEndpoint struct {
	client *endpoint.Client
}

// NewCallbacksEndpoint creates a new CallbacksEndpoint.
func NewCallbacksEndpoint(client *endpoint.Client) *CallbacksEndpoint {
	return &CallbacksEndpoint{client: client}
}

// CallbacksEndpointListParams contains optional query parameters for List.
type CallbacksEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by callback ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// Status - Filter by callback lifecycle status
	Status *any `json:"status,omitempty"`
}

// CallbacksEndpointCreateBody contains the request body for Create.
type CallbacksEndpointCreateBody struct {
	// ProviderDeploymentId - Provider deployment that owns the trigger specification for this callback
	ProviderDeploymentId string `json:"provider_deployment_id"`
	// Name - Display name for the callback
	Name string `json:"name"`
	// Description - Optional callback description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional callback metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// PollIntervalSecondsOverride - Optional polling interval override, in seconds, for polling triggers
	PollIntervalSecondsOverride *float64 `json:"poll_interval_seconds_override,omitempty"`
	// DestinationIds - Callback destination IDs that should receive deliveries
	DestinationIds []string         `json:"destination_ids"`
	Triggers       []map[string]any `json:"triggers"`
}

// CallbacksEndpointUpdateBody contains the request body for Update.
type CallbacksEndpointUpdateBody struct {
	// Name - Updated callback display name
	Name *string `json:"name,omitempty"`
	// Description - Updated callback description
	Description *string `json:"description,omitempty"`
	// Metadata - Updated custom metadata for the callback
	Metadata *map[string]any `json:"metadata,omitempty"`
	// PollIntervalSecondsOverride - Updated polling interval override, in seconds
	PollIntervalSecondsOverride *float64 `json:"poll_interval_seconds_override,omitempty"`
	// DestinationIds - Replacement list of callback destination IDs
	DestinationIds *[]string         `json:"destination_ids,omitempty"`
	Triggers       *[]map[string]any `json:"triggers,omitempty"`
}

// List returns a paginated list of callbacks.
func (e *CallbacksEndpoint) List(instanceId string, params *CallbacksEndpointListParams) (*callbacks.CallbacksListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "callbacks"},
		Query: query,
	}
	var result callbacks.CallbacksListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific callback by ID.
func (e *CallbacksEndpoint) Get(instanceId string, callbackId string) (*callbacks.CallbacksGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId},
	}
	var result callbacks.CallbacksGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new callback definition.
func (e *CallbacksEndpoint) Create(instanceId string, body *CallbacksEndpointCreateBody) (*callbacks.CallbacksCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks"},
		Body: body,
	}
	var result callbacks.CallbacksCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a callback definition.
func (e *CallbacksEndpoint) Update(instanceId string, callbackId string, body *CallbacksEndpointUpdateBody) (*callbacks.CallbacksUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId},
		Body: body,
	}
	var result callbacks.CallbacksUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives a callback definition.
func (e *CallbacksEndpoint) Delete(instanceId string, callbackId string) (*callbacks.CallbacksDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId},
	}
	var result callbacks.CallbacksDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
