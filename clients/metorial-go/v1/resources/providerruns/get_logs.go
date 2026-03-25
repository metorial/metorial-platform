package providerruns

import (
	"encoding/json"
	"time"
)

// ProviderRunsGetLogsOutputLogs represents the provider runs get logs output logs type.
type ProviderRunsGetLogsOutputLogs struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Timestamp - Log timestamp
	Timestamp time.Time `json:"timestamp"`
	// Message - Log message content
	Message string `json:"message"`
	// OutputType - Output type of the log entry
	OutputType string `json:"output_type"`
}

// ProviderRunsGetLogsOutput represents the provider runs get logs output type.
type ProviderRunsGetLogsOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// ProviderRunId - Provider run ID
	ProviderRunId string `json:"provider_run_id"`
	// Logs - Array of log entries
	Logs []ProviderRunsGetLogsOutputLogs `json:"logs"`
}

// MapProviderRunsGetLogsOutputFromJSON deserializes JSON data into a ProviderRunsGetLogsOutput.
func MapProviderRunsGetLogsOutputFromJSON(data []byte) (*ProviderRunsGetLogsOutput, error) {
	var v ProviderRunsGetLogsOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderRunsGetLogsOutputToJSON serializes a ProviderRunsGetLogsOutput to JSON.
func MapProviderRunsGetLogsOutputToJSON(v *ProviderRunsGetLogsOutput) ([]byte, error) {
	return json.Marshal(v)
}
