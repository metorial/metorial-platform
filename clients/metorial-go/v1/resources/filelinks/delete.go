package filelinks

import (
	"encoding/json"
	"time"
)

// FileLinksDeleteOutput represents the file links delete output type.
type FileLinksDeleteOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - The links's unique identifier
	Id string `json:"id"`
	// FileId - The file's unique identifier
	FileId string `json:"file_id"`
	// Url - The file's public URL
	Url string `json:"url"`
	// CreatedAt - The links's creation date
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - The file's expiration date
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// MapFileLinksDeleteOutputFromJSON deserializes JSON data into a FileLinksDeleteOutput.
func MapFileLinksDeleteOutputFromJSON(data []byte) (*FileLinksDeleteOutput, error) {
	var v FileLinksDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksDeleteOutputToJSON serializes a FileLinksDeleteOutput to JSON.
func MapFileLinksDeleteOutputToJSON(v *FileLinksDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
