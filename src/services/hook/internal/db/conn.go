package db

import (
	"slices"

	"github.com/metorial/metorial/services/hook/gen/hook"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DB struct {
	dsn string
	db  *gorm.DB
}

func NewDB(dsn string) (*DB, error) {
	err := ensureDatabaseExists(dsn)
	if err != nil {
		return nil, err
	}

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

	go res.deleteOldEventsRoutine()

	return res, nil
}

func (d *DB) autoMigrate() error {
	return d.db.AutoMigrate(
		&EventDeliveryAttempt{},
		&EventDestination{},
		&EventDeliveryIntent{},
		&Event{},
	)
}

func listWithPagination[T any](query *gorm.DB, pag *hook.ListPagination) ([]T, error) {
	mustReverse := false

	if pag != nil {
		if pag.Limit > 0 {
			query = query.Limit(int(pag.Limit))
		}

		if pag.AfterId != "" {
			query = query.Where("id < ?", pag.AfterId)

			switch pag.Order {
			case hook.ListPaginationOrder_list_cursor_order_asc:
				query = query.Order("id ASC")
			case hook.ListPaginationOrder_list_cursor_order_desc:
				query = query.Order("id DESC")
			}
		} else if pag.BeforeId != "" {
			query = query.Where("id > ?", pag.BeforeId)

			switch pag.Order {
			case hook.ListPaginationOrder_list_cursor_order_asc:
				query = query.Order("id DESC")
			case hook.ListPaginationOrder_list_cursor_order_desc:
				query = query.Order("id ASC")
			}

			mustReverse = true
		} else {
			switch pag.Order {
			case hook.ListPaginationOrder_list_cursor_order_asc:
				query = query.Order("id ASC")
			case hook.ListPaginationOrder_list_cursor_order_desc:
				query = query.Order("id DESC")
			}
		}
	} else {
		query = query.Order("id DESC")
	}

	out := make([]T, 0)

	err := query.Find(&out).Error

	if err != nil {
		return nil, err
	}

	if mustReverse {
		slices.Reverse(out)
	}

	return out, nil
}
