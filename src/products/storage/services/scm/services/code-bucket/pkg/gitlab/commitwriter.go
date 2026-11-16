package gitlab

import (
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	// DefaultBatchInitialBytes is the legacy exporter's fixed commit payload cap.
	DefaultBatchInitialBytes int64 = maxGitlabCommitPayloadBytes
	// DefaultBatchMaxBytes fits one DefaultMaxFileBytes file, base64-encoded.
	DefaultBatchMaxBytes int64 = 96 << 20
	// DefaultMaxFileBytes is the largest regular file a manifest export commits through
	// the API (the legacy buffered-export cap); larger files go through Git LFS.
	DefaultMaxFileBytes int64 = 64 << 20

	maxInlineFileBytes = 8 << 20
)

type commitAction struct {
	Action          string `json:"action"`
	FilePath        string `json:"file_path"`
	Content         string `json:"content,omitempty"`
	Encoding        string `json:"encoding,omitempty"`
	ExecuteFilemode *bool  `json:"execute_filemode,omitempty"`
}

type commitRequest struct {
	Branch        string         `json:"branch"`
	CommitMessage string         `json:"commit_message"`
	Actions       []commitAction `json:"actions"`
}

type commitResponse struct {
	ID        string   `json:"id"`
	ParentIDs []string `json:"parent_ids"`
}

// commitWriter is a commitbatch.CommitWriter on POST /projects/:id/repository/commits.
// That endpoint has no compare-and-swap on the branch head, so the writer checks the
// new commit's parent: if someone else pushed in between, the batch landed on top of
// their commit and the batcher re-reads the head and replans the rest.
type commitWriter struct {
	api    *apiClient
	remote *remote
	branch string
	limits commitbatch.BatchLimits
}

func (w *commitWriter) Head(ctx context.Context) (string, string, error) {
	return w.remote.Head(ctx)
}

func (w *commitWriter) Limits() commitbatch.BatchLimits { return w.limits }

func (w *commitWriter) Commit(ctx context.Context, base string, batch commitbatch.Batch) (string, error) {
	state, err := w.remote.StateAt(ctx, base)
	if err != nil {
		return "", err
	}

	actions := make([]commitAction, 0, len(batch.Changes))
	changes := make([]remotestate.Change, 0, len(batch.Changes))
	for _, change := range batch.Changes {
		existing, exists := state.Lookup(change.Path)
		exists = exists && !existing.Mode.IsTree()

		switch change.Kind {
		case commitbatch.ChangeDelete:
			if !exists {
				continue
			}
			actions = append(actions, commitAction{Action: "delete", FilePath: change.Path})

		case commitbatch.ChangeAdd:
			content, err := readVerified(ctx, change)
			if err != nil {
				return "", err
			}
			action := "create"
			if exists {
				action = "update"
			}
			executable := change.Mode == remotestate.ModeExecutable
			actions = append(actions, commitAction{
				Action:          action,
				FilePath:        change.Path,
				Content:         base64.StdEncoding.EncodeToString(content),
				Encoding:        "base64",
				ExecuteFilemode: &executable,
			})

		default:
			return "", fmt.Errorf("gitlab: unsupported change %s for %s", change.Kind, change.Path)
		}
		changes = append(changes, change.RemoteChange())
	}
	if len(actions) == 0 {
		return base, nil
	}

	next, _, err := state.Apply(changes)
	if err != nil {
		return "", err
	}

	body, err := json.Marshal(commitRequest{Branch: w.branch, CommitMessage: batch.Message, Actions: actions})
	if err != nil {
		return "", err
	}

	var created commitResponse
	_, err = w.api.do(ctx, "create commit", http.MethodPost, w.api.projectURL("/repository/commits"), body, &created)
	if err != nil {
		return "", classifyCommitError(ctx, err)
	}
	if created.ID == "" {
		return "", &commitbatch.AmbiguousError{Err: errors.New("GitLab commit response has no id")}
	}

	if len(created.ParentIDs) != 1 || created.ParentIDs[0] != base {
		w.remote.expect(nil)
		return "", fmt.Errorf("%w: GitLab committed %s on top of %s, expected %s", commitbatch.ErrHeadMismatch, created.ID, strings.Join(created.ParentIDs, ","), base)
	}

	next.Commit = created.ID
	w.remote.expect(next)
	return created.ID, nil
}

func classifyCommitError(ctx context.Context, err error) error {
	var apiErr *APIError
	var rateLimited *commitbatch.RateLimitedError
	switch {
	case errors.As(err, &rateLimited):
		return err
	case errors.As(err, &apiErr):
		body := strings.ToLower(apiErr.Body)
		switch {
		case apiErr.StatusCode == http.StatusRequestEntityTooLarge:
			return fmt.Errorf("%w: %w", commitbatch.ErrBodyTooLarge, err)
		case apiErr.StatusCode == http.StatusBadRequest && (strings.Contains(body, "already exists") || strings.Contains(body, "doesn't exist") || strings.Contains(body, "does not exist")):
			return fmt.Errorf("%w: %w", commitbatch.ErrHeadMismatch, err)
		case apiErr.StatusCode >= 500:
			return &commitbatch.AmbiguousError{Err: err}
		}
		return err
	case ctx.Err() != nil:
		return err
	}
	return &commitbatch.AmbiguousError{Err: err}
}

// readVerified reads an add's content and checks it against the planned blob SHA, so
// a source that changed after planning can't be committed under the wrong listing.
func readVerified(ctx context.Context, change commitbatch.Change) ([]byte, error) {
	if change.Open == nil {
		return nil, fmt.Errorf("gitlab: add of %s has no content", change.Path)
	}
	body, err := change.Open(ctx)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	content, err := io.ReadAll(io.LimitReader(body, change.Size+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) != change.Size {
		return nil, &manifest.ContentMismatchError{Path: change.Path, Reason: fmt.Sprintf("source has %d bytes, expected %d", len(content), change.Size)}
	}
	if change.BlobSHA != "" && gitBlobSHA(content) != change.BlobSHA {
		return nil, &manifest.ContentMismatchError{Path: change.Path, Reason: "git blob SHA differs"}
	}
	return content, nil
}

func gitBlobSHA(content []byte) string {
	h := sha1.New()
	h.Write([]byte("blob " + strconv.Itoa(len(content)) + "\x00"))
	h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func resolveLimits(t export.Tuning) commitbatch.BatchLimits {
	limits := commitbatch.BatchLimits{
		InitialBytes:       DefaultBatchInitialBytes,
		MaxBytes:           DefaultBatchMaxBytes,
		MinBytes:           commitbatch.DefaultMinBytes,
		MaxChanges:         commitbatch.DefaultMaxChanges,
		MaxInlineFileBytes: maxInlineFileBytes,
	}
	if t.BatchMaxBytes > 0 {
		limits.MaxBytes = t.BatchMaxBytes
	}
	if t.BatchInitialBytes > 0 {
		limits.InitialBytes = t.BatchInitialBytes
	}
	limits.InitialBytes = min(limits.InitialBytes, limits.MaxBytes)
	return limits
}
