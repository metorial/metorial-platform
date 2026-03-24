package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsListOutputItems represents the callbacks destinations list output items type.
type CallbacksDestinationsListOutputItems struct {
	Object      string          `json:"object"`
	Id          string          `json:"id"`
	Status      string          `json:"status"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	Url         string          `json:"url"`
	Method      string          `json:"method"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// CallbacksDestinationsListOutputPagination represents the callbacks destinations list output pagination type.
type CallbacksDestinationsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksDestinationsListOutput represents the callbacks destinations list output type.
type CallbacksDestinationsListOutput struct {
	Items      []CallbacksDestinationsListOutputItems    `json:"items"`
	Pagination CallbacksDestinationsListOutputPagination `json:"pagination"`
}

// MapCallbacksDestinationsListOutputFromJSON deserializes JSON data into a CallbacksDestinationsListOutput.
func MapCallbacksDestinationsListOutputFromJSON(data []byte) (*CallbacksDestinationsListOutput, error) {
	var v CallbacksDestinationsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsListOutputToJSON serializes a CallbacksDestinationsListOutput to JSON.
func MapCallbacksDestinationsListOutputToJSON(v *CallbacksDestinationsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksDestinationsListQuery represents the callbacks destinations list query type.
type CallbacksDestinationsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// MapCallbacksDestinationsListQueryFromJSON deserializes JSON data into a CallbacksDestinationsListQuery.
func MapCallbacksDestinationsListQueryFromJSON(data []byte) (*CallbacksDestinationsListQuery, error) {
	var v CallbacksDestinationsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsListQueryToJSON serializes a CallbacksDestinationsListQuery to JSON.
func MapCallbacksDestinationsListQueryToJSON(v *CallbacksDestinationsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
