package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsGetOutput represents the magic mcp groups get output type.
type MagicMcpGroupsGetOutput struct {
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

// MapMagicMcpGroupsGetOutputFromJSON deserializes JSON data into a MagicMcpGroupsGetOutput.
func MapMagicMcpGroupsGetOutputFromJSON(data []byte) (*MagicMcpGroupsGetOutput, error) {
	var v MagicMcpGroupsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsGetOutputToJSON serializes a MagicMcpGroupsGetOutput to JSON.
func MapMagicMcpGroupsGetOutputToJSON(v *MagicMcpGroupsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
