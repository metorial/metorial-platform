package manager

import (
	"log"
	"net"
	"strconv"

	managerForWorkerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/managerForWorker"
	"github.com/metorial/metorial/mcp-broker/pkg/addr"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type Manager struct {
	Address      string
	Port         int
	state        *state.StateManager
	grpcServer   *grpc.Server
	workerServer *managerForWorkerServer
	workers      *workers.WorkerManager
}

func NewManager(etcdEndpoints []string, address string) (*Manager, error) {
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
		state:        sm,
		Port:         port,
		Address:      address,
		workers:      workers,
		workerServer: &managerForWorkerServer{state: sm, workers: workers},
	}, nil
}

func (m *Manager) Start() error {
	address := ":" + strconv.Itoa(m.Port)

	lis, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}

	s := grpc.NewServer()
	m.grpcServer = s

	managerForWorkerPb.RegisterMcpManagerForWorkerServer(s, m.workerServer)

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
