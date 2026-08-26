package bitbucket

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"

	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

func WalkDataCenterRepo(
	ctx context.Context,
	cloneURL, repoPath, ref, username, token string,
	yield func(FileToUpload) error,
) error {
	iter, cleanup, err := PrepareDataCenterRepo(ctx, cloneURL, repoPath, ref, username, token)
	if err != nil {
		return err
	}
	defer cleanup()
	return iter(yield)
}

func PrepareDataCenterRepo(
	ctx context.Context,
	cloneURL, repoPath, ref, username, token string,
) (FileIterator, func(), error) {
	repository, worktreeDir, cleanup, err := cloneDataCenterRepo(ctx, cloneURL, ref, username, token, false)
	if err != nil {
		return nil, nil, err
	}

	if ref != "" {
		hash, err := repository.ResolveRevision(plumbing.Revision(ref))
		if err != nil {
			hash, err = repository.ResolveRevision(plumbing.Revision("refs/remotes/origin/" + ref))
			if err != nil {
				hash, err = repository.ResolveRevision(plumbing.Revision("refs/tags/" + ref))
				if err != nil {
					cleanup()
					return nil, nil, fmt.Errorf("failed to resolve Bitbucket ref: %w", err)
				}
			}
		}
		worktree, err := repository.Worktree()
		if err != nil {
			cleanup()
			return nil, nil, err
		}
		if err := worktree.Checkout(&git.CheckoutOptions{Hash: *hash, Force: true}); err != nil {
			cleanup()
			return nil, nil, fmt.Errorf("failed to checkout Bitbucket ref: %w", err)
		}
	}

	normalizedPath, err := normalizeRepoPath(repoPath, true)
	if err != nil {
		cleanup()
		return nil, nil, err
	}
	root := filepath.Join(worktreeDir, filepath.FromSlash(normalizedPath))
	iter := func(yield func(FileToUpload) error) error {
		return filepath.WalkDir(root, func(filePath string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			if entry.IsDir() {
				if entry.Name() == ".git" {
					return filepath.SkipDir
				}
				return nil
			}
			info, err := entry.Info()
			if err != nil {
				return err
			}
			if !info.Mode().IsRegular() {
				return fmt.Errorf("unsupported non-regular repository entry %q", entry.Name())
			}
			relativePath, err := filepath.Rel(root, filePath)
			if err != nil {
				return err
			}
			if info.Size() > filelimit.MaxBufferedFileBytes {
				return filelimit.FileTooLargeError(
					"Bitbucket import", filepath.ToSlash(relativePath),
					info.Size(), filelimit.MaxBufferedFileBytes,
				)
			}
			content, err := os.ReadFile(filePath)
			if err != nil {
				return err
			}
			return yield(FileToUpload{Path: filepath.ToSlash(relativePath), Content: content})
		})
	}
	return iter, cleanup, nil
}

type DataCenterUploadOptions struct {
	CloneURL      string
	TargetPath    string
	Branch        string
	CommitMessage string
	Username      string
	Token         string

	// Bucket-relative paths to remove from the repository. Paths that are not
	// in the branch are ignored.
	DeletePaths []string

	// When set, only DeletePaths are removed. Without it the export mirrors
	// TargetPath and deletes whatever the bucket does not contain, which is
	// wrong for callers that own only part of that path.
	ExplicitDeletesOnly bool
}

func (o DataCenterUploadOptions) withDefaults() DataCenterUploadOptions {
	if o.Branch == "" {
		o.Branch = "main"
	}
	if o.CommitMessage == "" {
		o.CommitMessage = "Upload files"
	}
	return o
}

