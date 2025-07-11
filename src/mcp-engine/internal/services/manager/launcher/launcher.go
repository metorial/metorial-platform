package launcher

import (
	"fmt"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
)

type Launcher struct {
	workerManager *workers.WorkerManager
}

func NewLauncher(workers *workers.WorkerManager) *Launcher {
	return &Launcher{
		workerManager: workers,
	}
}

type ContainerLaunchParams struct {
	Command string            `json:"command" validate:"required"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

func (l *Launcher) GetContainerLaunchParams(input *managerPb.ContainerRunConfigWithLauncher) (*runnerPb.RunConfig, error) {
	params, err := GetTypedLaunchParams[ContainerLaunchParams](l.workerManager, input.Launcher)
	if err != nil {
		return nil, err
	}

	if params.Args == nil {
		params.Args = []string{}
	}

	if params.Env == nil {
		params.Env = make(map[string]string)
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

type RemoteLaunchParams struct {
	Headers map[string]string `json:"headers,omitempty"`
	Query   map[string]string `json:"query,omitempty"`
}

func (l *Launcher) GetRemoteLaunchParams(input *managerPb.RemoteRunConfigWithLauncher) (*remotePb.RunConfig, error) {
	params, err := GetTypedLaunchParams[RemoteLaunchParams](l.workerManager, input.Launcher)
	if err != nil {
		return nil, err
	}

	if params.Headers == nil {
		params.Headers = make(map[string]string)
	}

	if params.Query == nil {
		params.Query = make(map[string]string)
	}

	return &remotePb.RunConfig{
		Server: input.Server,
		Arguments: &remotePb.RunConfigRemoteArguments{
			Headers: params.Headers,
			Query:   params.Query,
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
