package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	mcpTypes "github.com/mark3labs/mcp-go/mcp"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/datastructures"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	"gorm.io/gorm"
)

type Server struct {
	ID         string `gorm:"primaryKey;type:uuid;not null"`
	Identifier string `gorm:"uniqueIndex;not null"`

	Type SessionType `gorm:"type:smallint;not null"`

	McpServer *mcp.MCPServer `gorm:"type:jsonb;serializer:json"`

	Tools             []mcpTypes.Tool             `gorm:"type:jsonb;serializer:json;not null"`
	Prompts           []mcpTypes.Prompt           `gorm:"type:jsonb;serializer:json;not null"`
	Resources         []mcpTypes.Resource         `gorm:"type:jsonb;serializer:json;not null"`
	ResourceTemplates []mcpTypes.ResourceTemplate `gorm:"type:jsonb;serializer:json;not null"`

	Metadata map[string]string `gorm:"type:jsonb;serializer:json;not null"`

	CreatedAt       time.Time    `gorm:"not null"`
	UpdatedAt       time.Time    `gorm:"not null"`
	LastDiscoveryAt sql.NullTime `gorm:"type:timestamp;default:NULL"`
}

func NewServer(id string, identifier string, mcpServer *mcp.MCPServer, tools []mcpTypes.Tool, prompts []mcpTypes.Prompt, resources []mcpTypes.Resource, resourceTemplates []mcpTypes.ResourceTemplate) *Server {
	return &Server{
		ID:         id,
		Identifier: identifier,

		McpServer: mcpServer,

		Tools:             tools,
		Prompts:           prompts,
		Resources:         resources,
		ResourceTemplates: resourceTemplates,

		Metadata: make(map[string]string),

		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func (d *DB) CreateServer(server *Server) (*Server, error) {
	server.CreatedAt = time.Now()
	server.UpdatedAt = server.CreatedAt

	if server.Metadata == nil {
		server.Metadata = make(map[string]string)
	}

	return server, d.db.Create(server).Error
}

func (d *DB) SaveServer(server *Server) error {
	server.UpdatedAt = time.Now()

	if server.Metadata == nil {
		server.Metadata = make(map[string]string)
	}

	return d.db.Save(server).Error
}

func (s *Server) ToPb() (*managerPb.EngineServer, error) {
	var serverPart *mcpPb.McpParticipant
	if s.McpServer != nil {
		var err error
		serverPart, err = s.McpServer.ToPbParticipant()
		if err != nil {
			return nil, err
		}
	}

	return &managerPb.EngineServer{
		Id:         s.ID,
		Identifier: s.Identifier,

		McpServer: serverPart,

		Tools: util.Map(s.Tools, func(tool mcpTypes.Tool) *mcpPb.McpTool {
			return mcp.ToolToPb(&tool)
		}),

		Prompts: util.Map(s.Prompts, func(prompt mcpTypes.Prompt) *mcpPb.McpPrompt {
			return mcp.PromptToPb(&prompt)
		}),

		Resources: util.Map(s.Resources, func(resource mcpTypes.Resource) *mcpPb.McpResource {
			return mcp.ResourceToPb(&resource)
		}),

		ResourceTemplates: util.Map(s.ResourceTemplates, func(resourceTemplate mcpTypes.ResourceTemplate) *mcpPb.McpResourceTemplate {
			return mcp.ResourceTemplateToPb(&resourceTemplate)
		}),

		Metadata: s.Metadata,

		CreatedAt: s.CreatedAt.UnixMilli(),
		UpdatedAt: s.UpdatedAt.UnixMilli(),
		LastDiscoveryAt: func() *int64 {
			if s.LastDiscoveryAt.Valid {
				timestamp := s.LastDiscoveryAt.Time.UnixMilli()
				return &timestamp
			}
			return nil
		}(),
	}, nil
}

func (d *DB) ListServers(pag *managerPb.ListPagination) ([]Server, error) {
	query := d.db.Model(&Server{})
	return listWithPagination[Server](query, pag)
}

func (d *DB) GetServerById(id string) (*Server, error) {
	var server Server
	err := d.db.Model(&Server{}).Where("id = ?", id).First(&server).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &server, nil
}

var recentlySeenServer = datastructures.NewTransientMap[string, Server](time.Minute * 5)

func (d *DB) EnsureServerByIdentifier(identifier string) (*Server, error) {
	if server, exists := recentlySeenServer.Get(identifier); exists {
		return &server, nil
	}

	var server *Server
	err := d.db.Model(&Server{}).Where("identifier = ?", identifier).First(server).Error
	if err == gorm.ErrRecordNotFound {
		server = NewServer(
			util.Must(uuid.NewV7()).String(),
			identifier,
			nil,
			[]mcpTypes.Tool{},
			[]mcpTypes.Prompt{},
			[]mcpTypes.Resource{},
			[]mcpTypes.ResourceTemplate{},
		)
		server, err := d.CreateServer(server)

		if err == nil {
			return server, nil
		}

		// Ignore duplicate error, as it might happen if multiple
		// instances try to create the same server
		if err != gorm.ErrDuplicatedKey {
			return nil, err
		}

		// Try to get the server again after the duplicate error
		err = d.db.Model(&Server{}).Where("identifier = ?", identifier).First(&server).Error
		if err != nil {
			return nil, err
		}

		return server, nil
	}

	if err != nil {
		return nil, err
	}

	return server, nil
}
