package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/publishers"
)

// PublishersEndpoint provides access to a publisher is the organization or individual who created and maintains a provider.
type PublishersEndpoint struct {
	client *endpoint.Client
}

// NewPublishersEndpoint creates a new PublishersEndpoint.
func NewPublishersEndpoint(client *endpoint.Client) *PublishersEndpoint {
	return &PublishersEndpoint{client: client}
}

// PublishersEndpointListParams contains optional query parameters for List.
type PublishersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// List returns a paginated list of publishers.
func (e *PublishersEndpoint) List(instanceId string, params *PublishersEndpointListParams) (*publishers.PublishersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "publishers"},
		Query: query,
	}
	var result publishers.PublishersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific publisher by ID.
func (e *PublishersEndpoint) Get(instanceId string, publisherId string) (*publishers.PublishersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "publishers", publisherId},
	}
	var result publishers.PublishersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
