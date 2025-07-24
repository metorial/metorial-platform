package grpc_util

import (
	"context"
	"log"
	"time"

	"github.com/getsentry/sentry-go"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func RecoveryInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (resp any, err error) {
	defer func() {
		r := recover()

		if r != nil {
			sentry.CurrentHub().Recover(r)
			sentry.Flush(time.Second * 5)

			log.Printf("recovered from panic: %v", r)
			err = status.Errorf(codes.Internal, "internal server error")
		}
	}()

	return handler(ctx, req)
}
