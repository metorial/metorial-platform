package files

import (
	"encoding/json"
	"time"
)

// FilesGetOutputPurpose represents the files get output purpose type.
type FilesGetOutputPurpose struct {
	// Name - The file's purpose name
	Name string `json:"name"`
	// Identifier - The file's purpose identifier
	Identifier string `json:"identifier"`
}

// FilesGetOutput represents the files get output type.
type FilesGetOutput struct {
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
	Title   *string               `json:"title,omitempty"`
	Purpose FilesGetOutputPurpose `json:"purpose"`
	// CreatedAt - The files's creation date
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - The files's last update date
	UpdatedAt time.Time `json:"updated_at"`
}

// MapFilesGetOutputFromJSON deserializes JSON data into a FilesGetOutput.
func MapFilesGetOutputFromJSON(data []byte) (*FilesGetOutput, error) {
	var v FilesGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFilesGetOutputToJSON serializes a FilesGetOutput to JSON.
func MapFilesGetOutputToJSON(v *FilesGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
