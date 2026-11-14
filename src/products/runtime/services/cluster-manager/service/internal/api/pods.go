package api

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/auth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/builds"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/bundles"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/functions"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/objectstore"
)

type PodIdentities struct {
	FunctionsNamespace string
	FunctionRuntimeSA  string
	BuildsNamespace    string
	BuildRuntimeSA     string
}

// Pods serves the pod-facing listener. Endpoints take no IDs: the version or build is derived
// from the caller's pod-bound token, so a pod can only reach its own bundle or declared artifacts.
type Pods struct {
	Auth           *auth.Authenticator
	Identities     PodIdentities
	Functions      *functions.Manager
	Builds         *builds.Manager
	Bundles        *bundles.Service
	Store          objectstore.Store
	Buckets        *access.Buckets
	MaxUploadBytes int64
	Metrics        *metrics.Metrics
	Log            *slog.Logger
}

func (p *Pods) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /v1/bundles/self", p.authenticated("bundle", p.bundle))
	mux.Handle("GET /v1/builds/self/artifacts/{artifactId}", p.authenticated("artifact", p.artifact))
	mux.Handle("PUT /v1/builds/self/uploads/{stepId}", p.authenticated("upload", p.upload))
	return mux
}

type podHandler func(w http.ResponseWriter, r *http.Request, identity *kubeauth.Identity) error

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	if s.status == 0 {
		s.status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}

func (p *Pods) authenticated(endpoint string, h podHandler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w}
		defer func() {
			p.Metrics.PodRequests.WithLabelValues(endpoint, strconv.Itoa(rec.status)).Inc()
		}()

		identity, err := p.Auth.Verify(r.Context(), kubeauth.BearerToken(r))
		if err != nil {
			writeError(rec, err)
			return
		}
		if identity.PodName == "" {
			p.Auth.Fail("not_pod_bound")
			writeError(rec, ldrpc.UnauthorizedError().WithMessage("The token is not bound to a pod."))
			return
		}

		if err := h(rec, r, identity); err != nil {
			if rec.status != 0 {
				p.Log.Warn("pod-facing stream failed", "endpoint", endpoint, "pod", identity.PodName, "error", err)
				return
			}
			writeError(rec, p.podError(endpoint, identity, err))
		}
	})
}

func (p *Pods) podError(endpoint string, identity *kubeauth.Identity, err error) error {
	var notAllowed *access.ObjectNotAllowedError
	switch {
	case errors.Is(err, functions.ErrPodUnknown), errors.Is(err, builds.ErrPodUnknown), errors.Is(err, objectstore.ErrNotFound):
		return ldrpc.NotFoundError("resource", "")
	case errors.Is(err, builds.ErrBuildFinished):
		p.Auth.Fail("build_finished")
		return ldrpc.ForbiddenError().WithMessage("The build has finished.")
	case errors.As(err, &notAllowed):
		return ldrpc.ForbiddenError().WithMessage(notAllowed.Error())
	}
	if e, ok := ldrpc.AsError(err); ok {
		return e
	}
	p.Log.Error("pod-facing request failed", "endpoint", endpoint, "pod", identity.PodName, "error", err)
	return ldrpc.InternalServerError()
}

func writeError(w http.ResponseWriter, err error) {
	rpcErr, ok := ldrpc.AsError(err)
	if !ok {
		rpcErr = ldrpc.InternalServerError()
	}
	body, _ := json.Marshal(rpcErr)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(rpcErr.Status)
	_, _ = w.Write(body)
}

func (p *Pods) isFunctionPod(id *kubeauth.Identity) bool {
	return id.Namespace == p.Identities.FunctionsNamespace && id.ServiceAccount == p.Identities.FunctionRuntimeSA
}

func (p *Pods) isBuildPod(id *kubeauth.Identity) bool {
	return id.Namespace == p.Identities.BuildsNamespace && id.ServiceAccount == p.Identities.BuildRuntimeSA
}

func (p *Pods) forbidden(reason string) error {
	p.Auth.Fail(reason)
	return ldrpc.ForbiddenError()
}

func (p *Pods) bundle(w http.ResponseWriter, r *http.Request, id *kubeauth.Identity) error {
	if !p.isFunctionPod(id) {
		return p.forbidden("wrong_identity")
	}
	bucket, key, err := p.Functions.ResolvePod(r.Context(), id.PodName, id.PodUID)
	if err != nil {
		return err
	}
	return p.Bundles.Serve(r.Context(), w, bucket, key)
}

func (p *Pods) artifact(w http.ResponseWriter, r *http.Request, id *kubeauth.Identity) error {
	if !p.isBuildPod(id) {
		return p.forbidden("wrong_identity")
	}
	_, spec, err := p.Builds.ResolvePod(r.Context(), id.PodName, id.PodUID)
	if err != nil {
		return err
	}
	download, ok := spec.Download(r.PathValue("artifactId"))
	if !ok {
		return p.forbidden("undeclared_artifact")
	}
	if err := p.Buckets.Check(access.UseBuildDownload, download.Bucket); err != nil {
		return err
	}

	obj, err := p.Store.Get(r.Context(), download.Bucket, download.Key)
	if err != nil {
		return err
	}
	defer obj.Body.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	if obj.Size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(obj.Size, 10))
	}
	w.WriteHeader(http.StatusOK)
	_, err = io.Copy(w, obj.Body)
	return err
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

func (p *Pods) upload(w http.ResponseWriter, r *http.Request, id *kubeauth.Identity) error {
	if !p.isBuildPod(id) {
		return p.forbidden("wrong_identity")
	}
	job, spec, err := p.Builds.ResolvePod(r.Context(), id.PodName, id.PodUID)
	if err != nil {
		return err
	}
	stepID := r.PathValue("stepId")
	upload, ok := spec.Upload(stepID)
	if !ok {
		return p.forbidden("undeclared_upload")
	}
	if err := p.Buckets.Check(access.UseBuildUpload, upload.Bucket); err != nil {
		return err
	}
	if r.ContentLength > p.MaxUploadBytes {
		return ldrpc.NewError(http.StatusRequestEntityTooLarge, "payload_too_large", "The upload is too large.")
	}

	body := &countingReader{r: http.MaxBytesReader(w, r.Body, p.MaxUploadBytes)}
	if err := p.Store.Put(r.Context(), upload.Bucket, upload.Key, body, r.ContentLength, r.Header.Get("Content-Type"), nil); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return ldrpc.NewError(http.StatusRequestEntityTooLarge, "payload_too_large", "The upload is too large.")
		}
		return err
	}
	if err := p.Builds.RecordUpload(r.Context(), job, stepID, body.n); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]any{"stepId": stepID, "sizeBytes": body.n})
}
