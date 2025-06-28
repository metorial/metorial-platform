package mcp_runner_client

import (
	"context"
	"fmt"

	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type McpRunnerClient struct {
	conn   *grpc.ClientConn
	client pb.McpRunnerClient
}

func NewMcpRunnerClient(address string) (*McpRunnerClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := pb.NewMcpRunnerClient(conn)

	return &McpRunnerClient{
		conn:   conn,
		client: client,
	}, nil
}

func (c *McpRunnerClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *McpRunnerClient) GetRunnerInfo() (*pb.RunnerInfoResponse, error) {
	if c.client == nil {
		return nil, fmt.Errorf("McpRunnerClient is not initialized")
	}

	return c.client.GetRunnerInfo(context.Background(), &pb.RunnerInfoRequest{})
}

func (c *McpRunnerClient) StreamRunnerHealth(onHealthUpdate func(*pb.RunnerHealthResponse)) error {
	if c.client == nil {
		return fmt.Errorf("McpRunnerClient is not initialized")
	}

	stream, err := c.client.StreamRunnerHealth(context.Background(), &pb.RunnerHealthRequest{})
	if err != nil {
		return err
	}

	for {
		resp, err := stream.Recv()
		if err != nil {
			return err
		}

		onHealthUpdate(resp)
	}
}

func (c *McpRunnerClient) StreamMcpRun(config *pb.RunConfig) (*Run, error) {
	if c.client == nil {
		return nil, fmt.Errorf("McpRunnerClient is not initialized")
	}

	return NewRun(config, c.client), nil
}
