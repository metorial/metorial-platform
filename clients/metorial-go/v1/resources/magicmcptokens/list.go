package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensListOutputItemsGroups represents the magic mcp tokens list output items groups type.
type MagicMcpTokensListOutputItemsGroups struct {
	Object      string         `json:"object"`
	Id          string         `json:"id"`
	Status      string         `json:"status"`
	Slug        string         `json:"slug"`
	Name        *string        `json:"name,omitempty"`
	Description *string        `json:"description,omitempty"`
	Metadata    map[string]any `json:"metadata"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// MagicMcpTokensListOutputItems represents the magic mcp tokens list output items type.
type MagicMcpTokensListOutputItems struct {
	Object      string                                `json:"object"`
	Id          string                                `json:"id"`
	Status      string                                `json:"status"`
	Secret      string                                `json:"secret"`
	Name        *string                               `json:"name,omitempty"`
	Description *string                               `json:"description,omitempty"`
	Groups      []MagicMcpTokensListOutputItemsGroups `json:"groups"`
	Metadata    map[string]any                        `json:"metadata"`
	CreatedAt   time.Time                             `json:"created_at"`
	UpdatedAt   time.Time                             `json:"updated_at"`
}

// MagicMcpTokensListOutputPagination represents the magic mcp tokens list output pagination type.
type MagicMcpTokensListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// MagicMcpTokensListOutput represents the magic mcp tokens list output type.
type MagicMcpTokensListOutput struct {
	Items      []MagicMcpTokensListOutputItems    `json:"items"`
	Pagination MagicMcpTokensListOutputPagination `json:"pagination"`
}

// MapMagicMcpTokensListOutputFromJSON deserializes JSON data into a MagicMcpTokensListOutput.
func MapMagicMcpTokensListOutputFromJSON(data []byte) (*MagicMcpTokensListOutput, error) {
	var v MagicMcpTokensListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensListOutputToJSON serializes a MagicMcpTokensListOutput to JSON.
func MapMagicMcpTokensListOutputToJSON(v *MagicMcpTokensListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpTokensListQuery represents the magic mcp tokens list query type.
type MagicMcpTokensListQuery struct {
	Limit           *float64 `json:"limit,omitempty"`
	After           *string  `json:"after,omitempty"`
	Before          *string  `json:"before,omitempty"`
	Cursor          *string  `json:"cursor,omitempty"`
	Order           *string  `json:"order,omitempty"`
	Status          *any     `json:"status,omitempty"`
	MagicMcpGroupId *any     `json:"magic_mcp_group_id,omitempty"`
}

// MapMagicMcpTokensListQueryFromJSON deserializes JSON data into a MagicMcpTokensListQuery.
func MapMagicMcpTokensListQueryFromJSON(data []byte) (*MagicMcpTokensListQuery, error) {
	var v MagicMcpTokensListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensListQueryToJSON serializes a MagicMcpTokensListQuery to JSON.
func MapMagicMcpTokensListQueryToJSON(v *MagicMcpTokensListQuery) ([]byte, error) {
	return json.Marshal(v)
}
