package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensRemoveGroupsOutputGroups represents the magic mcp tokens remove groups output groups type.
type MagicMcpTokensRemoveGroupsOutputGroups struct {
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

// MagicMcpTokensRemoveGroupsOutput represents the magic mcp tokens remove groups output type.
type MagicMcpTokensRemoveGroupsOutput struct {
	Object      string                                   `json:"object"`
	Id          string                                   `json:"id"`
	Status      string                                   `json:"status"`
	Secret      string                                   `json:"secret"`
	Name        *string                                  `json:"name,omitempty"`
	Description *string                                  `json:"description,omitempty"`
	Groups      []MagicMcpTokensRemoveGroupsOutputGroups `json:"groups"`
	Metadata    map[string]any                           `json:"metadata"`
	CreatedAt   time.Time                                `json:"created_at"`
	UpdatedAt   time.Time                                `json:"updated_at"`
}

// MapMagicMcpTokensRemoveGroupsOutputFromJSON deserializes JSON data into a MagicMcpTokensRemoveGroupsOutput.
func MapMagicMcpTokensRemoveGroupsOutputFromJSON(data []byte) (*MagicMcpTokensRemoveGroupsOutput, error) {
	var v MagicMcpTokensRemoveGroupsOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensRemoveGroupsOutputToJSON serializes a MagicMcpTokensRemoveGroupsOutput to JSON.
func MapMagicMcpTokensRemoveGroupsOutputToJSON(v *MagicMcpTokensRemoveGroupsOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpTokensRemoveGroupsBody represents the magic mcp tokens remove groups body type.
type MagicMcpTokensRemoveGroupsBody struct {
	MagicMcpGroupIds []string `json:"magic_mcp_group_ids"`
}

// MapMagicMcpTokensRemoveGroupsBodyFromJSON deserializes JSON data into a MagicMcpTokensRemoveGroupsBody.
func MapMagicMcpTokensRemoveGroupsBodyFromJSON(data []byte) (*MagicMcpTokensRemoveGroupsBody, error) {
	var v MagicMcpTokensRemoveGroupsBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensRemoveGroupsBodyToJSON serializes a MagicMcpTokensRemoveGroupsBody to JSON.
func MapMagicMcpTokensRemoveGroupsBodyToJSON(v *MagicMcpTokensRemoveGroupsBody) ([]byte, error) {
	return json.Marshal(v)
}
