package gateway

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const metricsNamespace = "egress_gateway"

type Metrics struct {
	Registry *prometheus.Registry

	Connections         *prometheus.CounterVec
	OpenConnections     *prometheus.GaugeVec
	Denials             *prometheus.CounterVec
	GrantFailures       *prometheus.CounterVec
	Bytes               *prometheus.CounterVec
	DNSLookups          *prometheus.CounterVec
	ObservationBatches  *prometheus.CounterVec
	ObservationsDropped prometheus.Counter
}

func NewMetrics() *Metrics {
	reg := prometheus.NewRegistry()
	reg.MustRegister(collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

	m := &Metrics{
		Registry: reg,
		Connections: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "connections_total",
			Help: "Destination requests by front end and outcome (allowed, denied, failed).",
		}, []string{"front_end", "outcome"}),
		OpenConnections: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: metricsNamespace, Name: "open_connections",
			Help: "Tunnels and proxied connections currently open.",
		}, []string{"front_end"}),
		Denials: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "denials_total",
			Help: "Denied destination requests by front end and reason.",
		}, []string{"front_end", "reason"}),
		GrantFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "grant_failures_total",
			Help: "Rejected grants by front end and reason.",
		}, []string{"front_end", "reason"}),
		Bytes: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "bytes_total",
			Help: "Bytes relayed by front end and direction (upstream is client to destination).",
		}, []string{"front_end", "direction"}),
		DNSLookups: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "dns_lookups_total",
			Help: "Hostname lookups by result.",
		}, []string{"result"}),
		ObservationBatches: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "observation_batches_total",
			Help: "Observation batches shipped to the log store by result.",
		}, []string{"result"}),
		ObservationsDropped: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace, Name: "observations_dropped_total",
			Help: "Observations dropped after exceeding the maximum buffer age.",
		}),
	}

	reg.MustRegister(
		m.Connections, m.OpenConnections, m.Denials, m.GrantFailures, m.Bytes, m.DNSLookups,
		m.ObservationBatches, m.ObservationsDropped,
	)
	return m
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.Registry, promhttp.HandlerOpts{Registry: m.Registry})
}
