package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsRemoveServersOutput represents the magic mcp groups remove servers output type.
type MagicMcpGroupsRemoveServersOutput struct {
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

// MapMagicMcpGroupsRemoveServersOutputFromJSON deserializes JSON data into a MagicMcpGroupsRemoveServersOutput.
func MapMagicMcpGroupsRemoveServersOutputFromJSON(data []byte) (*MagicMcpGroupsRemoveServersOutput, error) {
	var v MagicMcpGroupsRemoveServersOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsRemoveServersOutputToJSON serializes a MagicMcpGroupsRemoveServersOutput to JSON.
func MapMagicMcpGroupsRemoveServersOutputToJSON(v *MagicMcpGroupsRemoveServersOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpGroupsRemoveServersBody represents the magic mcp groups remove servers body type.
type MagicMcpGroupsRemoveServersBody struct {
	MagicMcpServerIds []string `json:"magic_mcp_server_ids"`
}

// MapMagicMcpGroupsRemoveServersBodyFromJSON deserializes JSON data into a MagicMcpGroupsRemoveServersBody.
func MapMagicMcpGroupsRemoveServersBodyFromJSON(data []byte) (*MagicMcpGroupsRemoveServersBody, error) {
	var v MagicMcpGroupsRemoveServersBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsRemoveServersBodyToJSON serializes a MagicMcpGroupsRemoveServersBody to JSON.
func MapMagicMcpGroupsRemoveServersBodyToJSON(v *MagicMcpGroupsRemoveServersBody) ([]byte, error) {
	return json.Marshal(v)
}
