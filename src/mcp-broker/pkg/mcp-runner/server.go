package mcp_runner

import (
	"context"
	"fmt"

	commonPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/common"
	mcpPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	runnerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
)

type runnerServer struct {
	runnerPb.UnimplementedMcpRunnerServer

	state *RunnerState
}

func (s *runnerServer) GetRunnerInfo(context.Context, *runnerPb.RunnerInfoRequest) (*runnerPb.RunnerInfoResponse, error) {
	health := s.getRunnerHealth()

	res := &runnerPb.RunnerInfoResponse{
		RunnerId:  s.state.RunnerID,
		StartTime: s.state.StartTime.Unix(),

		ActiveRuns: uint32(len(s.state.active_runs)),
		TotalRuns:  s.state.total_runs,

		AcceptingRuns: health.AcceptingRuns,
		Status:        health.Status,
	}

	return res, nil
}

func (s *runnerServer) getRunnerHealth() *runnerPb.RunnerHealthResponse {
	res := &runnerPb.RunnerHealthResponse{
		RunnerId:      s.state.RunnerID,
		Status:        runnerPb.RunnerStatus_HEALTHY,
		AcceptingRuns: runnerPb.RunnerAcceptingJobs_ACCEPTING,
	}

	if !s.state.health.Health.healthy {
		res.Status = runnerPb.RunnerStatus_UNHEALTHY
	}

	if !s.state.health.Health.acceptingRuns {
		res.AcceptingRuns = runnerPb.RunnerAcceptingJobs_NOT_ACCEPTING
	}

	return res
}

func (s *runnerServer) StreamRunnerHealth(req *runnerPb.RunnerHealthRequest, stream runnerPb.McpRunner_StreamRunnerHealthServer) error {
	if err := stream.Send(s.getRunnerHealth()); err != nil {
		return err
	}

	for {
		select {
		case <-s.state.health.HealthChan:
			if err := stream.Send(s.getRunnerHealth()); err != nil {
				return err
			}
		case <-stream.Context().Done():
			// Stream has been closed by the client
			return nil
		}
	}
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
			StartTime:   run.StartTime.Unix(),
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
			LastUsed: image.LastUsed.Unix(),
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

	msg, ok := req.JobType.(*runnerPb.RunRequest_Init)
	if !ok {
		return fmt.Errorf("expected McpInit request, got %T", req.JobType)
	}

	run, err := s.state.StartRun(&RunInit{
		DockerImage:        msg.Init.RunConfig.Container.DockerImage,
		ContainerMaxMemory: msg.Init.RunConfig.Container.MaxMemory,
		ContainerMaxCPU:    msg.Init.RunConfig.Container.MaxCpu,

		ContainerEnv:     msg.Init.RunConfig.ContainerArguments.EnvVars,
		ContainerArgs:    msg.Init.RunConfig.ContainerArguments.Args,
		ContainerCommand: msg.Init.RunConfig.ContainerArguments.Command,
	})
	if err != nil {
		return stream.Send(&runnerPb.RunResponse{
			JobType: &runnerPb.RunResponse_Error{
				Error: &runnerPb.RunResponseError{
					McpError: &mcpPb.McpError{
						ErrorMessage: err.Error(),
						ErrorCode:    mcpPb.McpError_failed_to_start,
					},
				},
			},
		})

	}

	if err := stream.Send(&runnerPb.RunResponse{
		JobType: &runnerPb.RunResponse_Init{
			Init: &runnerPb.RunResponseInit{
				RunId: run.ID,
			},
		},
	}); err != nil {
		return err
	}

	go run.HandleOutput(
		func(message *mcp.MCPMessage) {
			err := stream.Send(&runnerPb.RunResponse{
				JobType: &runnerPb.RunResponse_McpMessage{
					McpMessage: &runnerPb.RunResponseMcpMessage{
						Message: &mcpPb.McpMessageRaw{
							Message: message.GetStringPayload(),
						},
					},
				},
			})

			if err != nil {
				fmt.Printf("Failed to send MCP message: %v\n", err)
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

			if err := stream.Send(&runnerPb.RunResponse{JobType: outputMsg}); err != nil {
				fmt.Printf("Failed to send output message: %v\n", err)
			}
		},
	)

	for {
		req, err := stream.Recv()
		if err != nil {
			run.Stop() // Attempt to stop the run gracefully

			if err == context.Canceled {
				return nil // Client has closed the stream
			}

			return err
		}

		switch msg := req.JobType.(type) {
		case *runnerPb.RunRequest_Init:
			continue

		case *runnerPb.RunRequest_Close:
			if err := run.Stop(); err != nil {
				return stream.Send(&runnerPb.RunResponse{
					JobType: &runnerPb.RunResponse_Error{
						Error: &runnerPb.RunResponseError{
							McpError: &mcpPb.McpError{
								ErrorMessage: err.Error(),
								ErrorCode:    mcpPb.McpError_failed_to_stop,
							},
						},
					},
				})
			}

			return stream.Send(&runnerPb.RunResponse{
				JobType: &runnerPb.RunResponse_Close{
					Close: &runnerPb.RunResponseClose{},
				},
			})

		case *runnerPb.RunRequest_McpMessage:
			err = run.HandleInput(msg.McpMessage.Message.Message)
			if err != nil {
				return stream.Send(&runnerPb.RunResponse{
					JobType: &runnerPb.RunResponse_Error{
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
}
