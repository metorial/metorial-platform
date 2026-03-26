package files

import (
	"encoding/json"
	"time"
)

// FilesListOutputItemsPurpose represents the files list output items purpose type.
type FilesListOutputItemsPurpose struct {
	// Name - The file's purpose name
	Name string `json:"name"`
	// Identifier - The file's purpose identifier
	Identifier string `json:"identifier"`
}

// FilesListOutputItems represents the files list output items type.
type FilesListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - The files's unique identifier
	Id string `json:"id"`
	// Status - The files's status
	Status string `json:"status"`
	// FileName - The file's name
	FileName string `json:"file_name"`
	// FileSize - The file's size in bytes
	FileSize float64 `json:"file_size"`
	// FileType - The file's MIME type
	FileType string `json:"file_type"`
	// Title - The file's title
	Title   *string                     `json:"title,omitempty"`
	Purpose FilesListOutputItemsPurpose `json:"purpose"`
	// CreatedAt - The files's creation date
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - The files's last update date
	UpdatedAt time.Time `json:"updated_at"`
}

// FilesListOutputPagination represents the files list output pagination type.
type FilesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// FilesListOutput represents the files list output type.
type FilesListOutput struct {
	Items      []FilesListOutputItems    `json:"items"`
	Pagination FilesListOutputPagination `json:"pagination"`
}

// MapFilesListOutputFromJSON deserializes JSON data into a FilesListOutput.
func MapFilesListOutputFromJSON(data []byte) (*FilesListOutput, error) {
	var v FilesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFilesListOutputToJSON serializes a FilesListOutput to JSON.
func MapFilesListOutputToJSON(v *FilesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// FilesListQuery represents the files list query type.
type FilesListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Purpose - Filter by file purpose
	Purpose *string `json:"purpose,omitempty"`
}

// MapFilesListQueryFromJSON deserializes JSON data into a FilesListQuery.
func MapFilesListQueryFromJSON(data []byte) (*FilesListQuery, error) {
	var v FilesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFilesListQueryToJSON serializes a FilesListQuery to JSON.
func MapFilesListQueryToJSON(v *FilesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
