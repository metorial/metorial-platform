package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type allowlistedStorage struct {
	*manifesttest.Storage
	allowed map[string]bool
}

func (s allowlistedStorage) AllowBucket(bucket string) bool { return s.allowed[bucket] }

func newManifestService(t *testing.T) (*RcpService, *manifesttest.Storage, *rpc.ManifestSource) {
	t.Helper()

	storage := manifesttest.NewStorage()
	entry := storage.PutContent("plugins/acme/SKILL.md", []byte("# Acme\n"))
	ref := storage.PutManifest(manifesttest.SourceBucket, manifesttest.Encode(
		manifest.Header{Scope: manifest.Scope{Dirs: []string{"plugins"}}},
		[]manifest.Entry{entry},
	))

	rs := &RcpService{manifestStorage: allowlistedStorage{Storage: storage, allowed: map[string]bool{manifesttest.SourceBucket: true}}}
	return rs, storage, &rpc.ManifestSource{Bucket: ref.Bucket, Key: ref.Key, Sha256: ref.SHA256}
}

func exportErrorFrom(t *testing.T, err error) (codes.Code, export.Payload) {
	t.Helper()

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("%v is not a gRPC status", err)
	}
	raw, found := strings.CutPrefix(st.Message(), export.StatusPrefix)
	if !found {
		t.Fatalf("status message %q is not a structured export error", st.Message())
	}

	var payload export.Payload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatal(err)
	}
	return st.Code(), payload
}

func TestManifestExportsDispatchPerProvider(t *testing.T) {
	rs, _, src := newManifestService(t)
	ctx := context.Background()

	t.Run("github", func(t *testing.T) {
		_, err := rs.ExportBucketToGithub(ctx, &rpc.ExportBucketToGithubRequest{Owner: "o", Repo: "r", Manifest: src})
		if st, _ := status.FromError(err); st == nil || !strings.Contains(st.Message(), "a GitHub token is required") {
			t.Fatalf("got %v, want the GitHub exporter's token check", err)
		}
	})

	calls := []struct {
		name string
		want string
		call func() error
	}{
		{"gitlab", "GitLab token is required", func() error {
			_, err := rs.ExportBucketToGitlab(ctx, &rpc.ExportBucketToGitlabRequest{ProjectId: 1, Manifest: src})
			return err
		}},
		{"bitbucket cloud", "Bitbucket token is required", func() error {
			_, err := rs.ExportBucketToBitbucketCloud(ctx, &rpc.ExportBucketToBitbucketCloudRequest{Workspace: "w", Repo: "r", Manifest: src})
			return err
		}},
		{"bitbucket data center", "Bitbucket token is required", func() error {
			_, err := rs.ExportBucketToBitbucketDataCenter(ctx, &rpc.ExportBucketToBitbucketDataCenterRequest{CloneUrl: "https://bb.example/scm/p/r.git", Manifest: src})
			return err
		}},
	}

	for _, tt := range calls {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.call()
			if st, _ := status.FromError(err); st == nil || !strings.Contains(st.Message(), tt.want) {
				t.Fatalf("got %v, want the manifest exporter's token check", err)
			}
		})
	}
}

func TestManifestExportRejectsBadSources(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name   string
		mutate func(rs *RcpService, storage *manifesttest.Storage, src *rpc.ManifestSource)
		code   codes.Code
		want   export.Code
	}{
		{
			name: "bucket not allowlisted",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.Bucket = "someone-elses-bucket"
			},
			code: codes.InvalidArgument,
			want: export.CodeManifestInvalid,
		},
		{
			name: "key outside the manifest prefix",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.Key = "secrets/config.json"
			},
			code: codes.InvalidArgument,
			want: export.CodeManifestInvalid,
		},
		{
			name: "missing manifest",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.Key = manifest.KeyPrefix + "sdst_test/missing.ndjson"
			},
			code: codes.NotFound,
			want: export.CodeSourceNotFound,
		},
		{
			name: "sha256 mismatch",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.Sha256 = strings.Repeat("0", 64)
			},
			code: codes.InvalidArgument,
			want: export.CodeManifestInvalid,
		},
		{
			name: "missing previous manifest",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.PreviousBucket = manifesttest.SourceBucket
				src.PreviousKey = manifest.KeyPrefix + "sdst_test/old.ndjson"
				src.PreviousSha256 = strings.Repeat("a", 64)
			},
			code: codes.NotFound,
			want: export.CodeSourceNotFound,
		},
		{
			name: "remote-state prefix outside remote-state/",
			mutate: func(_ *RcpService, _ *manifesttest.Storage, src *rpc.ManifestSource) {
				src.RemoteStateKeyPrefix = "skill-sync/manifests/"
			},
			code: codes.InvalidArgument,
			want: export.CodeManifestInvalid,
		},
		{
			name: "no manifest storage configured",
			mutate: func(rs *RcpService, _ *manifesttest.Storage, _ *rpc.ManifestSource) {
				rs.manifestStorage = nil
			},
			code: codes.InvalidArgument,
			want: export.CodeManifestInvalid,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rs, storage, src := newManifestService(t)
			tt.mutate(rs, storage, src)

			_, err := rs.ExportBucketToGithub(ctx, &rpc.ExportBucketToGithubRequest{Owner: "o", Repo: "r", Manifest: src})
			code, payload := exportErrorFrom(t, err)
			if code != tt.code || payload.Code != tt.want {
				t.Fatalf("got %v %s (%s), want %v %s", code, payload.Code, payload.Message, tt.code, tt.want)
			}
		})
	}
}

func TestManifestExportChecksAllowlistBeforeReading(t *testing.T) {
	rs, storage, src := newManifestService(t)
	rs.manifestStorage = allowlistedStorage{Storage: storage, allowed: map[string]bool{}}

	_, err := rs.ExportBucketToGithub(context.Background(), &rpc.ExportBucketToGithubRequest{Manifest: src})
	if code, _ := exportErrorFrom(t, err); code != codes.InvalidArgument {
		t.Fatalf("got %v", code)
	}
	if opens := storage.Opens(src.Bucket, src.Key); opens != 0 {
		t.Fatalf("a disallowed bucket was read %d times", opens)
	}
}
