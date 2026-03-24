package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/instance"
)

// InstanceEndpoint provides access to an instance is an isolated environment within a Metorial project. Instances are created via the dashboard (since API keys are scoped to instances). Common setups include production, staging, and development instances.
type InstanceEndpoint struct {
	client *endpoint.Client
}

// NewInstanceEndpoint creates a new InstanceEndpoint.
func NewInstanceEndpoint(client *endpoint.Client) *InstanceEndpoint {
	return &InstanceEndpoint{client: client}
}

// Get retrieves metadata and configuration details for a specific instance.
func (e *InstanceEndpoint) Get(instanceId string) (*instance.InstanceGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "instance"},
	}
	var result instance.InstanceGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
