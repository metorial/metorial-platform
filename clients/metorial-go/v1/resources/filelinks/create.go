package filelinks

import (
	"encoding/json"
	"time"
)

// FileLinksCreateOutput represents the file links create output type.
type FileLinksCreateOutput struct {
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

// MapFileLinksCreateOutputFromJSON deserializes JSON data into a FileLinksCreateOutput.
func MapFileLinksCreateOutputFromJSON(data []byte) (*FileLinksCreateOutput, error) {
	var v FileLinksCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksCreateOutputToJSON serializes a FileLinksCreateOutput to JSON.
func MapFileLinksCreateOutputToJSON(v *FileLinksCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// FileLinksCreateBody represents the file links create body type.
type FileLinksCreateBody struct {
	FileId    string     `json:"file_id"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// MapFileLinksCreateBodyFromJSON deserializes JSON data into a FileLinksCreateBody.
func MapFileLinksCreateBodyFromJSON(data []byte) (*FileLinksCreateBody, error) {
	var v FileLinksCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksCreateBodyToJSON serializes a FileLinksCreateBody to JSON.
func MapFileLinksCreateBodyToJSON(v *FileLinksCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
