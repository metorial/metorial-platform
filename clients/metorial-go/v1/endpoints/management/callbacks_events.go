package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/callbacks/events"
)

// CallbacksEventsEndpoint provides access to read callback trigger events.
type CallbacksEventsEndpoint struct {
	client *endpoint.Client
}

// NewCallbacksEventsEndpoint creates a new CallbacksEventsEndpoint.
func NewCallbacksEventsEndpoint(client *endpoint.Client) *CallbacksEventsEndpoint {
	return &CallbacksEventsEndpoint{client: client}
}

// CallbacksEventsEndpointListParams contains optional query parameters for List.
type CallbacksEventsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by callback event ID(s)
	Id *any `json:"id,omitempty"`
	// Type - Filter by event type(s)
	Type *any `json:"type,omitempty"`
	// SourceId - Filter by provider source ID(s)
	SourceId *any `json:"source_id,omitempty"`
}

// List returns a paginated list of callback events.
func (e *CallbacksEventsEndpoint) List(instanceId string, callbackId string, params *CallbacksEventsEndpointListParams) (*events.CallbacksEventsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "callbacks", callbackId, "events"},
		Query: query,
	}
	var result events.CallbacksEventsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific callback event.
func (e *CallbacksEventsEndpoint) Get(instanceId string, callbackId string, callbackEventId string) (*events.CallbacksEventsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "callbacks", callbackId, "events", callbackEventId},
	}
	var result events.CallbacksEventsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
