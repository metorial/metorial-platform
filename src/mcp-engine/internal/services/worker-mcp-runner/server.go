package worker_mcp_runner

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	commonPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/common"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/util"
)

type runnerServer struct {
	runnerPb.UnimplementedMcpRunnerServer

	state  *RunnerState
	worker *worker.Worker
}

func (s *runnerServer) GetRunnerInfo(ctx context.Context, req *runnerPb.RunnerInfoRequest) (*runnerPb.RunnerInfoResponse, error) {
	WorkerInfo, err := s.worker.WorkerServer().GetWorkerInfo(ctx, &workerPb.WorkerInfoRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to get worker info: %w", err)
	}

	res := &runnerPb.RunnerInfoResponse{
		RunnerId: s.state.RunnerID,

		WorkerInfo: WorkerInfo,

		ActiveRuns: uint32(len(s.state.active_runs)),
		TotalRuns:  s.state.total_runs,
	}

	return res, nil
}

func (s *runnerServer) ListActiveRuns(ctx context.Context, req *commonPb.Empty) (*runnerPb.ActiveRunsResponse, error) {
	runs := s.state.ListActiveRuns()

	activeRuns := make([]*runnerPb.RunInfo, len(runs))
	for i, run := range runs {
		activeRuns[i] = &runnerPb.RunInfo{
			RunId:       run.ID,
			DockerImage: run.Init.DockerImage,
			MaxMemory:   run.Init.ContainerMaxMemory,
			MaxCpu:      run.Init.ContainerMaxCPU,
			StartTime:   run.StartTime.UnixMilli(),
		}
	}

	return &runnerPb.ActiveRunsResponse{Runs: activeRuns}, nil
}

func (s *runnerServer) ListDockerImages(ctx context.Context, req *commonPb.Empty) (*runnerPb.DockerImagesResponse, error) {
	images := s.state.dockerManager.ListImages()

	imageInfos := make([]*runnerPb.DockerImageInfo, len(images))
	for i, image := range images {
		imageInfos[i] = &runnerPb.DockerImageInfo{
			Name:     image.Name,
			Tag:      image.Tag,
			ImageId:  image.ImageID,
			LastUsed: image.LastUsed.UnixMilli(),
		}
	}

	return &runnerPb.DockerImagesResponse{Images: imageInfos}, nil
}

func (s *runnerServer) ListDockerContainers(ctx context.Context, req *commonPb.Empty) (*runnerPb.DockerContainersResponse, error) {
	containers := s.state.dockerManager.ListContainers()

	containerInfos := make([]*runnerPb.DockerContainerInfo, len(containers))
	for i, container := range containers {
		containerInfos[i] = &runnerPb.DockerContainerInfo{
			ContainerId: container.ID,
			ImageName:   container.ImageRef,
			ExitCode:    int32(container.ExitCode),
			Running:     container.Running,
		}
	}

	return &runnerPb.DockerContainersResponse{Containers: containerInfos}, nil
}

