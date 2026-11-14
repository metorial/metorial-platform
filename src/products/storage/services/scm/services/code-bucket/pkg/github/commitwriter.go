package github

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	DefaultGraphQLMaxFileBytes int64 = 16 << 20
	DefaultRESTMaxBlobBytes    int64 = 28 << 20

	restBatchFixedCost = 3
)

const createCommitMutation = `mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid tree { oid } } }
}`

// commitWriter commits batches with GraphQL createCommitOnBranch (signed by GitHub,
// guarded by expectedHeadOid). Batches holding references to existing blobs or files
// too large for a GraphQL body use the REST tree/commit/ref path, as does GHES without
// the mutation.
type commitWriter struct {
	api    *restClient
	owner  string
	repo   string
	branch string
	limits commitbatch.BatchLimits
	logf   func(format string, args ...any)

	mu      sync.Mutex
	useREST bool
	trees   map[string]string
}

type writerConfig struct {
	GraphQLMaxFileBytes int64
	BatchInitialBytes   int64
	BatchMaxBytes       int64
	ForceREST           bool
}

func newCommitWriter(api *restClient, owner, repo, branch string, cfg writerConfig) *commitWriter {
	return &commitWriter{
		api:    api,
		owner:  owner,
		repo:   repo,
		branch: branch,
		limits: commitbatch.BatchLimits{
			InitialBytes:       cfg.BatchInitialBytes,
			MaxBytes:           cfg.BatchMaxBytes,
			MinBytes:           commitbatch.DefaultMinBytes,
			MaxChanges:         commitbatch.DefaultMaxChanges,
			MaxInlineFileBytes: cfg.GraphQLMaxFileBytes,
			SupportsReferences: true,
		},
		logf:    log.Printf,
		useREST: cfg.ForceREST,
		trees:   map[string]string{},
	}
}

func (w *commitWriter) Limits() commitbatch.BatchLimits { return w.limits }

type branchResponse struct {
	Commit struct {
		SHA    string `json:"sha"`
		Commit struct {
			Tree struct {
				SHA string `json:"sha"`
			} `json:"tree"`
		} `json:"commit"`
	} `json:"commit"`
}

// Head costs one REST request: the branch endpoint carries the head commit and its tree.
func (w *commitWriter) Head(ctx context.Context) (string, string, error) {
	var branch branchResponse
	err := w.api.do(ctx, http.MethodGet, fmt.Sprintf("%s/branches/%s", w.api.repoURL, escapeRef(w.branch)), nil, &branch)
	if isStatus(err, http.StatusNotFound) {
		return "", "", fmt.Errorf("%s: %w", w.branch, commitbatch.ErrBranchMissing)
	}
	if err != nil {
		return "", "", err
	}

	w.rememberTree(branch.Commit.SHA, branch.Commit.Commit.Tree.SHA)
	return branch.Commit.SHA, branch.Commit.Commit.Tree.SHA, nil
}

func (w *commitWriter) rememberTree(commit, tree string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.trees[commit] = tree
}

func (w *commitWriter) treeOf(ctx context.Context, commit string) (string, error) {
	w.mu.Lock()
	tree, ok := w.trees[commit]
	w.mu.Unlock()
	if ok {
		return tree, nil
	}

	var resp githubCommitResponse
	if err := w.api.do(ctx, http.MethodGet, fmt.Sprintf("%s/git/commits/%s", w.api.repoURL, commit), nil, &resp); err != nil {
		return "", err
	}
	w.rememberTree(commit, resp.Tree.SHA)
	return resp.Tree.SHA, nil
}

func (w *commitWriter) needsREST(batch commitbatch.Batch) bool {
	w.mu.Lock()
	useREST := w.useREST
	w.mu.Unlock()
	if useREST {
		return true
	}

	for _, c := range batch.Changes {
		if c.Kind == commitbatch.ChangeReference || (c.Kind == commitbatch.ChangeAdd && c.Size > w.limits.MaxInlineFileBytes) {
			return true
		}
	}
	return false
}

// Cost counts content-creating requests: one mutation, or blob uploads plus tree,
// commit and ref update on the REST path. Inline text costs no blob request, but
// whether content is text is only known once read, so adds are counted as blobs.
func (w *commitWriter) Cost(batch commitbatch.Batch) int {
	if !w.needsREST(batch) {
		return 1
	}

	cost := restBatchFixedCost
	for _, c := range batch.Changes {
		if c.Kind == commitbatch.ChangeAdd {
			cost++
		}
	}
	return cost
}

func (w *commitWriter) Commit(ctx context.Context, base string, batch commitbatch.Batch) (string, error) {
	head, _, err := w.CommitWithTree(ctx, base, batch)
	return head, err
}