func UploadToDataCenterRepo(
	ctx context.Context,
	opts DataCenterUploadOptions,
	iter FileIterator,
) error {
	opts = opts.withDefaults()
	if err := validateBranch(opts.Branch); err != nil {
		return err
	}

	repository, worktreeDir, cleanup, err := cloneDataCenterRepo(
		ctx, opts.CloneURL, opts.Branch, opts.Username, opts.Token, true,
	)
	if err != nil {
		return err
	}
	defer cleanup()

	worktree, err := repository.Worktree()
	if err != nil {
		return err
	}
	branchRef := plumbing.NewBranchReferenceName(opts.Branch)
	if err := worktree.Checkout(&git.CheckoutOptions{Branch: branchRef, Force: true}); err != nil {
		return fmt.Errorf("failed to checkout Bitbucket branch: %w", err)
	}

	normalizedTarget, err := normalizeRepoPath(opts.TargetPath, true)
	if err != nil {
		return err
	}
	targetDir := filepath.Join(worktreeDir, filepath.FromSlash(normalizedTarget))

	if opts.ExplicitDeletesOnly {
		if err := removeDataCenterPaths(targetDir, opts.DeletePaths); err != nil {
			return err
		}
	} else if normalizedTarget == "" {
		entries, err := os.ReadDir(worktreeDir)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if entry.Name() == ".git" {
				continue
			}
			if err := os.RemoveAll(filepath.Join(worktreeDir, entry.Name())); err != nil {
				return err
			}
		}
	} else if err := os.RemoveAll(targetDir); err != nil {
		return err
	}

	if err := iter(func(file FileToUpload) error {
		filePath, err := normalizeRepoPath(file.Path, false)
		if err != nil {
			return err
		}
		destination := filepath.Join(targetDir, filepath.FromSlash(filePath))
		if err := ensureWithin(targetDir, destination); err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		return os.WriteFile(destination, file.Content, 0o644)
	}); err != nil {
		return err
	}

	status, err := worktree.Status()
	if err != nil {
		return err
	}
	if status.IsClean() {
		return nil
	}

	_, err = worktree.Commit(opts.CommitMessage, &git.CommitOptions{
		All: true,
		Author: &object.Signature{
			Name:  "Metorial",
			Email: "code-bucket@metorial.com",
			When:  time.Now(),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create Bitbucket commit: %w", err)
	}

	if err := repository.PushContext(ctx, &git.PushOptions{
		RemoteName: "origin",
		RefSpecs: []config.RefSpec{
			config.RefSpec(branchRef.String() + ":" + branchRef.String()),
		},
		Auth: dataCenterAuth(opts.Username, opts.Token),
	}); err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return fmt.Errorf("failed to push Bitbucket commit: %w", err)
	}
	return nil
}

// removeDataCenterPaths deletes only the listed paths, leaving the rest of the
// worktree untouched. Empty parent directories are pruned so the commit does not
// keep directories that only held removed files.
func removeDataCenterPaths(targetDir string, deletePaths []string) error {
	for _, deletePath := range deletePaths {
		filePath, err := normalizeRepoPath(deletePath, false)
		if err != nil {
			return err
		}

		destination := filepath.Join(targetDir, filepath.FromSlash(filePath))
		if err := ensureWithin(targetDir, destination); err != nil {
			return err
		}
		if err := os.Remove(destination); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return err
		}

		for parent := filepath.Dir(destination); parent != targetDir; parent = filepath.Dir(parent) {
			if err := ensureWithin(targetDir, parent); err != nil {
				break
			}
			if err := os.Remove(parent); err != nil {
				break
			}
		}
	}

	return nil
}

func cloneDataCenterRepo(
	ctx context.Context, cloneURL, ref, username, token string, singleBranch bool,
) (*git.Repository, string, func(), error) {
	if token == "" {
		return nil, "", nil, fmt.Errorf("Bitbucket token is required")
	}
	if err := validateCloneURL(cloneURL); err != nil {
		return nil, "", nil, err
	}

	worktreeDir, err := os.MkdirTemp("", "bitbucket-datacenter-*")
	if err != nil {
		return nil, "", nil, fmt.Errorf("failed to create temporary worktree: %w", err)
	}
	cleanup := func() {
		_ = os.RemoveAll(worktreeDir)
	}

	options := &git.CloneOptions{
		URL:  cloneURL,
		Auth: dataCenterAuth(username, token),
	}
	if singleBranch && ref != "" {
		options.ReferenceName = plumbing.NewBranchReferenceName(ref)
		options.SingleBranch = true
		options.Depth = 1
	}
	repository, err := git.PlainCloneContext(ctx, worktreeDir, false, options)
	if err != nil {
		cleanup()
		return nil, "", nil, fmt.Errorf("failed to clone Bitbucket repository: %w", err)
	}
	return repository, worktreeDir, cleanup, nil
}

func dataCenterAuth(username, token string) *githttp.BasicAuth {
	if username == "" {
		username = "x-token-auth"
	}
	return &githttp.BasicAuth{Username: username, Password: token}
}

func validateCloneURL(value string) error {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return fmt.Errorf("Bitbucket clone URL must be HTTPS and must not contain credentials")
	}
	return nil
}

func validateBranch(branch string) error {
	if branch == "" || strings.HasPrefix(branch, "-") || strings.Contains(branch, "..") ||
		strings.ContainsAny(branch, " ~^:?*[\\\x00\n\r\t") || strings.HasSuffix(branch, "/") ||
		strings.HasSuffix(branch, ".") || strings.Contains(branch, "//") {
		return fmt.Errorf("invalid Bitbucket branch")
	}
	return nil
}

func ensureWithin(root, candidate string) error {
	relative, err := filepath.Rel(root, candidate)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("unsafe repository path")
	}
	return nil
}
