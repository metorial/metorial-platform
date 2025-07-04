package db

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DB struct {
	dsn string
	db  *gorm.DB
}

func NewDB(dsn string) (*DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	res := &DB{
		dsn: dsn,
		db:  db,
	}
	err = res.autoMigrate()
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (d *DB) autoMigrate() error {
	return d.db.AutoMigrate(&Session{}, &SessionConnection{}, &SessionError{}, &SessionEvent{}, &SessionMessage{})
}
