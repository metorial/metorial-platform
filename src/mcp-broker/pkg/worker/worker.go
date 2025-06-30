package worker

import (
	"context"
	"log"
	"slices"
	"sync"
	"time"

	workerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/managerForWorker"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Worker struct {
	WorkerID string
	Address  string

	conn   *grpc.ClientConn
	client workerPb.McpManagerForWorkerClient

	done      chan struct{}
	closeOnce sync.Once

	mutex sync.Mutex

	seenManagers []string
}

func NewWorker(workerID, ownAddress string, managerAddress string) (*Worker, error) {
	conn, err := grpc.NewClient(managerAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := workerPb.NewMcpManagerForWorkerClient(conn)

	worker := &Worker{
		WorkerID: workerID,
		Address:  ownAddress,

		conn:   conn,
		client: client,

		done:         make(chan struct{}),
		seenManagers: []string{},
	}

	go worker.connectToNewManagersRoutine()

	return worker, nil
}

func (w *Worker) Stop() error {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	if w.conn != nil {
		if err := w.conn.Close(); err != nil {
			return err
		}
		w.conn = nil
	}

	w.closeOnce.Do(func() {
		close(w.done)
	})

	return nil
}

func (w *Worker) registerWithManager(address string) error {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return err
	}

	defer conn.Close()

	client := workerPb.NewMcpManagerForWorkerClient(conn)

	_, err = client.RegisterWorker(context.Background(), &workerPb.RegisterWorkerRequest{
		WorkerId:   w.WorkerID,
		Address:    w.Address,
		WorkerType: workerPb.WorkerType_WORKER_TYPE_RUNNER,
	})
	if err != nil {
		return err
	}

	log.Printf("Worker %s registered with manager at %s", w.WorkerID, address)

	return nil
}

func (w *Worker) connectToNewManagers() error {
	if w.client == nil {
		return nil
	}

	managers, err := w.client.ListManagers(context.Background(), &workerPb.ListManagersRequest{})
	if err != nil {
		return err
	}

	w.mutex.Lock()
	defer w.mutex.Unlock()

	for _, manager := range managers.Managers {
		if slices.Contains(w.seenManagers, manager.Id) {
			continue
		}

		w.seenManagers = append(w.seenManagers, manager.Id)

		w.registerWithManager(manager.Address)
	}

	return nil
}

func (w *Worker) connectToNewManagersRoutine() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	if err := w.connectToNewManagers(); err != nil {
		log.Printf("Failed to connect to new managers: %v", err)
	}

	for {
		select {
		case <-w.done:
			return
		case <-ticker.C:
			if err := w.connectToNewManagers(); err != nil {
				log.Printf("Failed to connect to new managers: %v", err)
			}
		}
	}
}
