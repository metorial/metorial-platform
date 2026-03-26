package deployments

import (
	"encoding/json"
	"time"
)

// CustomProvidersDeploymentsGetLogsOutputStepsLogs represents the custom providers deployments get logs output steps logs type.
type CustomProvidersDeploymentsGetLogsOutputStepsLogs struct {
	// Object - String representing the deployment log entry's type
	Object string `json:"object"`
	// Timestamp - Log entry timestamp
	Timestamp time.Time `json:"timestamp"`
	// Message - Log message
	Message string `json:"message"`
}

// CustomProvidersDeploymentsGetLogsOutputSteps represents the custom providers deployments get logs output steps type.
type CustomProvidersDeploymentsGetLogsOutputSteps struct {
	// Object - String representing the deployment log step's type
	Object string `json:"object"`
	// Id - Step identifier
	Id string `json:"id"`
	// Name - Step name
	Name string `json:"name"`
	// Type - Step type
	Type string `json:"type"`
	// Status - Step status
	Status string                                             `json:"status"`
	Logs   []CustomProvidersDeploymentsGetLogsOutputStepsLogs `json:"logs"`
	// CreatedAt - Timestamp when step was created
	CreatedAt time.Time `json:"created_at"`
	// StartedAt - Timestamp when step started
	StartedAt *time.Time `json:"started_at,omitempty"`
	// EndedAt - Timestamp when step ended
	EndedAt *time.Time `json:"ended_at,omitempty"`
}

// CustomProvidersDeploymentsGetLogsOutput represents the custom providers deployments get logs output type.
type CustomProvidersDeploymentsGetLogsOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// CustomProviderDeploymentId - ID of the deployment these logs belong to
	CustomProviderDeploymentId string `json:"custom_provider_deployment_id"`
	// Steps - Deployment steps with logs
	Steps []CustomProvidersDeploymentsGetLogsOutputSteps `json:"steps"`
}

// MapCustomProvidersDeploymentsGetLogsOutputFromJSON deserializes JSON data into a CustomProvidersDeploymentsGetLogsOutput.
func MapCustomProvidersDeploymentsGetLogsOutputFromJSON(data []byte) (*CustomProvidersDeploymentsGetLogsOutput, error) {
	var v CustomProvidersDeploymentsGetLogsOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersDeploymentsGetLogsOutputToJSON serializes a CustomProvidersDeploymentsGetLogsOutput to JSON.
func MapCustomProvidersDeploymentsGetLogsOutputToJSON(v *CustomProvidersDeploymentsGetLogsOutput) ([]byte, error) {
	return json.Marshal(v)
}
