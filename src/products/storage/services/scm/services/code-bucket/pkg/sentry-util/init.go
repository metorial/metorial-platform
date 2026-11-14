package sentryUtil

import (
	"log"
	"os"

	"github.com/getsentry/sentry-go"
)

func getSentryDsn() *string {
	sentryDsn := os.Getenv("SENTRY_DSN")
	if sentryDsn == "" {
		return nil
	}

	return &sentryDsn
}

func InitSentryIfNeeded() {
	sentryDsn := getSentryDsn()
	if sentryDsn == nil {
		return
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:            *sentryDsn,
		SendDefaultPII: true,
	})
	if err != nil {
		log.Fatalf("sentry.Init: %s", err)
	}
}

func ShutdownSentry() {
	sentry.Flush(2 * 1000)

	sentry.Recover() // Ensure any pending events are sent
	log.Println("Sentry shutdown complete")
}
