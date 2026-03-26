package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensGetOutputGroups represents the magic mcp tokens get output groups type.
type MagicMcpTokensGetOutputGroups struct {
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

// MagicMcpTokensGetOutput represents the magic mcp tokens get output type.
type MagicMcpTokensGetOutput struct {
	Object      string                          `json:"object"`
	Id          string                          `json:"id"`
	Status      string                          `json:"status"`
	Secret      string                          `json:"secret"`
	Name        *string                         `json:"name,omitempty"`
	Description *string                         `json:"description,omitempty"`
	Groups      []MagicMcpTokensGetOutputGroups `json:"groups"`
	Metadata    map[string]any                  `json:"metadata"`
	CreatedAt   time.Time                       `json:"created_at"`
	UpdatedAt   time.Time                       `json:"updated_at"`
}

// MapMagicMcpTokensGetOutputFromJSON deserializes JSON data into a MagicMcpTokensGetOutput.
func MapMagicMcpTokensGetOutputFromJSON(data []byte) (*MagicMcpTokensGetOutput, error) {
	var v MagicMcpTokensGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensGetOutputToJSON serializes a MagicMcpTokensGetOutput to JSON.
func MapMagicMcpTokensGetOutputToJSON(v *MagicMcpTokensGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
