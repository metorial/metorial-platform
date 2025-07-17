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
	"github.com/metorial/metorial/mcp-engine/pkg/addr"
	grpc_util "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type Manager struct {
	Address       string
	Port          int
	state         *state.StateManager
	grpcServer    *grpc.Server
	workerServer  *workerBrokerServer
	workers       *workers.WorkerManager
	sessionServer *session.SessionServer
}

func NewManager(db *db.DB, etcdEndpoints []string, address string) (*Manager, error) {
	port, err := addr.ExtractPort(address)
	if err != nil {
		return nil, err
	}

	sm, err := state.NewStateManager(etcdEndpoints, address)
	if err != nil {
		return nil, err
	}

	workers := workers.NewWorkerManager()

	return &Manager{
		state:         sm,
		Port:          port,
		Address:       address,
		workers:       workers,
		workerServer:  &workerBrokerServer{state: sm, workerManager: workers},
		sessionServer: session.NewSessionServer(db, sm, workers),
	}, nil
}

func (m *Manager) Start() error {
	address := ":" + strconv.Itoa(m.Port)

	lis, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}

	s := grpc_util.NewGrpcServer("manager")
	m.grpcServer = s

	workerBrokerPb.RegisterMcpWorkerBrokerServer(s, m.workerServer)
	managerPb.RegisterMcpManagerServer(s, m.sessionServer)

	reflection.Register(s)

	log.Printf("Starting manager server at %s", address)

	if err := m.state.Start(); err != nil {
		return err
	}

	if err := s.Serve(lis); err != nil {
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
