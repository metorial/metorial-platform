package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsAddServersOutput represents the magic mcp groups add servers output type.
type MagicMcpGroupsAddServersOutput struct {
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

// MapMagicMcpGroupsAddServersOutputFromJSON deserializes JSON data into a MagicMcpGroupsAddServersOutput.
func MapMagicMcpGroupsAddServersOutputFromJSON(data []byte) (*MagicMcpGroupsAddServersOutput, error) {
	var v MagicMcpGroupsAddServersOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsAddServersOutputToJSON serializes a MagicMcpGroupsAddServersOutput to JSON.
func MapMagicMcpGroupsAddServersOutputToJSON(v *MagicMcpGroupsAddServersOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpGroupsAddServersBody represents the magic mcp groups add servers body type.
type MagicMcpGroupsAddServersBody struct {
	MagicMcpServerIds []string `json:"magic_mcp_server_ids"`
}

// MapMagicMcpGroupsAddServersBodyFromJSON deserializes JSON data into a MagicMcpGroupsAddServersBody.
func MapMagicMcpGroupsAddServersBodyFromJSON(data []byte) (*MagicMcpGroupsAddServersBody, error) {
	var v MagicMcpGroupsAddServersBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsAddServersBodyToJSON serializes a MagicMcpGroupsAddServersBody to JSON.
func MapMagicMcpGroupsAddServersBodyToJSON(v *MagicMcpGroupsAddServersBody) ([]byte, error) {
	return json.Marshal(v)
}
