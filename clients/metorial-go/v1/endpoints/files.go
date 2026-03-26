package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/files"
)

// FilesEndpoint provides access to represents files that you have uploaded to Metorial. Files can be linked to various resources based on their purpose. Metorial can also automatically extract files for you, for example for data exports.
type FilesEndpoint struct {
	client *endpoint.Client
}

// NewFilesEndpoint creates a new FilesEndpoint.
func NewFilesEndpoint(client *endpoint.Client) *FilesEndpoint {
	return &FilesEndpoint{client: client}
}

// FilesEndpointListParams contains optional query parameters for List.
type FilesEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Purpose - Filter by file purpose
	Purpose *string `json:"purpose,omitempty"`
}

// List returns a paginated list of files owned by the instance.
func (e *FilesEndpoint) List(params *FilesEndpointListParams) (*files.FilesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"files"},
		Query: query,
	}
	var result files.FilesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves details for a specific file by its ID.
func (e *FilesEndpoint) Get(fileId string) (*files.FilesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"files", fileId},
	}
	var result files.FilesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete deletes a specific file by its ID.
func (e *FilesEndpoint) Delete(fileId string) (*files.FilesDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"files", fileId},
	}
	var result files.FilesDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
