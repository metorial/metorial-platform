package providerlistings

import (
	"encoding/json"
	"time"
)

// ProviderListingsListOutputItemsAttributes - Listing attribute flags
type ProviderListingsListOutputItemsAttributes struct {
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

// ProviderListingsListOutputItemsProviderPublisher represents the provider listings list output items provider publisher type.
type ProviderListingsListOutputItemsProviderPublisher struct {
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

// ProviderListingsListOutputItemsProviderCurrentVersion represents the provider listings list output items provider current version type.
type ProviderListingsListOutputItemsProviderCurrentVersion struct {
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

// ProviderListingsListOutputItemsProviderOauthAutoRegistration represents the provider listings list output items provider oauth auto registration type.
type ProviderListingsListOutputItemsProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// ProviderListingsListOutputItemsProviderOauth represents the provider listings list output items provider oauth type.
type ProviderListingsListOutputItemsProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                                      `json:"callback_url,omitempty"`
	AutoRegistration ProviderListingsListOutputItemsProviderOauthAutoRegistration `json:"auto_registration"`
}

// ProviderListingsListOutputItemsProvider represents the provider listings list output items provider type.
type ProviderListingsListOutputItemsProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                                 `json:"status"`
	Publisher      ProviderListingsListOutputItemsProviderPublisher       `json:"publisher"`
	CurrentVersion *ProviderListingsListOutputItemsProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *ProviderListingsListOutputItemsProviderOauth          `json:"oauth,omitempty"`
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

// ProviderListingsListOutputItemsCategories represents the provider listings list output items categories type.
type ProviderListingsListOutputItemsCategories struct {
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

// ProviderListingsListOutputItemsCollections represents the provider listings list output items collections type.
type ProviderListingsListOutputItemsCollections struct {
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

// ProviderListingsListOutputItemsGroups represents the provider listings list output items groups type.
type ProviderListingsListOutputItemsGroups struct {
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

// ProviderListingsListOutputItems represents the provider listings list output items type.
type ProviderListingsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique listing identifier
	Id string `json:"id"`
	// Attributes - Listing attribute flags
	Attributes ProviderListingsListOutputItemsAttributes `json:"attributes"`
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
	Skills   []string                                `json:"skills"`
	Provider ProviderListingsListOutputItemsProvider `json:"provider"`
	// Categories - Provider categories for organization and filtering
	Categories []ProviderListingsListOutputItemsCategories `json:"categories"`
	// Collections - Provider collections this provider belongs to
	Collections []ProviderListingsListOutputItemsCollections `json:"collections"`
	// Groups - User groups with access to this provider
	Groups []ProviderListingsListOutputItemsGroups `json:"groups"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderListingsListOutputPagination represents the provider listings list output pagination type.
type ProviderListingsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderListingsListOutput represents the provider listings list output type.
type ProviderListingsListOutput struct {
	Items      []ProviderListingsListOutputItems    `json:"items"`
	Pagination ProviderListingsListOutputPagination `json:"pagination"`
}

// MapProviderListingsListOutputFromJSON deserializes JSON data into a ProviderListingsListOutput.
func MapProviderListingsListOutputFromJSON(data []byte) (*ProviderListingsListOutput, error) {
	var v ProviderListingsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderListingsListOutputToJSON serializes a ProviderListingsListOutput to JSON.
func MapProviderListingsListOutputToJSON(v *ProviderListingsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderListingsListQuery represents the provider listings list query type.
type ProviderListingsListQuery struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Search               *string  `json:"search,omitempty"`
	ProviderCategoryId   *any     `json:"provider_category_id,omitempty"`
	ProviderCollectionId *any     `json:"provider_collection_id,omitempty"`
	ProviderGroupId      *any     `json:"provider_group_id,omitempty"`
	PublisherId          *any     `json:"publisher_id,omitempty"`
	IsOwner              *bool    `json:"is_owner,omitempty"`
	IsPublic             *bool    `json:"is_public,omitempty"`
	IsVerified           *bool    `json:"is_verified,omitempty"`
	IsOfficial           *bool    `json:"is_official,omitempty"`
	IsMetorial           *bool    `json:"is_metorial,omitempty"`
}

// MapProviderListingsListQueryFromJSON deserializes JSON data into a ProviderListingsListQuery.
func MapProviderListingsListQueryFromJSON(data []byte) (*ProviderListingsListQuery, error) {
	var v ProviderListingsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderListingsListQueryToJSON serializes a ProviderListingsListQuery to JSON.
func MapProviderListingsListQueryToJSON(v *ProviderListingsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
