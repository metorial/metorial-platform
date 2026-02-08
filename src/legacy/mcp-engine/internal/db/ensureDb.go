package db

import (
	"fmt"
	"strings"

	"database/sql"

	_ "github.com/lib/pq"
)

func ensureDatabaseExists(dsn string) error {
	// Extract DB name from DSN
	dbName := ""
	parts := strings.Split(dsn, " ")
	for _, part := range parts {
		if strings.HasPrefix(part, "dbname=") {
			dbName = strings.TrimPrefix(part, "dbname=")
			break
		}
	}
	if dbName == "" {
		return fmt.Errorf("dsn missing dbname")
	}

	// Create a connection string without the dbname to connect to the default db
	defaultDSN := strings.Replace(dsn, "dbname="+dbName, "dbname=postgres", 1)

	// Use database/sql to connect to the default db
	sqlDB, err := sql.Open("postgres", defaultDSN)
	if err != nil {
		return fmt.Errorf("connecting to default db: %w", err)
	}
	defer sqlDB.Close()

	var exists bool
	checkQuery := `SELECT 1 FROM pg_database WHERE datname = $1`
	err = sqlDB.QueryRow(checkQuery, dbName).Scan(&exists)
	if err == sql.ErrNoRows {
		// Create DB
		_, err = sqlDB.Exec(fmt.Sprintf("CREATE DATABASE \"%s\"", dbName))
		if err != nil {
			return fmt.Errorf("creating database %q: %w", dbName, err)
		}
	} else if err != nil {
		return fmt.Errorf("checking database existence: %w", err)
	}

	return nil
}
