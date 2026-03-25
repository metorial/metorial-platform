package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/filelinks"
)

// FileLinksEndpoint provides access to files are private by default. If you want to share a file, you can create a link for it. Links are public and do not require authentication to access, so be careful with what you share.
type FileLinksEndpoint struct {
	client *endpoint.Client
}

// NewFileLinksEndpoint creates a new FileLinksEndpoint.
func NewFileLinksEndpoint(client *endpoint.Client) *FileLinksEndpoint {
	return &FileLinksEndpoint{client: client}
}

// FileLinksEndpointListParams contains optional query parameters for List.
type FileLinksEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// FileId - Filter by file ID
	FileId *string `json:"file_id,omitempty"`
}

// FileLinksEndpointCreateBody contains the request body for Create.
type FileLinksEndpointCreateBody struct {
	FileId    string  `json:"file_id"`
	ExpiresAt *string `json:"expires_at,omitempty"`
}

// List returns a paginated list of file links owned by the instance organization.
func (e *FileLinksEndpoint) List(params *FileLinksEndpointListParams) (*filelinks.FileLinksListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"file-links"},
		Query: query,
	}
	var result filelinks.FileLinksListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves the details of a specific file link by its ID.
func (e *FileLinksEndpoint) Get(linkId string) (*filelinks.FileLinksGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"file-links", linkId},
	}
	var result filelinks.FileLinksGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new link for a specific file.
func (e *FileLinksEndpoint) Create(body *FileLinksEndpointCreateBody) (*filelinks.FileLinksCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"file-links"},
		Body: body,
	}
	var result filelinks.FileLinksCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete deletes a specific file link by its ID.
func (e *FileLinksEndpoint) Delete(linkId string) (*filelinks.FileLinksDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"file-links", linkId},
	}
	var result filelinks.FileLinksDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
