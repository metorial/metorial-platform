package launcher

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"time"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/modules/util"
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

	ServerUrl string `json:"remote_url,omitempty"`
	Protocol  string `json:"protocol,omitempty"`
}

func (l *Launcher) GetRemoteLaunchParams(input *managerPb.RemoteRunConfigWithLauncher) (*remotePb.RunConfigRemote, error) {
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

	server := &remotePb.RunConfigRemoteServer{
		ServerUri: input.Server.ServerUri,
		Protocol:  input.Server.Protocol,
	}

	if params.ServerUrl != "" {
		baseUri, err := url.Parse(input.Server.ServerUri)
		if err != nil {
			return nil, fmt.Errorf("failed to parse base server URI: %w", err)
		}

		updatedUri, err := url.Parse(params.ServerUrl)
		if err != nil {
			return nil, fmt.Errorf("failed to parse updated server URI: %w", err)
		}

		// Make sure that the host and scheme are the same as the base URI
		if updatedUri.Scheme == "" {
			baseUri.Scheme = updatedUri.Scheme
		}
		if updatedUri.Host == "" {
			baseUri.Host = updatedUri.Host
		}

		if updatedUri.Host != baseUri.Host {
			return nil, fmt.Errorf("updated server URI host does not match base URI host")
		}
		if updatedUri.Scheme != baseUri.Scheme {
			return nil, fmt.Errorf("updated server URI scheme does not match base URI scheme")
		}

		server.ServerUri = updatedUri.String()
	}

	if params.Protocol != "" {
		switch params.Protocol {
		case "sse":
			server.Protocol = remotePb.RunConfigRemoteServer_sse
		case "streamable_http":
			server.Protocol = remotePb.RunConfigRemoteServer_streamable_http
		default:
			return nil, fmt.Errorf("unsupported protocol: %s", params.Protocol)
		}
	}

	return &remotePb.RunConfigRemote{
		Server: server,
		Arguments: &remotePb.RunConfigRemoteArguments{
			Headers: params.Headers,
			Query:   params.Query,
		},
	}, nil
}

type LambdaLaunchParams struct {
	Args map[string]any `json:"args,omitempty"`
}

func (l *Launcher) GetLambdaLaunchParams(input *managerPb.LambdaRunConfigWithLauncher) (*remotePb.RunConfigLambda, error) {
	params, err := GetTypedLaunchParams[LambdaLaunchParams](l.workerManager, input.Launcher)
	if err != nil {
		return nil, err
	}

	return &remotePb.RunConfigLambda{
		Server: input.Server,
		Arguments: &remotePb.RunConfigLambdaArguments{
			JsonArguments: string(util.Must(json.Marshal(params.Args))),
		},
	}, nil
}

func GetTypedLaunchParams[T any](workerManager *workers.WorkerManager, input *launcherPb.LauncherConfig) (T, error) {
	var zero T

	startTime := time.Now()

	worker, exists := workerManager.PickWorkerRandomly(workers.WorkerTypeLauncher)
	if !exists {
		return zero, fmt.Errorf("no available launcher worker found")
	}

	result, err := worker.RunLauncher(input)
	if err != nil {
		return zero, fmt.Errorf("failed to run launcher: %w", err)
	}

	duration := time.Since(startTime)
	log.Printf("Launcher executed in %s", duration.String())

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
