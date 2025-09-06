package manager

import (
	"log"
	"net"
	"strconv"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/session"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
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

func NewManager(db *db.DB, etcdEndpoints []string, mangerAddress, workerBrokerAddress string) (*Manager, error) {
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

	workers := workers.NewWorkerManager()

	return &Manager{
		state: sm,

		ManagerAddress:      mangerAddress,
		WorkerBrokerAddress: workerBrokerAddress,
		ManagerPort:         managerPort,
		WorkerBrokerPort:    workerBrokerPort,

		workers:       workers,
		workerServer:  &workerBrokerServer{state: sm, workerManager: workers},
		sessionServer: session.NewSessionServer(db, sm, workers),
	}, nil
}

func (m *Manager) Start() error {
	managerAddress := ":" + strconv.Itoa(m.ManagerPort)

	lis, err := net.Listen("tcp", managerAddress)
	if err != nil {
		return err
	}

	managerServer := grpc_util.NewGrpcServer("manager")
	managerPb.RegisterMcpManagerServer(managerServer, m.sessionServer)
	if m.WorkerBrokerPort == m.ManagerPort {
		workerBrokerPb.RegisterMcpWorkerBrokerServer(managerServer, m.workerServer)
	}
	reflection.Register(managerServer)

	log.Printf("Starting manager server at %s", managerAddress)

	if err := managerServer.Serve(lis); err != nil {
		return err
	}

	if m.WorkerBrokerPort != m.ManagerPort {
		workerBrokerAddress := ":" + strconv.Itoa(m.WorkerBrokerPort)

		lis, err := net.Listen("tcp", workerBrokerAddress)
		if err != nil {
			return err
		}

		workerBrokerServer := grpc_util.NewGrpcServer("worker_broker")
		workerBrokerPb.RegisterMcpWorkerBrokerServer(workerBrokerServer, m.workerServer)
		reflection.Register(workerBrokerServer)

		log.Printf("Starting worker broker server at %s", workerBrokerAddress)

		if err := workerBrokerServer.Serve(lis); err != nil {
			return err
		}
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
