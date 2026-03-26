package filelinks

import (
	"encoding/json"
	"time"
)

// FileLinksListOutputItems represents the file links list output items type.
type FileLinksListOutputItems struct {
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

// FileLinksListOutputPagination represents the file links list output pagination type.
type FileLinksListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// FileLinksListOutput represents the file links list output type.
type FileLinksListOutput struct {
	Items      []FileLinksListOutputItems    `json:"items"`
	Pagination FileLinksListOutputPagination `json:"pagination"`
}

// MapFileLinksListOutputFromJSON deserializes JSON data into a FileLinksListOutput.
func MapFileLinksListOutputFromJSON(data []byte) (*FileLinksListOutput, error) {
	var v FileLinksListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksListOutputToJSON serializes a FileLinksListOutput to JSON.
func MapFileLinksListOutputToJSON(v *FileLinksListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// FileLinksListQuery represents the file links list query type.
type FileLinksListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// FileId - Filter by file ID
	FileId *string `json:"file_id,omitempty"`
}

// MapFileLinksListQueryFromJSON deserializes JSON data into a FileLinksListQuery.
func MapFileLinksListQueryFromJSON(data []byte) (*FileLinksListQuery, error) {
	var v FileLinksListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFileLinksListQueryToJSON serializes a FileLinksListQuery to JSON.
func MapFileLinksListQueryToJSON(v *FileLinksListQuery) ([]byte, error) {
	return json.Marshal(v)
}
