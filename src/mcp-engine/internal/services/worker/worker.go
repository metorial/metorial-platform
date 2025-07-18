package worker

import (
	"context"
	"fmt"
	"log"
	"net"
	"slices"
	"sync"
	"time"

	"github.com/getsentry/sentry-go"
	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/pkg/addr"
	grpc_util "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/mcp-engine/pkg/managerUtils"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"
)

type WorkerImpl interface {
	Start(worker *Worker, grpc *grpc.Server) error
	Stop() error
	WorkerId() string
}

type Worker struct {
	WorkerID  string
	Address   string
	StartTime time.Time

	workerType workerPb.WorkerType

	port       int
	grpcServer *grpc.Server

	managerMutex   sync.RWMutex
	managerConns   map[string]*grpc.ClientConn
	managerClients map[string]workerBrokerPb.McpWorkerBrokerClient

	impl WorkerImpl

	health WorkerHealthManager

	context context.Context
	cancel  context.CancelFunc

	mutex sync.Mutex

	workerServer *workerServer

	seenManagers []string
}

func NewWorker(ctx context.Context, workerType workerPb.WorkerType, ownAddress string, managerAddress string, impl WorkerImpl) (*Worker, error) {
	port, err := addr.ExtractPort(ownAddress)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(ctx)

	worker := &Worker{
		port: port,

		workerType: workerType,

		WorkerID:  impl.WorkerId(),
		Address:   ownAddress,
		StartTime: time.Now(),

		health: *newWorkerHealthManager(),

		managerConns:   make(map[string]*grpc.ClientConn),
		managerClients: make(map[string]workerBrokerPb.McpWorkerBrokerClient),

		impl: impl,

		context: ctx,
		cancel:  cancel,

		seenManagers: []string{},
	}

	go worker.start()

	wait := time.NewTimer(5 * time.Second)
	<-wait.C

	err = worker.registerWithManager(managerUtils.GetManagerAddress(managerAddress))
	if err != nil {
		sentry.CaptureException(err)
		log.Fatalf("Failed to register with initial manager: %v", err)
	}

	go worker.connectToNewManagersRoutine()

	return worker, nil
}

func (w *Worker) start() error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", w.port))
	if err != nil {
		sentry.CaptureException(err)
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc_util.NewGrpcServer(fmt.Sprintf("worker.%s", w.workerType.String()))
	w.grpcServer = grpcServer

	w.workerServer = &workerServer{worker: w}
	workerPb.RegisterWorkerServer(w.grpcServer, w.workerServer)

	err = w.impl.Start(w, w.grpcServer)
	if err != nil {
		log.Fatalf("Failed to start worker: %v", err)
	}

	reflection.Register(w.grpcServer)

	log.Printf("Starting worker server at %s", w.Address)

	err = w.grpcServer.Serve(lis)
	if err != nil {
		sentry.CaptureException(err)
		log.Fatalf("Failed to serve: %v", err)
	}

	return nil
}

func (w *Worker) Stop() error {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	log.Printf("Worker server at %s stopped", w.Address)

	if w.grpcServer != nil {
		w.grpcServer.Stop()
		w.grpcServer = nil
	}

	w.managerMutex.Lock()
	defer w.managerMutex.Unlock()

	for _, conn := range w.managerConns {
		err := conn.Close()
		if err != nil {
			sentry.CaptureException(err)
			return err
		}
	}

	if w.impl != nil {
		err := w.impl.Stop()
		if err != nil {
			sentry.CaptureException(err)
			return err
		}
		w.impl = nil
	}

	w.cancel()

	return nil
}

func (w *Worker) registerWithManager(address string) error {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		sentry.CaptureException(err)
		return err
	}

	client := workerBrokerPb.NewMcpWorkerBrokerClient(conn)

	w.managerMutex.Lock()
	defer w.managerMutex.Unlock()

	if _, exists := w.managerClients[address]; exists {
		// log.Printf("Already registered with manager at %s", address)
		return nil
	}

	log.Printf("Registering worker %s with manager at %s", w.WorkerID, address)

	w.managerConns[address] = conn
	w.managerClients[address] = client

	_, err = client.RegisterWorker(context.Background(), &workerBrokerPb.RegisterWorkerRequest{
		WorkerId:   w.WorkerID,
		Address:    w.Address,
		WorkerType: w.workerType,
	})
	if err != nil {
		return err
	}

	log.Printf("Worker %s registered with manager at %s", w.WorkerID, address)

	return nil
}

func (w *Worker) connectToNewManagers() error {
	var managers *workerBrokerPb.ListManagersResponse
	var err error

	w.managerMutex.RLock()

	for _, conn := range w.managerClients {
		managers, err = conn.ListManagers(context.Background(), &workerBrokerPb.ListManagersRequest{})
		if err != nil {
			sentry.CaptureException(err)
		} else {
			break
		}
	}

	w.managerMutex.RUnlock()

	if err != nil {
		return fmt.Errorf("failed to connect to any manager: %w", err)
	}

	w.mutex.Lock()
	defer w.mutex.Unlock()

	for _, manager := range managers.Managers {
		if slices.Contains(w.seenManagers, manager.Id) {
			continue
		}

		w.seenManagers = append(w.seenManagers, manager.Id)

		w.registerWithManager(managerUtils.GetManagerAddress(manager.Address))
	}

	return nil
}

func (w *Worker) connectToNewManagersRoutine() {
	time.Sleep(time.Second) // Wait for server to be ready

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	err := w.connectToNewManagers()
	if err != nil {
		log.Printf("Failed to connect to new managers: %v", err)
	}

	for {
		select {
		case <-w.context.Done():
			return
		case <-ticker.C:
			err := w.connectToNewManagers()
			if err != nil {
				log.Printf("Failed to connect to new managers: %v", err)
			}
		}
	}
}

func (w *Worker) Health() WorkerHealth {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	return w.health.GetHealth()
}

func (w *Worker) WorkerServer() *workerServer {
	return w.workerServer
}

func (w *Worker) Done() <-chan struct{} {
	return w.context.Done()
}

func (w *Worker) Wait() {
	<-w.context.Done()
	log.Printf("Worker %s stopped", w.WorkerID)
}