func (s *runnerServer) StreamMcpRun(stream runnerPb.McpRunner_StreamMcpRunServer) error {
	req, err := stream.Recv()
	if err != nil {
		if err == context.Canceled {
			return nil // Client has closed the stream
		}

		return err // Other error
	}

	msg, ok := req.Type.(*runnerPb.RunRequest_Init)
	if !ok {
		return fmt.Errorf("expected McpInit request, got %T", req.Type)
	}

	run, err := s.state.StartRun(&RunInit{
		ID: msg.Init.ConnectionId,

		DockerImage:        msg.Init.RunConfig.Container.DockerImage,
		ContainerMaxMemory: msg.Init.RunConfig.Container.MaxMemory,
		ContainerMaxCPU:    msg.Init.RunConfig.Container.MaxCpu,

		ContainerEnv:     msg.Init.RunConfig.Arguments.EnvVars,
		ContainerArgs:    msg.Init.RunConfig.Arguments.Args,
		ContainerCommand: msg.Init.RunConfig.Arguments.Command,
	})
	if err != nil {
		return stream.Send(&runnerPb.RunResponse{
			Type: &runnerPb.RunResponse_Error{
				Error: &runnerPb.RunResponseError{
					McpError: &mcpPb.McpError{
						ErrorMessage: err.Error(),
						ErrorCode:    mcpPb.McpError_failed_to_start,
					},
				},
			},
		})
	}

	err = stream.Send(&runnerPb.RunResponse{
		Type: &runnerPb.RunResponse_Init{
			Init: &runnerPb.RunResponseInit{},
		},
	})
	if err != nil {
		return err
	}

	go run.HandleOutput(
		func(message *mcp.MCPMessage) {
			err := stream.Send(&runnerPb.RunResponse{
				Type: &runnerPb.RunResponse_McpMessage{
					McpMessage: &runnerPb.RunResponseMcpMessage{
						Message: &mcpPb.McpMessageRaw{
							Message: message.GetStringPayload(),
							Uuid:    util.Must(uuid.NewV7()).String(),
						},
					},
				},
			})
			if err != nil {
				log.Printf("Failed to send MCP message: %v\n", err)
			}
		},
		func(outputType OutputType, lines []string) {
			var outputMsg *runnerPb.RunResponse_Output
			if outputType == OutputTypeStdout {
				outputMsg = &runnerPb.RunResponse_Output{
					Output: &runnerPb.RunResponseOutput{
						McpOutput: &mcpPb.McpOutput{
							OutputType: mcpPb.McpOutput_stdout,
							Lines:      lines,
						},
					},
				}
			} else {
				outputMsg = &runnerPb.RunResponse_Output{
					Output: &runnerPb.RunResponseOutput{
						McpOutput: &mcpPb.McpOutput{
							OutputType: mcpPb.McpOutput_stderr,
							Lines:      lines,
						},
					},
				}
			}

			err := stream.Send(&runnerPb.RunResponse{Type: outputMsg})
			if err != nil {
				log.Printf("Failed to send output message: %v\n", err)
			}
		},
	)

	closeWg := &sync.WaitGroup{}
	closeWg.Add(1)

	go func() {
		// Wait for the run to finish
		<-run.Done()

		closeWg.Done()

		time.Sleep(100 * time.Millisecond)

		if run.Status() != 0 {
			stream.Send(&runnerPb.RunResponse{
				Type: &runnerPb.RunResponse_Error{
					Error: &runnerPb.RunResponseError{
						McpError: &mcpPb.McpError{
							ErrorMessage: fmt.Sprintf("Finished with non-zero exit code: %d", run.Status()),
							ErrorCode:    mcpPb.McpError_execution_error,
						},
					},
				},
			})
		}

		stream.Send(&runnerPb.RunResponse{
			Type: &runnerPb.RunResponse_Close{
				Close: &runnerPb.RunResponseClose{},
			},
		})
	}()

	log.Printf("Run started with ID: %s\n", run.ID)

loop:
	for {
		req, err := stream.Recv()
		if err != nil {
			run.Stop() // Attempt to stop the run gracefully

			if err == context.Canceled {
				return nil // Client has closed the stream
			}

			return err
		}

		switch msg := req.Type.(type) {
		case *runnerPb.RunRequest_Init:
			continue

		case *runnerPb.RunRequest_Close:
			err := run.Stop()
			if err != nil {
				return stream.Send(&runnerPb.RunResponse{
					Type: &runnerPb.RunResponse_Error{
						Error: &runnerPb.RunResponseError{
							McpError: &mcpPb.McpError{
								ErrorMessage: err.Error(),
								ErrorCode:    mcpPb.McpError_failed_to_stop,
							},
						},
					},
				})
			}

			break loop

		case *runnerPb.RunRequest_McpMessage:
			err = run.HandleInput(msg.McpMessage.Message.Message)
			if err != nil {
				return stream.Send(&runnerPb.RunResponse{
					Type: &runnerPb.RunResponse_Error{
						Error: &runnerPb.RunResponseError{
							McpError: &mcpPb.McpError{
								ErrorMessage: err.Error(),
								ErrorCode:    mcpPb.McpError_invalid_mcp_message,
							},
						},
					},
				})
			}
		}
	}

	closeWg.Wait()

	return nil
}
