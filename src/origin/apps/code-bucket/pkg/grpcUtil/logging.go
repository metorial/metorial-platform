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

func isServerFault(code codes.Code) bool {
	switch code {
	case codes.Unknown, codes.Internal, codes.DataLoss:
		return true
	default:
		return false
	}
}

func LoggingInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	started := time.Now()
	resp, err := handler(ctx, req)
	took := time.Since(started)

	if err == nil {
		log.Printf("[grpc] ok method=%s took=%s", info.FullMethod, took)
		return resp, nil
	}

	code := status.Code(err)
	log.Printf(
		"[grpc] error method=%s code=%s took=%s err=%v",
		info.FullMethod, code, took, err,
	)

	if isServerFault(code) {
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("grpc.method", info.FullMethod)
			scope.SetTag("grpc.code", code.String())
			sentry.CaptureException(err)
		})
	}

	return resp, err
}
