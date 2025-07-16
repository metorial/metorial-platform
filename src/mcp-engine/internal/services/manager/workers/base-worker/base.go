package base_worker

import (
	"context"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	launcherPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	workerPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

type BaseWorkerConnection struct {
	workerID string
	address  string

	context context.Context
	cancel  context.CancelFunc

	conn   *grpc.ClientConn
	client workerPB.WorkerClient

	healthBroadcast *pubsub.Broadcaster[*workerPB.WorkerInfoResponse]

	acceptingJobs workerPB.WorkerAcceptingJobs
	status        workerPB.WorkerStatus

	mutex sync.Mutex
}

func NewBaseWorkerConnection(ctx context.Context, workerID string, address string) *BaseWorkerConnection {
	ctx, cancel := context.WithCancel(ctx)

	res := &BaseWorkerConnection{
		workerID: workerID,
		address:  address,

		context: ctx,
		cancel:  cancel,

		healthBroadcast: pubsub.NewBroadcaster[*workerPB.WorkerInfoResponse](),

		acceptingJobs: workerPB.WorkerAcceptingJobs_not_accepting,
		status:        workerPB.WorkerStatus_unhealthy,
	}

	return res
}

func (bw *BaseWorkerConnection) Start() error {
	if bw.context == nil {
		return fmt.Errorf("worker connection is not initialized")
	}

	address := bw.address

	bw.mutex.Lock()
	defer bw.mutex.Unlock()

	conn, err := grpc.NewClient(address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{
			Backoff: backoff.Config{
				BaseDelay:  1 * time.Second,
				Multiplier: 1.2,
				Jitter:     0.2,
				MaxDelay:   5 * time.Second,
			},
			MinConnectTimeout: 5 * time.Second,
		}),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                60 * time.Second, // safer: 60s or more
			Timeout:             20 * time.Second,
			PermitWithoutStream: false, // only send pings when RPCs are active
		}),
	)
	if err != nil {
		return err
	}
	bw.conn = conn

	bw.client = workerPB.NewWorkerClient(conn)

	info, err := bw.client.GetWorkerInfo(bw.context, &workerPB.WorkerInfoRequest{})
	if err != nil {
		return err
	}

	bw.workerID = info.WorkerId
	bw.acceptingJobs = info.AcceptingJobs
	bw.status = info.Status

	bw.healthBroadcast.Publish(info)

	go bw.healthRoutine()

	return nil
}

func (bw *BaseWorkerConnection) WorkerID() string {
	return bw.workerID
}

func (bw *BaseWorkerConnection) Address() string {
	return bw.address
}

func (bw *BaseWorkerConnection) Stop() error {
	log.Printf("Stopping worker connection for %s at %s", bw.workerID, bw.address)

	bw.mutex.Lock()
	defer bw.mutex.Unlock()

	bw.healthBroadcast.Close()

	if bw.cancel != nil {
		bw.cancel()
		bw.cancel = nil
		bw.context = nil
	}

	if bw.conn != nil {
		err := bw.conn.Close()
		if err != nil {
			return fmt.Errorf("failed to close connection: %w", err)
		}
		bw.conn = nil
	}

	return nil
}

func (bw *BaseWorkerConnection) Wait() {
	if bw.context == nil {
		return
	}

	<-bw.context.Done()
}

func (bw *BaseWorkerConnection) Done() <-chan struct{} {
	if bw.context == nil {
		return nil
	}

	return bw.context.Done()
}

func (bw *BaseWorkerConnection) IsAcceptingJobs() bool {
	return bw.acceptingJobs == workerPB.WorkerAcceptingJobs_accepting
}

func (bw *BaseWorkerConnection) IsHealthy() bool {
	return bw.status == workerPB.WorkerStatus_healthy
}

func (bw *BaseWorkerConnection) GetWorkerInfo() (*workerPB.WorkerInfoResponse, error) {
	if bw.client == nil {
		return nil, fmt.Errorf("WorkerClient is not initialized")
	}

	return bw.client.GetWorkerInfo(bw.context, &workerPB.WorkerInfoRequest{})
}

func (bw *BaseWorkerConnection) healthRoutine() error {
	if bw.client == nil {
		return fmt.Errorf("McpRunnerClient is not initialized")
	}

	stream, err := bw.client.StreamWorkerHealth(context.Background(), &workerPB.WorkerHealthRequest{})
	if err != nil {
		return err
	}

	for {
		resp, err := stream.Recv()
		if err != nil {
			bw.cancel()

			if err == context.Canceled || err == io.EOF {
				return nil
			}

			log.Printf("Error receiving health update: %v\n", err)

			return err
		}

		bw.mutex.Lock()
		bw.acceptingJobs = resp.AcceptingJobs
		bw.status = resp.Status
		bw.mutex.Unlock()

		bw.healthBroadcast.Publish(resp)
	}
}

func (bw *BaseWorkerConnection) HealthBroadcast() *pubsub.Broadcaster[*workerPB.WorkerInfoResponse] {
	return bw.healthBroadcast
}

func (bw *BaseWorkerConnection) Conn() *grpc.ClientConn {
	bw.mutex.Lock()
	defer bw.mutex.Unlock()

	if bw.conn == nil {
		log.Fatalf("Worker connection for %s at %s is not initialized", bw.workerID, bw.address)
	}

	return bw.conn
}

func (bw *BaseWorkerConnection) Context() context.Context {
	bw.mutex.Lock()
	defer bw.mutex.Unlock()

	if bw.context == nil {
		log.Fatalf("Worker connection for %s at %s is not initialized", bw.workerID, bw.address)
	}

	return bw.context
}

func (bw *BaseWorkerConnection) CreateConnection(input *workers.WorkerConnectionInput) (workers.WorkerConnection, error) {
	return nil, fmt.Errorf("CreateConnection is not implemented for BaseWorkerConnection")
}

func (bw *BaseWorkerConnection) RunLauncher(input *launcherPB.LauncherConfig) (*launcherPB.RunLauncherResponse, error) {
	return nil, fmt.Errorf("RunLauncher is not implemented for BaseWorkerConnection")
}
