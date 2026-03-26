package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsListOutputItems represents the magic mcp groups list output items type.
type MagicMcpGroupsListOutputItems struct {
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

// MagicMcpGroupsListOutputPagination represents the magic mcp groups list output pagination type.
type MagicMcpGroupsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// MagicMcpGroupsListOutput represents the magic mcp groups list output type.
type MagicMcpGroupsListOutput struct {
	Items      []MagicMcpGroupsListOutputItems    `json:"items"`
	Pagination MagicMcpGroupsListOutputPagination `json:"pagination"`
}

// MapMagicMcpGroupsListOutputFromJSON deserializes JSON data into a MagicMcpGroupsListOutput.
func MapMagicMcpGroupsListOutputFromJSON(data []byte) (*MagicMcpGroupsListOutput, error) {
	var v MagicMcpGroupsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsListOutputToJSON serializes a MagicMcpGroupsListOutput to JSON.
func MapMagicMcpGroupsListOutputToJSON(v *MagicMcpGroupsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpGroupsListQuery represents the magic mcp groups list query type.
type MagicMcpGroupsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	Status *any     `json:"status,omitempty"`
	Search *string  `json:"search,omitempty"`
}

// MapMagicMcpGroupsListQueryFromJSON deserializes JSON data into a MagicMcpGroupsListQuery.
func MapMagicMcpGroupsListQueryFromJSON(data []byte) (*MagicMcpGroupsListQuery, error) {
	var v MagicMcpGroupsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsListQueryToJSON serializes a MagicMcpGroupsListQuery to JSON.
func MapMagicMcpGroupsListQueryToJSON(v *MagicMcpGroupsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
