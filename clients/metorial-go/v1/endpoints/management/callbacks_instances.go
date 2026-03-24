package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/callbacks/instances"
)

// CallbacksInstancesEndpoint provides access to attach or detach callback instances for a deployment/config/auth-config combination.
type CallbacksInstancesEndpoint struct {
	client *endpoint.Client
}

// NewCallbacksInstancesEndpoint creates a new CallbacksInstancesEndpoint.
func NewCallbacksInstancesEndpoint(client *endpoint.Client) *CallbacksInstancesEndpoint {
	return &CallbacksInstancesEndpoint{client: client}
}

// CallbacksInstancesEndpointListParams contains optional query parameters for List.
type CallbacksInstancesEndpointListParams struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Id                   *any     `json:"id,omitempty"`
	Status               *any     `json:"status,omitempty"`
	ProviderConfigId     *any     `json:"provider_config_id,omitempty"`
	ProviderAuthConfigId *any     `json:"provider_auth_config_id,omitempty"`
}

// CallbacksInstancesEndpointCreateBody contains the request body for Create.
type CallbacksInstancesEndpointCreateBody struct {
	ProviderConfigId     string  `json:"provider_config_id"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
}

// List returns a paginated list of callback instances.
func (e *CallbacksInstancesEndpoint) List(instanceId string, callbackId string, params *CallbacksInstancesEndpointListParams) (*instances.CallbacksInstancesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "callbacks", callbackId, "instances"},
		Query: query,
	}
	var result instances.CallbacksInstancesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create attaches a callback to a config and optional auth config.
func (e *CallbacksInstancesEndpoint) Create(instanceId string, callbackId string, body *CallbacksInstancesEndpointCreateBody) (*instances.CallbacksInstancesCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId, "instances"},
		Body: body,
	}
	var result instances.CallbacksInstancesCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete detaches a callback instance.
func (e *CallbacksInstancesEndpoint) Delete(instanceId string, callbackId string, callbackInstanceId string) (*instances.CallbacksInstancesDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId, "instances", callbackInstanceId},
	}
	var result instances.CallbacksInstancesDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
