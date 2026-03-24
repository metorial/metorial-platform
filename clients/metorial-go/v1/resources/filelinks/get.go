package filelinks

import (
	"encoding/json"
	"time"
)

// FileLinksGetOutput represents the file links get output type.
type FileLinksGetOutput struct {
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

// MapFileLinksGetOutputFromJSON deserializes JSON data into a FileLinksGetOutput.
func MapFileLinksGetOutputFromJSON(data []byte) (*FileLinksGetOutput, error) {
	var v FileLinksGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksGetOutputToJSON serializes a FileLinksGetOutput to JSON.
func MapFileLinksGetOutputToJSON(v *FileLinksGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
