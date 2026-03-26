package providerdeployments

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsListOutputItemsLockedVersion represents the provider deployments list output items locked version type.
type ProviderDeploymentsListOutputItemsLockedVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique version identifier
	Id string `json:"id"`
	// Version - Version identifier string
	Version string `json:"version"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// IsCurrent - Whether this is the current version
	IsCurrent bool `json:"is_current"`
	// Name - Version name
	Name string `json:"name"`
	// Description - Version description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId *string `json:"specification_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsListOutputItemsDefaultConfig represents the provider deployments list output items default config type.
type ProviderDeploymentsListOutputItemsDefaultConfig struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Config ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default config
	IsDefault bool `json:"is_default"`
	// Name - Config name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsListOutputItems represents the provider deployments list output items type.
type ProviderDeploymentsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique deployment identifier
	Id string `json:"id"`
	// IsDefault - Whether this is the default deployment
	IsDefault bool `json:"is_default"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId    string                                           `json:"provider_id"`
	LockedVersion *ProviderDeploymentsListOutputItemsLockedVersion `json:"locked_version,omitempty"`
	DefaultConfig *ProviderDeploymentsListOutputItemsDefaultConfig `json:"default_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsListOutputPagination represents the provider deployments list output pagination type.
type ProviderDeploymentsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsListOutput represents the provider deployments list output type.
type ProviderDeploymentsListOutput struct {
	Items      []ProviderDeploymentsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsListOutput.
func MapProviderDeploymentsListOutputFromJSON(data []byte) (*ProviderDeploymentsListOutput, error) {
	var v ProviderDeploymentsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsListOutputToJSON serializes a ProviderDeploymentsListOutput to JSON.
func MapProviderDeploymentsListOutputToJSON(v *ProviderDeploymentsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsListQuery represents the provider deployments list query type.
type ProviderDeploymentsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by deployment ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapProviderDeploymentsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsListQuery.
func MapProviderDeploymentsListQueryFromJSON(data []byte) (*ProviderDeploymentsListQuery, error) {
	var v ProviderDeploymentsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsListQueryToJSON serializes a ProviderDeploymentsListQuery to JSON.
func MapProviderDeploymentsListQueryToJSON(v *ProviderDeploymentsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
