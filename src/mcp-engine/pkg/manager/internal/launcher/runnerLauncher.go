package launcher

import (
	"encoding/json"
	"fmt"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
)

type RunnerLaunchParams struct {
	Command string            `json:"command" validate:"required"`
	Args    []string          `json:"args,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

func GetRunnerLaunchParams(input *managerPb.RunConfigWithLauncher) (*runnerPb.RunConfig, error) {
	var configMap map[string]any
	err := json.Unmarshal([]byte(input.Launcher.JsonConfig), &configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal json_config: %v", err)
	}

	params, err := GetTypedLaunchParams[RunnerLaunchParams](LaunchParamsInput{
		GetLaunchParams: input.Launcher.Code,
		Config:          configMap,
	})
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
