package session

import (
	"database/sql"
	"log"
	"time"

	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/client"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
)

func shouldDiscoverServer(server *db.Server) bool {
	if server == nil {
		log.Printf("Server is nil, skipping discovery check")
		return false
	}

	if server.LastDiscoveryAt.Valid &&
		time.Since(server.LastDiscoveryAt.Time) < time.Hour*24 {
		log.Printf("Server for server %s was discovered recently, skipping discovery", server.ID)
		return false
	}

	if server.DiscoveryErroredAt.Valid &&
		time.Since(server.DiscoveryErroredAt.Time) < time.Hour*2 {
		log.Printf("Server discovery for server %s is still in error state, skipping discovery", server.ID)
		return false
	}

	return true
}

func discoverServer(db_ *db.DB, server *db.Server, connection workers.WorkerConnection) error {
	if !shouldDiscoverServer(server) {
		return nil
	}

	log.Printf("Discovering server for server %s with connection %s", server.ID, connection.ConnectionID())

	err := client.WithClient(connection, func(c *client.Client) error {
		log.Printf("Discovering server and applying updates for server %s", server.ID)

		c.DiscoverServerAndApplyUpdates(server)
		server.LastDiscoveryAt = db.NullTimeNow()
		server.DiscoveryCount++
		server.DiscoveryErroredAt = sql.NullTime{}
		return db_.SaveServer(server)
	})

	if err != nil {
		log.Printf("Failed to discover server for server %s: %v", server.ID, err)

		server.DiscoveryErroredAt = db.NullTimeNow()
		server.DiscoveryCount++
		db_.SaveServer(server)
	}

	return err
}

func discoverServerWithEphemeralConnection(db_ *db.DB, server *db.Server, connection workers.WorkerConnection) error {
	if !shouldDiscoverServer(server) {
		return nil
	}

	log.Printf("Creating ephemeral connection for server %s with connection %s", server.ID, connection.ConnectionID())

	err := withEphemeralConnectionForAutoDiscovery(connection, func(conn workers.WorkerConnection) error {
		discoverServer(db_, server, conn)
		return nil
	})

	if err != nil {
		log.Printf("Failed to create ephemeral connection for server %s: %v", server.ID, err)

		server.DiscoveryErroredAt = db.NullTimeNow()
		server.DiscoveryCount++
		db_.SaveServer(server)
	}

	return err
}

func withEphemeralConnectionForAutoDiscovery(originalConnection workers.WorkerConnection, fn func(conn workers.WorkerConnection) error) error {
	connection, err := originalConnection.Clone()
	if err != nil {
		return err
	}

	defer connection.Close()
	connection.Start(false)

	return fn(connection)
}
