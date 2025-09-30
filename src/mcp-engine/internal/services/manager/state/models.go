package state

type Manager struct {
	ID         string `json:"id"`
	LastPingAt int64  `json:"lastPingAt"`
	JoinedAt   int64  `json:"joinedAt"`

	ManagerAddress      string `json:"managerAddress"`
	WorkerBrokerAddress string `json:"workerBrokerAddress"`
}

type Session struct {
	ID          string `json:"id"`
	ManagerID   string `json:"managerId"`
	LastPingAt  int64  `json:"lastPingAt"`
	CreatedAt   int64  `json:"createdAt"`
	SessionUuid string `json:"sessionUuid"`
}