func (w *commitWriter) CommitWithTree(ctx context.Context, base string, batch commitbatch.Batch) (string, string, error) {
	if w.needsREST(batch) {
		return w.commitREST(ctx, base, batch)
	}

	head, tree, err := w.commitGraphQL(ctx, base, batch)
	switch {
	case errors.Is(err, errMutationUnavailable):
		w.logf("[github manifest export] createCommitOnBranch unavailable on %s, using the REST API", w.api.graphqlURL)
		w.mu.Lock()
		w.useREST = true
		w.mu.Unlock()
		return w.commitREST(ctx, base, batch)
	case errors.Is(err, commitbatch.ErrBodyTooLarge) && commitbatch.SingleUnit(batch.Changes):
		return w.commitREST(ctx, base, batch)
	}
	return head, tree, err
}

var errMutationUnavailable = errors.New("createCommitOnBranch is not available")

func readChange(ctx context.Context, c commitbatch.Change) ([]byte, error) {
	body, err := c.Open(ctx)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	content, err := io.ReadAll(io.LimitReader(body, c.Size+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) != c.Size {
		return nil, fmt.Errorf("%s: read %d bytes, expected %d", c.Path, len(content), c.Size)
	}
	return content, nil
}

type commitOnBranchResponse struct {
	CreateCommitOnBranch struct {
		Commit struct {
			OID  string `json:"oid"`
			Tree struct {
				OID string `json:"oid"`
			} `json:"tree"`
		} `json:"commit"`
	} `json:"createCommitOnBranch"`
}

type fileAddition struct {
	Path     string `json:"path"`
	Contents string `json:"contents"`
}

type fileDeletion struct {
	Path string `json:"path"`
}

func splitMessage(message string) (string, string) {
	headline, body, _ := strings.Cut(message, "\n")
	return headline, strings.TrimLeft(body, "\n")
}

func (w *commitWriter) commitGraphQL(ctx context.Context, base string, batch commitbatch.Batch) (string, string, error) {
	additions := []fileAddition{}
	deletions := []fileDeletion{}
	for _, c := range batch.Changes {
		switch c.Kind {
		case commitbatch.ChangeAdd:
			content, err := readChange(ctx, c)
			if err != nil {
				return "", "", err
			}
			additions = append(additions, fileAddition{Path: c.Path, Contents: base64.StdEncoding.EncodeToString(content)})
		case commitbatch.ChangeDelete:
			deletions = append(deletions, fileDeletion{Path: c.Path})
		default:
			return "", "", fmt.Errorf("GraphQL commits can't carry %s changes", c.Kind)
		}
	}

	headline, body := splitMessage(batch.Message)
	message := map[string]string{"headline": headline}
	if body != "" {
		message["body"] = body
	}

	input := map[string]any{
		"branch":          map[string]string{"repositoryNameWithOwner": w.owner + "/" + w.repo, "branchName": w.branch},
		"message":         message,
		"expectedHeadOid": base,
		"fileChanges":     map[string]any{"additions": additions, "deletions": deletions},
	}

	var resp commitOnBranchResponse
	err := w.api.graphql(ctx, createCommitMutation, map[string]any{"input": input}, &resp)
	if err != nil {
		return "", "", classifyMutationError(err)
	}

	commit := resp.CreateCommitOnBranch.Commit
	if commit.OID == "" {
		return "", "", errors.New("createCommitOnBranch returned no commit")
	}
	w.rememberTree(commit.OID, commit.Tree.OID)
	return commit.OID, commit.Tree.OID, nil
}

func classifyMutationError(err error) error {
	var (
		transport *transportError
		gqlErrors graphqlErrors
	)

	switch {
	case errors.As(err, &transport), isStatus(err, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout):
		return &commitbatch.AmbiguousError{Err: err}
	case isStatus(err, http.StatusNotFound):
		return fmt.Errorf("%w: %v", errMutationUnavailable, err)
	case errors.As(err, &gqlErrors):
		for _, e := range gqlErrors {
			message := strings.ToLower(e.Message)
			switch {
			case e.Type == "STALE_DATA" || strings.Contains(message, "expected branch to point to"):
				return fmt.Errorf("%w: %v", commitbatch.ErrHeadMismatch, err)
			case e.Extensions.Code == "undefinedField" || (strings.Contains(message, "createcommitonbranch") && strings.Contains(message, "doesn't exist")):
				return fmt.Errorf("%w: %v", errMutationUnavailable, err)
			case e.Type == "NOT_FOUND" && (strings.Contains(message, "ref") || strings.Contains(message, "branch")),
				strings.Contains(message, "does not exist") && (strings.Contains(message, "ref") || strings.Contains(message, "branch")):
				return fmt.Errorf("%w: %v", commitbatch.ErrBranchMissing, err)
			case strings.Contains(message, "timeout") || strings.Contains(message, "timed out"):
				return &commitbatch.AmbiguousError{Err: err}
			}
		}
	}
	return err
}

func modeOf(c commitbatch.Change) string {
	if c.Mode == 0 {
		return remotestate.ModeFile.String()
	}
	return c.Mode.String()
}

// commitREST writes blobs that can't be inlined, then one tree on the base's tree, one
// commit and a non-forced ref update, which GitHub rejects unless it fast-forwards from
// base.
func (w *commitWriter) commitREST(ctx context.Context, base string, batch commitbatch.Batch) (string, string, error) {
	baseTree, err := w.treeOf(ctx, base)
	if err != nil {
		return "", "", err
	}

	entries := make([]githubTreeEntry, 0, len(batch.Changes))
	for _, c := range batch.Changes {
		entry := githubTreeEntry{Path: c.Path, Mode: modeOf(c), Type: "blob"}

		switch c.Kind {
		case commitbatch.ChangeAdd:
			content, err := readChange(ctx, c)
			if err != nil {
				return "", "", err
			}
			if canInline(content) {
				text := string(content)
				entry.Content = &text
			} else {
				sha, err := w.createBlob(ctx, content)
				if err != nil {
					return "", "", classifyWriteError(fmt.Errorf("create blob for %s: %w", c.Path, err))
				}
				if sha != c.BlobSHA {
					return "", "", fmt.Errorf("GitHub stored %s as blob %s, expected %s", c.Path, sha, c.BlobSHA)
				}
				entry.SHA = &sha
			}
		case commitbatch.ChangeReference:
			sha := c.BlobSHA
			entry.SHA = &sha
		case commitbatch.ChangeDelete:
			entry.Mode = remotestate.ModeFile.String()
		}

		entries = append(entries, entry)
	}

	var tree githubCreateTreeResponse
	if err := w.api.do(ctx, http.MethodPost, w.api.repoURL+"/git/trees", map[string]any{"base_tree": baseTree, "tree": entries}, &tree); err != nil {
		return "", "", classifyWriteError(fmt.Errorf("create tree: %w", err))
	}

	var commit githubCreateCommitResponse
	if err := w.api.do(ctx, http.MethodPost, w.api.repoURL+"/git/commits", githubCreateCommitRequest{Message: batch.Message, Tree: tree.SHA, Parents: []string{base}}, &commit); err != nil {
		return "", "", classifyWriteError(fmt.Errorf("create commit: %w", err))
	}

	err = w.api.do(ctx, http.MethodPatch, fmt.Sprintf("%s/git/refs/heads/%s", w.api.repoURL, escapeRef(w.branch)), githubUpdateRefRequest{SHA: commit.SHA}, nil)
	if err != nil {
		return "", "", classifyRefUpdateError(err)
	}

	w.rememberTree(commit.SHA, tree.SHA)
	return commit.SHA, tree.SHA, nil
}

// classifyWriteError marks failures without a definite answer as ambiguous, so the
// batcher re-reads the head before retrying instead of giving up.
func classifyWriteError(err error) error {
	var transport *transportError
	if errors.As(err, &transport) || isStatus(err, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout) {
		return &commitbatch.AmbiguousError{Err: err}
	}
	return err
}

func classifyRefUpdateError(err error) error {
	var (
		transport *transportError
		apiErr    *apiError
	)

	switch {
	case errors.As(err, &transport), isStatus(err, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout):
		return &commitbatch.AmbiguousError{Err: err}
	case isStatus(err, http.StatusNotFound):
		return fmt.Errorf("%w: %v", commitbatch.ErrBranchMissing, err)
	case errors.As(err, &apiErr) && apiErr.Status == http.StatusUnprocessableEntity:
		body := strings.ToLower(apiErr.Body)
		if strings.Contains(body, "does not exist") {
			return fmt.Errorf("%w: %v", commitbatch.ErrBranchMissing, err)
		}
		if strings.Contains(body, "fast forward") || strings.Contains(body, "fast-forward") {
			return fmt.Errorf("%w: %v", commitbatch.ErrHeadMismatch, err)
		}
	}
	return fmt.Errorf("update branch ref: %w", err)
}

func (w *commitWriter) createBlob(ctx context.Context, content []byte) (string, error) {
	var blob githubCreateBlobResponse
	err := w.api.do(ctx, http.MethodPost, w.api.repoURL+"/git/blobs", githubCreateBlobRequest{
		Content:  base64.StdEncoding.EncodeToString(content),
		Encoding: "base64",
	}, &blob)
	return blob.SHA, err
}
