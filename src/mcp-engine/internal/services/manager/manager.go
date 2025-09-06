package manager

import (
	"context"
	"log"
	"net"
	"strconv"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/session"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	launcherWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/launcher-worker"
	remoteWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/remote-worker"
	runnerWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/runner-worker"
	grpc_util "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/modules/addr"
	"google.golang.org/grpc/reflection"
)

type Manager struct {
	ManagerAddress      string
	WorkerBrokerAddress string
	ManagerPort         int
	WorkerBrokerPort    int

	state         *state.StateManager
	workerServer  *workerBrokerServer
	workers       *workers.WorkerManager
	sessionServer *session.SessionServer
}

type StandaloneWorker struct {
	Type    workers.WorkerType
	Address string
}

func NewManager(db *db.DB, etcdEndpoints []string, mangerAddress, workerBrokerAddress string, standaloneWorkers []StandaloneWorker) (*Manager, error) {
	if workerBrokerAddress == "" {
		workerBrokerAddress = mangerAddress
	}

	managerPort, err := addr.ExtractPort(mangerAddress)
	if err != nil {
		return nil, err
	}
	workerBrokerPort, err := addr.ExtractPort(workerBrokerAddress)
	if err != nil {
		return nil, err
	}

	sm, err := state.NewStateManager(etcdEndpoints, mangerAddress, workerBrokerAddress)
	if err != nil {
		return nil, err
	}

	workersManager := workers.NewWorkerManager()

	for _, sw := range standaloneWorkers {
		var workerInstance workers.Worker
		id := uuid.NewString()

		switch sw.Type {
		case workers.WorkerTypeContainer:
			workerInstance = runnerWorker.NewRunnerWorker(context.Background(), workersManager, id, sw.Address, true)
		case workers.WorkerTypeLauncher:
			workerInstance = launcherWorker.NewLauncherWorker(context.Background(), workersManager, id, sw.Address, true)
		case workers.WorkerTypeRemote:
			workerInstance = remoteWorker.NewRemoteWorker(context.Background(), workersManager, id, sw.Address, true)
		}

		log.Printf("Registering standalone worker %s of type %s at address %s", workerInstance.WorkerID(), sw.Type, sw.Address)

		if err := workersManager.RegisterWorker(workerInstance); err != nil {
			log.Panicf("failed to register standalone worker %s at %s: %v", workerInstance.WorkerID(), workerInstance.Address(), err)
		}
	}

	return &Manager{
		state: sm,

		ManagerAddress:      mangerAddress,
		WorkerBrokerAddress: workerBrokerAddress,
		ManagerPort:         managerPort,
		WorkerBrokerPort:    workerBrokerPort,

		workers:       workersManager,
		workerServer:  &workerBrokerServer{state: sm, workerManager: workersManager},
		sessionServer: session.NewSessionServer(db, sm, workersManager),
	}, nil
}

func (m *Manager) Start() error {
	managerAddress := ":" + strconv.Itoa(m.ManagerPort)
	managerAndWorkerBrokerSamePort := m.WorkerBrokerPort == m.ManagerPort

	lis, err := net.Listen("tcp", managerAddress)
	if err != nil {
		return err
	}

	managerServer := grpc_util.NewGrpcServer("manager")
	managerPb.RegisterMcpManagerServer(managerServer, m.sessionServer)
	if managerAndWorkerBrokerSamePort {
		workerBrokerPb.RegisterMcpWorkerBrokerServer(managerServer, m.workerServer)
	}
	reflection.Register(managerServer)

	log.Printf("Starting manager server at %s", managerAddress)

	go func() {
		if err := managerServer.Serve(lis); err != nil {
			log.Printf("Manager server at %s exited with error: %v", managerAddress, err)
		}
	}()

	if !managerAndWorkerBrokerSamePort {
		workerBrokerAddress := ":" + strconv.Itoa(m.WorkerBrokerPort)

		lis, err := net.Listen("tcp", workerBrokerAddress)
		if err != nil {
			return err
		}

		workerBrokerServer := grpc_util.NewGrpcServer("worker_broker")
		workerBrokerPb.RegisterMcpWorkerBrokerServer(workerBrokerServer, m.workerServer)
		reflection.Register(workerBrokerServer)

		log.Printf("Starting worker broker server at %s", workerBrokerAddress)

		go func() {
			if err := workerBrokerServer.Serve(lis); err != nil {
				log.Printf("Worker broker server at %s exited with error: %v", workerBrokerAddress, err)
			}
		}()
	}

	if err := m.state.Start(); err != nil {
		return err
	}

	return nil
}

func (m *Manager) Stop() error {
	if m.state == nil {
		return nil
	}

	if err := m.sessionServer.Stop(); err != nil {
		return err
	}

	if err := m.state.Stop(); err != nil {
		return err
	}

	m.state = nil
	return nil
}

func (m *Manager) GetManagerID() string {
	if m.state == nil {
		return ""
	}

	return m.state.ManagerID
}

func (m *Manager) PrintStatus() {
	if m.state == nil {
		return
	}

	state.PrintStatus(m.state)
}
