package providers

import (
	"encoding/json"
	"time"
)

// ProvidersGetOutputPublisher represents the providers get output publisher type.
type ProvidersGetOutputPublisher struct {
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

// ProvidersGetOutputCurrentVersion represents the providers get output current version type.
type ProvidersGetOutputCurrentVersion struct {
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

// ProvidersGetOutputOauthAutoRegistration represents the providers get output oauth auto registration type.
type ProvidersGetOutputOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// ProvidersGetOutputOauth represents the providers get output oauth type.
type ProvidersGetOutputOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                 `json:"callback_url,omitempty"`
	AutoRegistration ProvidersGetOutputOauthAutoRegistration `json:"auto_registration"`
}

// ProvidersGetOutput represents the providers get output type.
type ProvidersGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                            `json:"status"`
	Publisher      ProvidersGetOutputPublisher       `json:"publisher"`
	CurrentVersion *ProvidersGetOutputCurrentVersion `json:"current_version,omitempty"`
	Oauth          *ProvidersGetOutputOauth          `json:"oauth,omitempty"`
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

// MapProvidersGetOutputFromJSON deserializes JSON data into a ProvidersGetOutput.
func MapProvidersGetOutputFromJSON(data []byte) (*ProvidersGetOutput, error) {
	var v ProvidersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersGetOutputToJSON serializes a ProvidersGetOutput to JSON.
func MapProvidersGetOutputToJSON(v *ProvidersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
