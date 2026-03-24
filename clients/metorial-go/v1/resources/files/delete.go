package files

import (
	"encoding/json"
	"time"
)

// FilesDeleteOutputPurpose represents the files delete output purpose type.
type FilesDeleteOutputPurpose struct {
	// Name - The file's purpose name
	Name string `json:"name"`
	// Identifier - The file's purpose identifier
	Identifier string `json:"identifier"`
}

// FilesDeleteOutput represents the files delete output type.
type FilesDeleteOutput struct {
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
	Title   *string                  `json:"title,omitempty"`
	Purpose FilesDeleteOutputPurpose `json:"purpose"`
	// CreatedAt - The files's creation date
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - The files's last update date
	UpdatedAt time.Time `json:"updated_at"`
}

// MapFilesDeleteOutputFromJSON deserializes JSON data into a FilesDeleteOutput.
func MapFilesDeleteOutputFromJSON(data []byte) (*FilesDeleteOutput, error) {
	var v FilesDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapFilesDeleteOutputToJSON serializes a FilesDeleteOutput to JSON.
func MapFilesDeleteOutputToJSON(v *FilesDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
