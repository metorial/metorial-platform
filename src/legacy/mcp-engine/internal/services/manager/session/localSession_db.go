package session

import (
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

func (s *LocalSession) CreateMcpError(
	run *db.SessionRun,
	err *mcpPb.McpError,
) {
	go s.db.CreateError(db.NewErrorFromMcp(
		s.dbSession,
		run,
		err,
	))
}

func (s *LocalSession) CreateStructuredError(
	errorCode string,
	errorMessage string,
	metadata map[string]string,
) {
	go s.db.CreateError(db.NewErrorStructuredError(
		s.dbSession,
		errorCode,
		errorMessage,
		metadata,
	))
}

func (s *LocalSession) CreateStructuredErrorWithRun(
	run *db.SessionRun,
	errorCode string,
	errorMessage string,
	metadata map[string]string,
) {
	go s.db.CreateError(db.NewErrorStructuredErrorWithRun(
		s.dbSession,
		run,
		errorCode,
		errorMessage,
		metadata,
	))
}

func (s *LocalSession) PersistMessagesSync(
	run *db.SessionRun,
	sender db.SessionMessageSender,
	mcpMessages []*mcp.MCPMessage,
) {
	for _, message := range mcpMessages {
		s.db.CreateMessage(
			db.NewMessage(
				s.dbSession,
				run,
				int(s.counter.Add(1)),
				sender,
				message,
			),
		)
	}
}

func (s *LocalSession) PersistMessages(
	run *db.SessionRun,
	sender db.SessionMessageSender,
	mcpMessages []*mcp.MCPMessage,
) {
	go s.PersistMessagesSync(run, sender, mcpMessages)
}
