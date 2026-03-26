package magicmcpsessions

import (
	"encoding/json"
	"time"
)

// MagicMcpSessionsListOutputItemsMagicMcpServerEndpoints represents the magic mcp sessions list output items magic mcp server endpoints type.
type MagicMcpSessionsListOutputItemsMagicMcpServerEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpSessionsListOutputItemsMagicMcpServer represents the magic mcp sessions list output items magic mcp server type.
type MagicMcpSessionsListOutputItemsMagicMcpServer struct {
	Object             string                                                   `json:"object"`
	Id                 string                                                   `json:"id"`
	Status             string                                                   `json:"status"`
	SessionTemplateId  string                                                   `json:"session_template_id"`
	ProviderTemplateId *string                                                  `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpSessionsListOutputItemsMagicMcpServerEndpoints `json:"endpoints"`
	Name               *string                                                  `json:"name,omitempty"`
	Description        *string                                                  `json:"description,omitempty"`
	Metadata           map[string]any                                           `json:"metadata"`
	CreatedAt          time.Time                                                `json:"created_at"`
	UpdatedAt          time.Time                                                `json:"updated_at"`
}

// MagicMcpSessionsListOutputItems represents the magic mcp sessions list output items type.
type MagicMcpSessionsListOutputItems struct {
	Object                    string                                        `json:"object"`
	Id                        string                                        `json:"id"`
	SubspaceSessionId         string                                        `json:"subspace_session_id"`
	SubspaceSessionTemplateId string                                        `json:"subspace_session_template_id"`
	MagicMcpServer            MagicMcpSessionsListOutputItemsMagicMcpServer `json:"magic_mcp_server"`
	CreatedAt                 time.Time                                     `json:"created_at"`
	UpdatedAt                 time.Time                                     `json:"updated_at"`
}

// MagicMcpSessionsListOutputPagination represents the magic mcp sessions list output pagination type.
type MagicMcpSessionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// MagicMcpSessionsListOutput represents the magic mcp sessions list output type.
type MagicMcpSessionsListOutput struct {
	Items      []MagicMcpSessionsListOutputItems    `json:"items"`
	Pagination MagicMcpSessionsListOutputPagination `json:"pagination"`
}

// MapMagicMcpSessionsListOutputFromJSON deserializes JSON data into a MagicMcpSessionsListOutput.
func MapMagicMcpSessionsListOutputFromJSON(data []byte) (*MagicMcpSessionsListOutput, error) {
	var v MagicMcpSessionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpSessionsListOutputToJSON serializes a MagicMcpSessionsListOutput to JSON.
func MapMagicMcpSessionsListOutputToJSON(v *MagicMcpSessionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpSessionsListQuery represents the magic mcp sessions list query type.
type MagicMcpSessionsListQuery struct {
	Limit            *float64 `json:"limit,omitempty"`
	After            *string  `json:"after,omitempty"`
	Before           *string  `json:"before,omitempty"`
	Cursor           *string  `json:"cursor,omitempty"`
	Order            *string  `json:"order,omitempty"`
	MagicMcpServerId *any     `json:"magic_mcp_server_id,omitempty"`
}

// MapMagicMcpSessionsListQueryFromJSON deserializes JSON data into a MagicMcpSessionsListQuery.
func MapMagicMcpSessionsListQueryFromJSON(data []byte) (*MagicMcpSessionsListQuery, error) {
	var v MagicMcpSessionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpSessionsListQueryToJSON serializes a MagicMcpSessionsListQuery to JSON.
func MapMagicMcpSessionsListQueryToJSON(v *MagicMcpSessionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
