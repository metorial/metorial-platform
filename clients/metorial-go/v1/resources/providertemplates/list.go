package providertemplates

import (
	"encoding/json"
	"time"
)

// ProviderTemplatesListOutputItems represents the provider templates list output items type.
type ProviderTemplatesListOutputItems struct {
	Object               string         `json:"object"`
	Id                   string         `json:"id"`
	Status               string         `json:"status"`
	Name                 string         `json:"name"`
	Description          *string        `json:"description,omitempty"`
	Metadata             map[string]any `json:"metadata"`
	ProviderDeploymentId string         `json:"provider_deployment_id"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
}

// ProviderTemplatesListOutputPagination represents the provider templates list output pagination type.
type ProviderTemplatesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderTemplatesListOutput represents the provider templates list output type.
type ProviderTemplatesListOutput struct {
	Items      []ProviderTemplatesListOutputItems    `json:"items"`
	Pagination ProviderTemplatesListOutputPagination `json:"pagination"`
}

// MapProviderTemplatesListOutputFromJSON deserializes JSON data into a ProviderTemplatesListOutput.
func MapProviderTemplatesListOutputFromJSON(data []byte) (*ProviderTemplatesListOutput, error) {
	var v ProviderTemplatesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesListOutputToJSON serializes a ProviderTemplatesListOutput to JSON.
func MapProviderTemplatesListOutputToJSON(v *ProviderTemplatesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderTemplatesListQuery represents the provider templates list query type.
type ProviderTemplatesListQuery struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Id                   *any     `json:"id,omitempty"`
	ProviderDeploymentId *any     `json:"provider_deployment_id,omitempty"`
	Status               *any     `json:"status,omitempty"`
}

// MapProviderTemplatesListQueryFromJSON deserializes JSON data into a ProviderTemplatesListQuery.
func MapProviderTemplatesListQueryFromJSON(data []byte) (*ProviderTemplatesListQuery, error) {
	var v ProviderTemplatesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesListQueryToJSON serializes a ProviderTemplatesListQuery to JSON.
func MapProviderTemplatesListQueryToJSON(v *ProviderTemplatesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
