package mcp_runner

import (
	"context"
	"fmt"

	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

type runnerServer struct {
	pb.UnimplementedMcpRunnerServer

	state *RunnerState
}

func (s *runnerServer) GetRunnerInfo(context.Context, *pb.RunnerInfoRequest) (*pb.RunnerInfoResponse, error) {
	health := s.getRunnerHealth()

	res := &pb.RunnerInfoResponse{
		RunnerId:  s.state.RunnerID,
		StartTime: s.state.StartTime.Unix(),

		ActiveRuns: uint32(len(s.state.active_runs)),
		TotalRuns:  s.state.total_runs,

		AcceptingRuns: health.AcceptingRuns,
		Status:        health.Status,
	}

	return res, nil
}

func (s *runnerServer) getRunnerHealth() *pb.RunnerHealthResponse {
	res := &pb.RunnerHealthResponse{
		RunnerId:      s.state.RunnerID,
		Status:        pb.RunnerStatus_HEALTHY,
		AcceptingRuns: pb.RunnerAcceptingJobs_ACCEPTING,
	}

	if !s.state.health.Health.healthy {
		res.Status = pb.RunnerStatus_UNHEALTHY
	}

	if !s.state.health.Health.acceptingRuns {
		res.AcceptingRuns = pb.RunnerAcceptingJobs_NOT_ACCEPTING
	}

	return res
}

func (s *runnerServer) StreamRunnerHealth(req *pb.RunnerHealthRequest, stream pb.McpRunner_StreamRunnerHealthServer) error {
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

func (s *runnerServer) ListActiveRuns(ctx context.Context, req *pb.Empty) (*pb.ActiveRunsResponse, error) {
	runs := s.state.ListActiveRuns()

	activeRuns := make([]*pb.RunInfo, len(runs))
	for i, run := range runs {
		activeRuns[i] = &pb.RunInfo{
			RunId:       run.ID,
			DockerImage: run.Init.DockerImage,
			MaxMemory:   run.Init.ContainerMaxMemory,
			MaxCpu:      run.Init.ContainerMaxCPU,
			StartTime:   run.StartTime.Unix(),
		}
	}

	return &pb.ActiveRunsResponse{Runs: activeRuns}, nil
}

func (s *runnerServer) ListDockerImages(ctx context.Context, req *pb.Empty) (*pb.DockerImagesResponse, error) {
	images := s.state.dockerManager.ListImages()

	imageInfos := make([]*pb.DockerImageInfo, len(images))
	for i, image := range images {
		imageInfos[i] = &pb.DockerImageInfo{
			Name:     image.Name,
			Tag:      image.Tag,
			ImageId:  image.ImageID,
			LastUsed: image.LastUsed.Unix(),
		}
	}

	return &pb.DockerImagesResponse{Images: imageInfos}, nil
}

func (s *runnerServer) ListDockerContainers(ctx context.Context, req *pb.Empty) (*pb.DockerContainersResponse, error) {
	containers := s.state.dockerManager.ListContainers()

	containerInfos := make([]*pb.DockerContainerInfo, len(containers))
	for i, container := range containers {
		containerInfos[i] = &pb.DockerContainerInfo{
			ContainerId: container.ID,
			ImageName:   container.ImageRef,
			ExitCode:    int32(container.ExitCode),
			Running:     container.Running,
		}
	}

	return &pb.DockerContainersResponse{Containers: containerInfos}, nil
}

func (s *runnerServer) StreamMcpRun(stream pb.McpRunner_StreamMcpRunServer) error {
	req, err := stream.Recv()
	if err != nil {
		if err == context.Canceled {
			return nil // Client has closed the stream
		}

		return err // Other error
	}

	msg, ok := req.JobType.(*pb.McpRunRequest_McpInit)
	if !ok {
		return fmt.Errorf("expected McpInit request, got %T", req.JobType)
	}

	run, err := s.state.StartRun(&RunInit{
		DockerImage:        msg.McpInit.RunConfig.DockerImage,
		ContainerEnv:       msg.McpInit.RunConfig.EnvVars,
		ContainerArgs:      msg.McpInit.RunConfig.Args,
		ContainerCommand:   msg.McpInit.RunConfig.Command,
		ContainerMaxMemory: msg.McpInit.RunConfig.MaxMemory,
		ContainerMaxCPU:    msg.McpInit.RunConfig.MaxCpu,
	})
	if err != nil {
		return stream.Send(&pb.McpRunResponse{
			JobType: &pb.McpRunResponse_McpError{
				McpError: &pb.McpRunResponseError{
					ErrorMessage: err.Error(),
					ErrorCode:    pb.McpRunErrorCode_MCP_RUN_FAILED_TO_START,
				},
			},
		})
	}

	if err := stream.Send(&pb.McpRunResponse{
		JobType: &pb.McpRunResponse_McpInit{
			McpInit: &pb.McpRunResponseInit{
				RunId: run.ID,
			},
		},
	}); err != nil {
		return err
	}

	go run.HandleOutput(
		func(message *mcp.MCPMessage) {
			err := stream.Send(&pb.McpRunResponse{
				JobType: &pb.McpRunResponse_McpMessage{
					McpMessage: &pb.McpRunResponseMcpMessage{
						Message: message.GetStringPayload(),
					},
				},
			})

			if err != nil {
				fmt.Printf("Failed to send MCP message: %v\n", err)
			}
		},
		func(outputType OutputType, message string) {
			var outputMsg *pb.McpRunResponse_McpOutput
			if outputType == OutputTypeStdout {
				outputMsg = &pb.McpRunResponse_McpOutput{
					McpOutput: &pb.McpRunResponseOutput{
						OutputType: pb.McpOutputType_MCP_JOB_OUTPUT_TYPE_STDOUT,
						Lines:      []string{message},
					},
				}
			} else {
				outputMsg = &pb.McpRunResponse_McpOutput{
					McpOutput: &pb.McpRunResponseOutput{
						OutputType: pb.McpOutputType_MCP_JOB_OUTPUT_TYPE_STDERR,
						Lines:      []string{message},
					},
				}
			}

			if err := stream.Send(&pb.McpRunResponse{JobType: outputMsg}); err != nil {
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
		case *pb.McpRunRequest_McpInit:
			continue

		case *pb.McpRunRequest_McpClose:
			if err := run.Stop(); err != nil {
				return stream.Send(&pb.McpRunResponse{
					JobType: &pb.McpRunResponse_McpError{
						McpError: &pb.McpRunResponseError{
							ErrorMessage: err.Error(),
							ErrorCode:    pb.McpRunErrorCode_MCP_RUN_FAILED_TO_STOP,
						},
					},
				})
			}

			return stream.Send(&pb.McpRunResponse{
				JobType: &pb.McpRunResponse_McpClose{
					McpClose: &pb.McpRunResponseClose{},
				},
			})

		case *pb.McpRunRequest_McpMessage:
			err = run.HandleInput(msg.McpMessage.Message)
			if err != nil {
				return stream.Send(&pb.McpRunResponse{
					JobType: &pb.McpRunResponse_McpError{
						McpError: &pb.McpRunResponseError{
							ErrorMessage: err.Error(),
							ErrorCode:    pb.McpRunErrorCode_MCP_RUN_INVALID_MCP_MESSAGE,
						},
					},
				})
			}
		}
	}
}
