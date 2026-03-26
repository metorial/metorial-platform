package authcredentials

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthCredentialsListOutputItems represents the provider deployments auth credentials list output items type.
type ProviderDeploymentsAuthCredentialsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique credentials identifier
	Id   string `json:"id"`
	Type string `json:"type"`
	// IsDefault - Whether this is the default credentials for the provider
	IsDefault bool `json:"is_default"`
	// IsManaged - Whether these credentials are managed by Metorial
	IsManaged bool `json:"is_managed"`
	// Name - Display name
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

// ProviderDeploymentsAuthCredentialsListOutputPagination represents the provider deployments auth credentials list output pagination type.
type ProviderDeploymentsAuthCredentialsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsAuthCredentialsListOutput represents the provider deployments auth credentials list output type.
type ProviderDeploymentsAuthCredentialsListOutput struct {
	Items      []ProviderDeploymentsAuthCredentialsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsAuthCredentialsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsAuthCredentialsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsListOutput.
func MapProviderDeploymentsAuthCredentialsListOutputFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsListOutput, error) {
	var v ProviderDeploymentsAuthCredentialsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsListOutputToJSON serializes a ProviderDeploymentsAuthCredentialsListOutput to JSON.
func MapProviderDeploymentsAuthCredentialsListOutputToJSON(v *ProviderDeploymentsAuthCredentialsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthCredentialsListQuery represents the provider deployments auth credentials list query type.
type ProviderDeploymentsAuthCredentialsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by credential ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderAuthMethodId - Filter by provider auth method ID(s)
	ProviderAuthMethodId *any `json:"provider_auth_method_id,omitempty"`
	// Origin - Filter by credential origin (custom, managed)
	Origin *any `json:"origin,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapProviderDeploymentsAuthCredentialsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsListQuery.
func MapProviderDeploymentsAuthCredentialsListQueryFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsListQuery, error) {
	var v ProviderDeploymentsAuthCredentialsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsListQueryToJSON serializes a ProviderDeploymentsAuthCredentialsListQuery to JSON.
func MapProviderDeploymentsAuthCredentialsListQueryToJSON(v *ProviderDeploymentsAuthCredentialsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
