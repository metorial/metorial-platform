package providerlistings

import (
	"encoding/json"
	"time"
)

// ProviderListingsGetOutputAttributes - Listing attribute flags
type ProviderListingsGetOutputAttributes struct {
	// IsPublic - Whether publicly visible
	IsPublic bool `json:"is_public"`
	// IsCustomized - Whether has custom config
	IsCustomized bool `json:"is_customized"`
	// IsMetorial - Whether Metorial-maintained
	IsMetorial bool `json:"is_metorial"`
	// IsVerified - Whether verified
	IsVerified bool `json:"is_verified"`
	// IsOfficial - Whether official integration
	IsOfficial bool `json:"is_official"`
}

// ProviderListingsGetOutputProviderPublisher represents the provider listings get output provider publisher type.
type ProviderListingsGetOutputProviderPublisher struct {
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

// ProviderListingsGetOutputProviderCurrentVersion represents the provider listings get output provider current version type.
type ProviderListingsGetOutputProviderCurrentVersion struct {
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

// ProviderListingsGetOutputProviderOauthAutoRegistration represents the provider listings get output provider oauth auto registration type.
type ProviderListingsGetOutputProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// ProviderListingsGetOutputProviderOauth represents the provider listings get output provider oauth type.
type ProviderListingsGetOutputProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                                `json:"callback_url,omitempty"`
	AutoRegistration ProviderListingsGetOutputProviderOauthAutoRegistration `json:"auto_registration"`
}

// ProviderListingsGetOutputProvider represents the provider listings get output provider type.
type ProviderListingsGetOutputProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                           `json:"status"`
	Publisher      ProviderListingsGetOutputProviderPublisher       `json:"publisher"`
	CurrentVersion *ProviderListingsGetOutputProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *ProviderListingsGetOutputProviderOauth          `json:"oauth,omitempty"`
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

// ProviderListingsGetOutputCategories represents the provider listings get output categories type.
type ProviderListingsGetOutputCategories struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique category identifier
	Id string `json:"id"`
	// Name - Display name of the category
	Name string `json:"name"`
	// Description - Description of providers in this category
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderListingsGetOutputCollections represents the provider listings get output collections type.
type ProviderListingsGetOutputCollections struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique collection identifier
	Id string `json:"id"`
	// Name - Display name of the collection
	Name string `json:"name"`
	// Description - Description of the collection
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderListingsGetOutputGroups represents the provider listings get output groups type.
type ProviderListingsGetOutputGroups struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique group identifier
	Id string `json:"id"`
	// Name - Display name of the group
	Name string `json:"name"`
	// Description - Description of the group
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderListingsGetOutput represents the provider listings get output type.
type ProviderListingsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique listing identifier
	Id string `json:"id"`
	// Attributes - Listing attribute flags
	Attributes ProviderListingsGetOutputAttributes `json:"attributes"`
	// Name - Display name
	Name string `json:"name"`
	// Description - Full description
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// ImageUrl - URL of the listing logo/icon
	ImageUrl string `json:"image_url"`
	// Readme - README content in markdown
	Readme *string `json:"readme,omitempty"`
	// Skills - Capability tags
	Skills   []string                          `json:"skills"`
	Provider ProviderListingsGetOutputProvider `json:"provider"`
	// Categories - Provider categories for organization and filtering
	Categories []ProviderListingsGetOutputCategories `json:"categories"`
	// Collections - Provider collections this provider belongs to
	Collections []ProviderListingsGetOutputCollections `json:"collections"`
	// Groups - User groups with access to this provider
	Groups []ProviderListingsGetOutputGroups `json:"groups"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderListingsGetOutputFromJSON deserializes JSON data into a ProviderListingsGetOutput.
func MapProviderListingsGetOutputFromJSON(data []byte) (*ProviderListingsGetOutput, error) {
	var v ProviderListingsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderListingsGetOutputToJSON serializes a ProviderListingsGetOutput to JSON.
func MapProviderListingsGetOutputToJSON(v *ProviderListingsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
