package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensAddGroupsOutputGroups represents the magic mcp tokens add groups output groups type.
type MagicMcpTokensAddGroupsOutputGroups struct {
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

// MagicMcpTokensAddGroupsOutput represents the magic mcp tokens add groups output type.
type MagicMcpTokensAddGroupsOutput struct {
	Object      string                                `json:"object"`
	Id          string                                `json:"id"`
	Status      string                                `json:"status"`
	Secret      string                                `json:"secret"`
	Name        *string                               `json:"name,omitempty"`
	Description *string                               `json:"description,omitempty"`
	Groups      []MagicMcpTokensAddGroupsOutputGroups `json:"groups"`
	Metadata    map[string]any                        `json:"metadata"`
	CreatedAt   time.Time                             `json:"created_at"`
	UpdatedAt   time.Time                             `json:"updated_at"`
}

// MapMagicMcpTokensAddGroupsOutputFromJSON deserializes JSON data into a MagicMcpTokensAddGroupsOutput.
func MapMagicMcpTokensAddGroupsOutputFromJSON(data []byte) (*MagicMcpTokensAddGroupsOutput, error) {
	var v MagicMcpTokensAddGroupsOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensAddGroupsOutputToJSON serializes a MagicMcpTokensAddGroupsOutput to JSON.
func MapMagicMcpTokensAddGroupsOutputToJSON(v *MagicMcpTokensAddGroupsOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpTokensAddGroupsBody represents the magic mcp tokens add groups body type.
type MagicMcpTokensAddGroupsBody struct {
	MagicMcpGroupIds []string `json:"magic_mcp_group_ids"`
}

// MapMagicMcpTokensAddGroupsBodyFromJSON deserializes JSON data into a MagicMcpTokensAddGroupsBody.
func MapMagicMcpTokensAddGroupsBodyFromJSON(data []byte) (*MagicMcpTokensAddGroupsBody, error) {
	var v MagicMcpTokensAddGroupsBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensAddGroupsBodyToJSON serializes a MagicMcpTokensAddGroupsBody to JSON.
func MapMagicMcpTokensAddGroupsBodyToJSON(v *MagicMcpTokensAddGroupsBody) ([]byte, error) {
	return json.Marshal(v)
}
