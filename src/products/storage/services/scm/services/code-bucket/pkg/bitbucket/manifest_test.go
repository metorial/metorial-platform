package bitbucket

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

var manifestScope = manifest.Scope{Dirs: []string{"plugins"}, Files: []string{".claude-plugin/marketplace.json"}}

func TestManifestExportPushesToBothFlavours(t *testing.T) {
	tests := []struct {
		name     string
		username string
		run      func(ctx context.Context, gitURL string, options export.ManifestOptions) (*export.Result, error)
	}{
		{
			name:     "cloud",
			username: "x-token-auth",
			run: func(ctx context.Context, gitURL string, options export.ManifestOptions) (*export.Result, error) {
				return ExportManifestToCloud(ctx, CloudManifestExportOptions{
					CloudUploadOptions: CloudUploadOptions{Workspace: "ws", Repo: "repo", Branch: "main", CommitMessage: "Sync", Token: "cloud-token", APIURL: "https://api.invalid"},
					ManifestOptions:    options,
					ManifestTransport:  ManifestTransport{GitURL: gitURL, AllowHTTP: true},
				})
			},
		},
		{
			name:     "data center",
			username: "builder",
			run: func(ctx context.Context, gitURL string, options export.ManifestOptions) (*export.Result, error) {
				return ExportManifestToDataCenter(ctx, DataCenterManifestExportOptions{
					DataCenterUploadOptions: DataCenterUploadOptions{CloneURL: "https://bitbucket.invalid/scm/p/repo.git", Branch: "main", CommitMessage: "Sync", Username: "builder", Token: "cloud-token"},
					ManifestOptions:         options,
					ManifestTransport:       ManifestTransport{GitURL: gitURL, AllowHTTP: true},
				})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := gittest.NewRepo(t, map[string]string{
				"README.md":            "user\n",
				"plugins/old/SKILL.md": "old\n",
				"plugins/a/SKILL.md":   "a\n",
			})
			server := repo.Serve()
			server.AuthHeader = gitremote.BasicAuth(tt.username, "cloud-token")
			manifests := gittest.NewManifests(t, manifestScope)
			files := map[string]string{"plugins/a/SKILL.md": "a\n", "plugins/b/SKILL.md": "b\n", ".claude-plugin/marketplace.json": "{}"}
			options := manifests.Options(files)
			options.Listings = gittest.NewListings()

			ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
			defer cancel()
			result, err := tt.run(ctx, server.RepoURL(), options)
			if err != nil {
				t.Fatal(err)
			}

			got := repo.Git("ls-tree", "-r", "--name-only", "main")
			if got != ".claude-plugin/marketplace.json\nREADME.md\nplugins/a/SKILL.md\nplugins/b/SKILL.md" {
				t.Fatalf("tree:\n%s", got)
			}
			repo.Fsck()
			if result.NewRemoteState == nil || result.NewRemoteState.CommitSHA != repo.Head("main") {
				t.Fatalf("NewRemoteState = %+v", result.NewRemoteState)
			}
			for _, req := range server.Requests() {
				if !strings.HasPrefix(req.Path, "/"+gittest.RepoName+"/") {
					t.Fatalf("unexpected request %s %s", req.Method, req.Path)
				}
			}
		})
	}
}

func TestManifestExportRejectsSubdirectoryTargets(t *testing.T) {
	_, err := ExportManifestToCloud(context.Background(), CloudManifestExportOptions{
		CloudUploadOptions: CloudUploadOptions{Workspace: "ws", Repo: "repo", Token: "t", TargetPath: "skills"},
	})
	if exportErr, ok := export.As(err); !ok || exportErr.Code != export.CodeManifestInvalid {
		t.Fatalf("err = %v, want manifest_invalid", err)
	}

	_, err = ExportManifestToDataCenter(context.Background(), DataCenterManifestExportOptions{
		DataCenterUploadOptions: DataCenterUploadOptions{CloneURL: "http://bitbucket.example/scm/p/r.git", Token: "t"},
	})
	if err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("err = %v, want an HTTPS error", err)
	}
}
