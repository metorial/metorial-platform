package providers

import (
	"encoding/json"
	"time"
)

// ProvidersListOutputItemsPublisher represents the providers list output items publisher type.
type ProvidersListOutputItemsPublisher struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique publisher identifier
	Id string `json:"id"`
	// Name - Display name of the publisher
	Name string `json:"name"`
	// Description - Brief description of the publisher
	Description *string `json:"description,omitempty"`
	// ImageUrl - URL of the publisher logo
	ImageUrl string `json:"image_url"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersListOutputItemsCurrentVersion represents the providers list output items current version type.
type ProvidersListOutputItemsCurrentVersion struct {
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

// ProvidersListOutputItemsOauthAutoRegistration represents the providers list output items oauth auto registration type.
type ProvidersListOutputItemsOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// ProvidersListOutputItemsOauth represents the providers list output items oauth type.
type ProvidersListOutputItemsOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                       `json:"callback_url,omitempty"`
	AutoRegistration ProvidersListOutputItemsOauthAutoRegistration `json:"auto_registration"`
}

// ProvidersListOutputItems represents the providers list output items type.
type ProvidersListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                  `json:"status"`
	Publisher      ProvidersListOutputItemsPublisher       `json:"publisher"`
	CurrentVersion *ProvidersListOutputItemsCurrentVersion `json:"current_version,omitempty"`
	Oauth          *ProvidersListOutputItemsOauth          `json:"oauth,omitempty"`
	// Identifier - Provider identifier
	Identifier string `json:"identifier"`
	// Name - Display name of the provider
	Name string `json:"name"`
	// Description - Brief description of the provider
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersListOutputPagination represents the providers list output pagination type.
type ProvidersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersListOutput represents the providers list output type.
type ProvidersListOutput struct {
	Items      []ProvidersListOutputItems    `json:"items"`
	Pagination ProvidersListOutputPagination `json:"pagination"`
}

// MapProvidersListOutputFromJSON deserializes JSON data into a ProvidersListOutput.
func MapProvidersListOutputFromJSON(data []byte) (*ProvidersListOutput, error) {
	var v ProvidersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersListOutputToJSON serializes a ProvidersListOutput to JSON.
func MapProvidersListOutputToJSON(v *ProvidersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersListQuery represents the providers list query type.
type ProvidersListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by provider ID(s)
	Id *any `json:"id,omitempty"`
}

// MapProvidersListQueryFromJSON deserializes JSON data into a ProvidersListQuery.
func MapProvidersListQueryFromJSON(data []byte) (*ProvidersListQuery, error) {
	var v ProvidersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersListQueryToJSON serializes a ProvidersListQuery to JSON.
func MapProvidersListQueryToJSON(v *ProvidersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
