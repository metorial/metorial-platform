package worker

import (
	"context"

	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"google.golang.org/grpc"
)

type workerServer struct {
	workerPb.UnimplementedWorkerServer

	worker *Worker
}

func (r *workerServer) GetWorkerInfo(ctx context.Context, req *workerPb.WorkerInfoRequest) (*workerPb.WorkerInfoResponse, error) {
	health := r.getWorkerInfo()

	return health, nil
}

func (r *workerServer) StreamWorkerHealth(req *workerPb.WorkerHealthRequest, stream grpc.ServerStreamingServer[workerPb.WorkerInfoResponse]) error {
	err := stream.Send(r.getWorkerInfo())
	if err != nil {
		return err
	}

	for {
		select {
		case <-r.worker.health.HealthChan:
			if err := stream.Send(r.getWorkerInfo()); err != nil {
				return err
			}
		case <-stream.Context().Done():
			// Stream has been closed by the client
			return nil
		}
	}
}

func (r *workerServer) getWorkerInfo() *workerPb.WorkerInfoResponse {
	res := &workerPb.WorkerInfoResponse{
		WorkerId:  r.worker.WorkerID,
		StartTime: r.worker.StartTime.Unix(),

		WorkerType: r.worker.workerType,

		Status:        workerPb.WorkerStatus_healthy,
		AcceptingJobs: workerPb.WorkerAcceptingJobs_accepting,
	}

	if !r.worker.health.Health.Healthy {
		res.Status = workerPb.WorkerStatus_unhealthy
	}

	if !r.worker.health.Health.AcceptingJobs {
		res.AcceptingJobs = workerPb.WorkerAcceptingJobs_not_accepting
	}

	return res
}
