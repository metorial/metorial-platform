package magicmcpservers

import (
	"encoding/json"
	"time"
)

// MagicMcpServersListOutputItemsEndpoints represents the magic mcp servers list output items endpoints type.
type MagicMcpServersListOutputItemsEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpServersListOutputItems represents the magic mcp servers list output items type.
type MagicMcpServersListOutputItems struct {
	Object             string                                    `json:"object"`
	Id                 string                                    `json:"id"`
	Status             string                                    `json:"status"`
	SessionTemplateId  string                                    `json:"session_template_id"`
	ProviderTemplateId *string                                   `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpServersListOutputItemsEndpoints `json:"endpoints"`
	Name               *string                                   `json:"name,omitempty"`
	Description        *string                                   `json:"description,omitempty"`
	Metadata           map[string]any                            `json:"metadata"`
	CreatedAt          time.Time                                 `json:"created_at"`
	UpdatedAt          time.Time                                 `json:"updated_at"`
}

// MagicMcpServersListOutputPagination represents the magic mcp servers list output pagination type.
type MagicMcpServersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// MagicMcpServersListOutput represents the magic mcp servers list output type.
type MagicMcpServersListOutput struct {
	Items      []MagicMcpServersListOutputItems    `json:"items"`
	Pagination MagicMcpServersListOutputPagination `json:"pagination"`
}

// MapMagicMcpServersListOutputFromJSON deserializes JSON data into a MagicMcpServersListOutput.
func MapMagicMcpServersListOutputFromJSON(data []byte) (*MagicMcpServersListOutput, error) {
	var v MagicMcpServersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersListOutputToJSON serializes a MagicMcpServersListOutput to JSON.
func MapMagicMcpServersListOutputToJSON(v *MagicMcpServersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpServersListQuery represents the magic mcp servers list query type.
type MagicMcpServersListQuery struct {
	Limit           *float64 `json:"limit,omitempty"`
	After           *string  `json:"after,omitempty"`
	Before          *string  `json:"before,omitempty"`
	Cursor          *string  `json:"cursor,omitempty"`
	Order           *string  `json:"order,omitempty"`
	Status          *any     `json:"status,omitempty"`
	MagicMcpGroupId *any     `json:"magic_mcp_group_id,omitempty"`
	Search          *string  `json:"search,omitempty"`
}

// MapMagicMcpServersListQueryFromJSON deserializes JSON data into a MagicMcpServersListQuery.
func MapMagicMcpServersListQueryFromJSON(data []byte) (*MagicMcpServersListQuery, error) {
	var v MagicMcpServersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersListQueryToJSON serializes a MagicMcpServersListQuery to JSON.
func MapMagicMcpServersListQueryToJSON(v *MagicMcpServersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
