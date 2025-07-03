package base_worker

import (
	"context"
	"fmt"
	"log"
	"sync"

	workerPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
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

	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
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
		fmt.Println("Received health response:", resp, "Error:", err)
		if err != nil {
			return err
		}

		if resp == nil {
			continue
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
		return nil
	}

	return bw.conn
}
