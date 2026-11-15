package api

import (
	"errors"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/builds"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/bundles"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/functions"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

// rpcError turns domain errors into the spec's declared errors. Anything unknown is returned as
// is, which ldrpc reports as a 500 without leaking details.
func rpcError(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := ldrpc.AsError(err); ok {
		return err
	}

	var (
		notAllowed    *access.ObjectNotAllowedError
		bundleInvalid *bundles.InvalidError
		notReady      *functions.NotReadyError
		unauthorized  *functions.UnauthorizedError
		fnInvalid     *functions.ValidationError
		buildInvalid  *builds.ValidationError
	)

	switch {
	case errors.As(err, &notAllowed):
		return cm.ErrObjectNotAllowed(notAllowed.Bucket).WithCause(err)
	case errors.As(err, &bundleInvalid):
		return cm.ErrBundleInvalid(bundleInvalid.Reason).WithCause(err)
	case errors.As(err, &notReady):
		return cm.ErrFunctionNotReady(&notReady.Reason).WithCause(err)
	case errors.As(err, &unauthorized):
		return cm.ErrInvocationUnauthorized(unauthorized.Reason).WithCause(err)
	case errors.Is(err, functions.ErrNotMaterialized):
		return cm.ErrFunctionNotMaterialized().WithCause(err)
	case errors.Is(err, functions.ErrUnavailable):
		return cm.ErrFunctionUnavailable().WithCause(err)
	case errors.Is(err, functions.ErrCapacity):
		return cm.ErrClusterCapacity().WithCause(err)
	case errors.Is(err, builds.ErrNotFound):
		return cm.ErrBuildNotFound().WithCause(err)
	case errors.As(err, &fnInvalid):
		issues := make(ldrpc.ValidationErrors, len(fnInvalid.Issues))
		for i, issue := range fnInvalid.Issues {
			issues[i] = ldrpc.ValidationIssue{Code: issue.Code, Message: issue.Message, Path: issue.Path}
		}
		return issues
	case errors.As(err, &buildInvalid):
		issues := make(ldrpc.ValidationErrors, len(buildInvalid.Issues))
		for i, issue := range buildInvalid.Issues {
			issues[i] = ldrpc.ValidationIssue{Code: issue.Code, Message: issue.Message, Path: issue.Path}
		}
		return issues
	default:
		return err
	}
}
