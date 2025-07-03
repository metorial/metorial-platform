package launcher

import (
	"fmt"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers"
)

type Launcher struct {
	workerManager *workers.WorkerManager
}

func NewLauncher(workers *workers.WorkerManager) *Launcher {
	return &Launcher{
		workerManager: workers,
	}
}

type RunnerLaunchParams struct {
	Command string            `json:"command" validate:"required"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

func (l *Launcher) GetRunnerLaunchParams(input *managerPb.RunConfigWithLauncher) (*runnerPb.RunConfig, error) {
	params, err := GetTypedLaunchParams[RunnerLaunchParams](l.workerManager, input.Launcher)
	if err != nil {
		return nil, err
	}

	return &runnerPb.RunConfig{
		Container: input.Container,
		Arguments: &runnerPb.RunConfigContainerArguments{
			Command: params.Command,
			Args:    params.Args,
			EnvVars: params.Env,
		},
	}, nil
}

func GetTypedLaunchParams[T any](workerManager *workers.WorkerManager, input *launcherPb.LauncherConfig) (T, error) {
	var zero T

	worker, exists := workerManager.PickWorkerRandomly(workers.WorkerTypeLauncher)
	if !exists {
		return zero, fmt.Errorf("no available launcher worker found")
	}

	result, err := worker.RunLauncher(input)
	if err != nil {
		return zero, fmt.Errorf("failed to run launcher: %w", err)
	}

	if result.Type != launcherPb.RunLauncherResponse_success {
		return zero, fmt.Errorf("launch params execution failed: %s", result.ErrorMessage)
	}

	var target T
	err = ValidateAndConvert(result, &target)
	if err != nil {
		return zero, err
	}

	return target, nil
}
