package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const namespace = "cluster_manager"

type Metrics struct {
	Registry *prometheus.Registry

	EnsureDuration      *prometheus.HistogramVec
	EnsureDeclined      *prometheus.CounterVec
	InvokeDuration      *prometheus.HistogramVec
	NotMaterialized     prometheus.Counter
	GCEvictions         *prometheus.CounterVec
	AuthFailures        *prometheus.CounterVec
	TokenReviewDuration prometheus.Histogram
	TokenReviewCache    *prometheus.CounterVec
	PreflightResults    *prometheus.GaugeVec
	RPCCalls            *prometheus.HistogramVec
	BundleImports       *prometheus.CounterVec
	BundleCache         *prometheus.CounterVec
	PodRequests         *prometheus.CounterVec
	LastInvokedFlushes  *prometheus.CounterVec
	BuildsStarted       prometheus.Counter
}

func New() *Metrics {
	reg := prometheus.NewRegistry()
	reg.MustRegister(collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

	latency := []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60, 120}

	m := &Metrics{
		Registry: reg,
		EnsureDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace, Name: "function_ensure_duration_seconds",
			Help:    "function:ensure latency by mode and outcome.",
			Buckets: latency,
		}, []string{"mode", "outcome"}),
		EnsureDeclined: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "function_ensure_declined_total",
			Help: "Speculative materializations declined, by reason.",
		}, []string{"reason"}),
		InvokeDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace, Name: "function_invoke_duration_seconds",
			Help:    "function:invoke latency by outcome.",
			Buckets: latency,
		}, []string{"outcome"}),
		NotMaterialized: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace, Name: "function_not_materialized_total",
			Help: "Invocations answered with function_not_materialized.",
		}),
		GCEvictions: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "gc_evictions_total",
			Help: "Knative Services deleted by GC or capacity eviction, by reason.",
		}, []string{"reason"}),
		AuthFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "auth_failures_total",
			Help: "Rejected callers by listener and reason.",
		}, []string{"listener", "reason"}),
		TokenReviewDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: namespace, Name: "tokenreview_duration_seconds",
			Help:    "Latency of token authentication including TokenReview calls on cache misses.",
			Buckets: latency,
		}),
		TokenReviewCache: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "tokenreview_cache_total",
			Help: "Token authentications by cache result (hit or miss).",
		}, []string{"result"}),
		PreflightResults: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace, Name: "preflight_check",
			Help: "Preflight results: 1 for the check's current result label.",
		}, []string{"check", "result"}),
		RPCCalls: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace, Name: "rpc_call_duration_seconds",
			Help:    "Control API calls by method and status.",
			Buckets: latency,
		}, []string{"method", "status"}),
		BundleImports: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "bundle_imports_total",
			Help: "bundle:import calls by outcome.",
		}, []string{"outcome"}),
		BundleCache: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "bundle_cache_total",
			Help: "Bundle disk cache lookups by result.",
		}, []string{"result"}),
		PodRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "pod_requests_total",
			Help: "Pod-facing requests by endpoint and status code.",
		}, []string{"endpoint", "code"}),
		LastInvokedFlushes: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace, Name: "last_invoked_flushes_total",
			Help: "last-invoked-at annotation writes by outcome.",
		}, []string{"outcome"}),
		BuildsStarted: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: namespace, Name: "builds_started_total",
			Help: "Build Jobs created.",
		}),
	}

	reg.MustRegister(
		m.EnsureDuration, m.EnsureDeclined, m.InvokeDuration, m.NotMaterialized, m.GCEvictions,
		m.AuthFailures, m.TokenReviewDuration, m.TokenReviewCache, m.PreflightResults, m.RPCCalls,
		m.BundleImports, m.BundleCache, m.PodRequests, m.LastInvokedFlushes, m.BuildsStarted,
	)
	return m
}

// RegisterGauges adds gauges computed at scrape time, e.g. from informer caches.
func (m *Metrics) RegisterGauges(materialized, warm func() float64) {
	m.Registry.MustRegister(
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: namespace, Name: "functions_materialized",
			Help: "Knative Services currently materialized.",
		}, materialized),
		prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace: namespace, Name: "functions_warm",
			Help: "Materialized versions with at least one ready pod.",
		}, warm),
	)
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.Registry, promhttp.HandlerOpts{Registry: m.Registry})
}
