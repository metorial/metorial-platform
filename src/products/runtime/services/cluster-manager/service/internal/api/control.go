package api

import (
	"context"

	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/builds"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/bundles"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/functions"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

// MaxBodyBytes bounds control requests: a payload of MAX_PAYLOAD_BYTES may double when escaped as
// a JSON string, plus room for tokens and the envelope.
const MaxBodyBytes = 2*functions.MaxPayloadBytes + 1<<20

type Control struct {
	Functions *functions.Manager
	Builds    *builds.Manager
	Bundles   *bundles.Service
}

var _ cm.Service = (*Control)(nil)

func (c *Control) BundleImport(ctx context.Context, in *cm.BundleImportInput) (*cm.BundleRef, error) {
	ref, err := c.Bundles.Import(ctx, in.VersionID, in.Source.Bucket, in.Source.Key)
	if err != nil {
		return nil, rpcError(err)
	}
	return &cm.BundleRef{Bucket: ref.Bucket, Key: ref.Key, SHA256: ref.SHA256, SizeBytes: ref.SizeBytes}, nil
}

func (c *Control) FunctionEnsure(ctx context.Context, in *cm.FunctionEnsureInput) (*cm.FunctionEnsureOutput, error) {
	req := &functions.EnsureRequest{
		Mode: functions.Mode(in.Mode),
		Spec: functions.Spec{
			VersionID:      in.VersionID,
			FunctionID:     in.FunctionID,
			TenantID:       in.TenantID,
			RuntimeID:      in.Runtime.Identifier,
			RuntimeVersion: in.Runtime.Version,
			Entrypoint:     functions.Entrypoint{Path: in.Entrypoint.Path, Export: in.Entrypoint.Export, Kind: string(in.Entrypoint.Kind)},
			Bundle:         functions.BundleRef{Bucket: in.Bundle.Bucket, Key: in.Bundle.Key, SHA256: in.Bundle.SHA256, SizeBytes: in.Bundle.SizeBytes},
			Env:            in.Env,
			MemoryMB:       int(in.MemoryMB),
			TimeoutSeconds: int(in.TimeoutSeconds),
			Concurrency:    functions.Concurrency(in.Concurrency),
		},
	}
	if in.Sandbox != nil {
		req.Sandbox = string(*in.Sandbox)
	}

	result, err := c.Functions.Ensure(ctx, req)
	if err != nil {
		return nil, rpcError(err)
	}
	out := &cm.FunctionEnsureOutput{State: cm.FunctionEnsureOutputState(result.State)}
	if result.Name != "" {
		out.Name = ptr.To(result.Name)
	}
	return out, nil
}

func (c *Control) FunctionDelete(ctx context.Context, in *cm.FunctionDeleteInput) (*ldrpc.Void, error) {
	return nil, rpcError(c.Functions.Delete(ctx, in.VersionID))
}

func (c *Control) FunctionList(ctx context.Context, in *cm.FunctionListInput) (*cm.FunctionListOutput, error) {
	items, err := c.Functions.List(in.FunctionID)
	if err != nil {
		return nil, rpcError(err)
	}

	out := &cm.FunctionListOutput{Items: make([]cm.MaterializedFunction, 0, len(items))}
	for _, item := range items {
		state := cm.FunctionStateMaterialized
		if item.Warm {
			state = cm.FunctionStateWarm
		}
		out.Items = append(out.Items, cm.MaterializedFunction{
			VersionID:     item.VersionID,
			Name:          item.Name,
			State:         state,
			ReadyPods:     int64(item.ReadyPods),
			Reason:        cm.MaterializedFunctionReason(item.Reason),
			LastInvokedAt: item.LastInvokedAt,
			CreatedAt:     item.CreatedAt,
		})
	}
	return out, nil
}

func (c *Control) FunctionInvoke(ctx context.Context, in *cm.InvokeInput) (*cm.InvokeOutput, error) {
	result, err := c.Functions.Invoke(ctx, &functions.InvokeInput{
		VersionID:       in.VersionID,
		PayloadJSON:     in.PayloadJSON,
		InvocationToken: in.InvocationToken,
		EgressGrant:     in.EgressGrant,
		DeadlineMs:      in.DeadlineMs,
	})
	if err != nil {
		return nil, rpcError(err)
	}

	out := &cm.InvokeOutput{
		Payload:       result.Payload,
		Logs:          make([]cm.InvokeLogLine, len(result.Logs)),
		LogsTruncated: result.LogsTruncated,
		ComputeTimeMs: result.ComputeTimeMs,
		BootError:     result.BootError,
	}
	for i, line := range result.Logs {
		out.Logs[i] = cm.InvokeLogLine{Ts: line.Ts, Stream: cm.InvokeLogLineStream(line.Stream), Line: line.Line}
	}
	return out, nil
}

func (c *Control) BuildStart(ctx context.Context, in *cm.BuildStartInput) (*cm.Build, error) {
	req := &builds.StartRequest{
		RunID:          in.RunID,
		Image:          string(in.Image),
		Script:         in.Script,
		Env:            in.Env,
		TimeoutSeconds: int(in.TimeoutSeconds),
		EgressGrant:    in.EgressGrant,
	}
	for _, d := range in.Downloads {
		req.Downloads = append(req.Downloads, builds.Download{ArtifactID: d.ArtifactID, Bucket: d.Bucket, Key: d.Key})
	}
	for _, u := range in.Uploads {
		req.Uploads = append(req.Uploads, builds.Upload{StepID: u.StepID, Bucket: u.Bucket, Key: u.Key})
	}
	if in.Sandbox != nil {
		req.Sandbox = string(*in.Sandbox)
	}

	build, err := c.Builds.Start(ctx, req)
	if err != nil {
		return nil, rpcError(err)
	}
	return buildOutput(build), nil
}

func (c *Control) BuildGet(ctx context.Context, in *cm.BuildGetInput) (*cm.Build, error) {
	build, err := c.Builds.Get(ctx, in.RunID)
	if err != nil {
		return nil, rpcError(err)
	}
	return buildOutput(build), nil
}

func (c *Control) BuildLogs(ctx context.Context, in *cm.BuildLogsInput) (*cm.BuildLogsOutput, error) {
	limit := 0
	if in.Limit != nil {
		limit = int(*in.Limit)
	}
	lines, next, err := c.Builds.Logs(ctx, in.RunID, ptr.Deref(in.Cursor, ""), limit)
	if err != nil {
		return nil, rpcError(err)
	}

	out := &cm.BuildLogsOutput{Lines: make([]cm.BuildLogLine, len(lines)), NextCursor: next}
	for i, line := range lines {
		out.Lines[i] = cm.BuildLogLine{Ts: line.TS, Line: line.Line}
	}
	return out, nil
}

func (c *Control) BuildDelete(ctx context.Context, in *cm.BuildDeleteInput) (*ldrpc.Void, error) {
	return nil, rpcError(c.Builds.Delete(ctx, in.RunID))
}

func buildOutput(b *builds.Build) *cm.Build {
	out := &cm.Build{
		RunID:         b.RunID,
		Name:          b.Name,
		Status:        cm.BuildStatus(b.Status),
		FailureReason: b.FailureReason,
		UploadedSteps: b.UploadedSteps,
		StartedAt:     b.StartedAt,
		FinishedAt:    b.FinishedAt,
	}
	if b.ExitCode != nil {
		out.ExitCode = ptr.To(int64(*b.ExitCode))
	}
	return out
}
