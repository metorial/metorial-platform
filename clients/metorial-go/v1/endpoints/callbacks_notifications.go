package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/callbacks/notifications"
)

// CallbacksNotificationsEndpoint provides access to read callback notification deliveries.
type CallbacksNotificationsEndpoint struct {
	client *endpoint.Client
}

// NewCallbacksNotificationsEndpoint creates a new CallbacksNotificationsEndpoint.
func NewCallbacksNotificationsEndpoint(client *endpoint.Client) *CallbacksNotificationsEndpoint {
	return &CallbacksNotificationsEndpoint{client: client}
}

// CallbacksNotificationsEndpointListParams contains optional query parameters for List.
type CallbacksNotificationsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// DestinationId - Filter by callback destination ID(s)
	DestinationId *any `json:"destination_id,omitempty"`
	// Status - Filter by callback notification delivery status
	Status *any `json:"status,omitempty"`
}

// List returns a paginated list of callback notifications.
func (e *CallbacksNotificationsEndpoint) List(callbackId string, params *CallbacksNotificationsEndpointListParams) (*notifications.CallbacksNotificationsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"callbacks", callbackId, "notifications"},
		Query: query,
	}
	var result notifications.CallbacksNotificationsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific callback notification.
func (e *CallbacksNotificationsEndpoint) Get(callbackId string, callbackNotificationId string) (*notifications.CallbacksNotificationsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"callbacks", callbackId, "notifications", callbackNotificationId},
	}
	var result notifications.CallbacksNotificationsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
