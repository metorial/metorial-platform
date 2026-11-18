package doctor

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	objectstorage "github.com/metorial/object-storage/clients/go"
)

const (
	component            = "code-bucket"
	doctorPrefix         = ".metorial-doctor"
	minJWTSecretLength   = 32
	diskWarnFreeRatio    = 0.10
	objectStorageTimeout = 15 * time.Second
	docs                 = "datacenter/operations/doctor#code-bucket"
)

type Config struct {
	Redis         *redis.Client
	ObjectStorage *objectstorage.Client
	Bucket        string
	JWTSecret     string
	EditorAPIURL  string
	PublicURL     string
	RPCAddress    string
	WorkspaceFS   func() (fs.FS, error)
	WorkspaceDir  string
}

func Fingerprint(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:12]
}

func New(config Config) (*doctor.Doctor, error) {
	options := doctor.Options{Component: component, Fingerprints: map[string]string{}}
	if config.JWTSecret != "" {
		options.Fingerprints["code-bucket-jwt-secret"] = Fingerprint(config.JWTSecret)
	}

	d := doctor.New(options)
	if err := d.Register(Checks(config)...); err != nil {
		return nil, err
	}

	return d, nil
}

func Checks(config Config) []doctor.Check {
	return []doctor.Check{
		redisCheck(config.Redis),
		objectStorageCheck(config.ObjectStorage, config.Bucket),
		jwtSecretCheck(config.JWTSecret),
		editorURLCheck(config.EditorAPIURL, config.PublicURL),
		grpcListenerCheck(config.RPCAddress),
		workspaceAssetsCheck(config.WorkspaceFS),
		diskCheck(config.WorkspaceDir),
	}
}

func resolution(summary string, steps ...string) *doctor.Resolution {
	link := docs
	return &doctor.Resolution{Summary: summary, Steps: steps, Docs: &link}
}

func redisCheck(client *redis.Client) doctor.Check {
	return doctor.Check{
		ID:       "redis.connect",
		Title:    "Redis accepts connections",
		Category: doctor.CategoryCache,
		Severity: doctor.SeverityCritical,
		Target:   "redis",
		Run: doctor.Probe("Redis", func(ctx context.Context) error {
			return client.Ping(ctx).Err()
		}, 250*time.Millisecond),
	}
}

func objectStorageCheck(client *objectstorage.Client, bucket string) doctor.Check {
	return doctor.Check{
		ID:       "object-storage.round-trip",
		Title:    "Files can be written to and read from object storage",
		Category: doctor.CategoryStorage,
		Severity: doctor.SeverityCritical,
		Target:   "object-storage",
		Timeout:  objectStorageTimeout,
		Run: func(ctx context.Context, r *doctor.Result) error {
			hostname, _ := os.Hostname()
			key := fmt.Sprintf("%s/%s", doctorPrefix, hostname)
			payload := []byte("metorial doctor " + time.Now().UTC().Format(time.RFC3339Nano))
			started := time.Now()

			if _, err := client.PutObject(bucket, key, payload, nil, nil); err != nil {
				return fmt.Errorf("put into bucket %s: %w", bucket, err)
			}
			defer func() { _ = client.DeleteObject(bucket, key) }()

			object, err := client.GetObject(bucket, key)
			if err != nil {
				return fmt.Errorf("get: %w", err)
			}
			if !bytes.Equal(object.Data, payload) {
				r.Fail("The object read back differs from the one written.", resolution(
					"Check that every object-storage replica uses the same backend and bucket.",
				), nil)
				return nil
			}

			latencyMs := time.Since(started).Milliseconds()
			r.Pass(fmt.Sprintf("Round trip in bucket %s took %dms.", bucket, latencyMs), map[string]any{
				"bucket":    bucket,
				"latencyMs": latencyMs,
			})
			return nil
		},
	}
}

func jwtSecretCheck(secret string) doctor.Check {
	return doctor.Check{
		ID:       "config.jwt-secret",
		Title:    "The JWT secret is configured",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityCritical,
		Run: func(_ context.Context, r *doctor.Result) error {
			if secret == "" {
				r.Fail("CODE_BUCKET_JWT_SECRET is not set.", resolution("Set CODE_BUCKET_JWT_SECRET to the secret scm uses."), nil)
				return nil
			}

			details := map[string]any{"fingerprint": Fingerprint(secret), "length": len(secret)}
			if len(secret) < minJWTSecretLength {
				r.Fail(
					fmt.Sprintf("The JWT secret has %d characters, fewer than %d.", len(secret), minJWTSecretLength),
					resolution("Use a random secret of at least 32 characters, shared with scm."),
					details,
				)
				return nil
			}

			r.Pass("The JWT secret is configured.", details)
			return nil
		},
	}
}

func editorURLCheck(editorURL, publicURL string) doctor.Check {
	return doctor.Check{
		ID:       "config.editor-api-url",
		Title:    "The editor API URL points at this installation",
		Category: doctor.CategoryConfiguration,
		Severity: doctor.SeverityWarning,
		Run: func(_ context.Context, r *doctor.Result) error {
			editorURL = strings.TrimRight(editorURL, "/")
			if editorURL == "" {
				r.Warn("CODE_BUCKET_EDITOR_API_URL is not set, so the browser editor cannot save.",
					resolution("Set CODE_BUCKET_EDITOR_API_URL to <public URL>/code-bucket-api."), nil)
				return nil
			}

			publicURL = strings.TrimRight(publicURL, "/")
			if publicURL == "" {
				r.Skip("METORIAL_PUBLIC_URL is not set.", map[string]any{"editorApiUrl": editorURL})
				return nil
			}

			expected := publicURL + "/code-bucket-api"
			if editorURL != expected {
				r.Warn(
					fmt.Sprintf("CODE_BUCKET_EDITOR_API_URL is %s, expected %s.", editorURL, expected),
					resolution("Remove the CODE_BUCKET_EDITOR_API_URL override, or point it at the public URL."),
					map[string]any{"editorApiUrl": editorURL, "expected": expected},
				)
				return nil
			}

			r.Pass(fmt.Sprintf("The editor saves through %s.", editorURL), nil)
			return nil
		},
	}
}

func loopback(address string) string {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return address
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return net.JoinHostPort(host, port)
}

func grpcListenerCheck(address string) doctor.Check {
	return doctor.Check{
		ID:       "grpc.listener",
		Title:    "The gRPC listener accepts connections",
		Category: doctor.CategoryRuntime,
		Severity: doctor.SeverityCritical,
		Run:      doctor.TCPProbe(loopback(address)),
	}
}

func workspaceAssetsCheck(open func() (fs.FS, error)) doctor.Check {
	return doctor.Check{
		ID:       "workspace.assets",
		Title:    "The browser editor's assets are built in",
		Category: doctor.CategoryRuntime,
		Severity: doctor.SeverityCritical,
		Run: func(_ context.Context, r *doctor.Result) error {
			assets, err := open()
			if err != nil {
				return err
			}

			if _, err := fs.Stat(assets, "index.html"); err != nil {
				r.Fail("The image has no editor assets (index.html is missing).", resolution(
					"Use the released code-bucket image; a local build needs build-workspace.sh first.",
				), nil)
				return nil
			}

			r.Pass("The editor assets are present.", nil)
			return nil
		},
	}
}

func diskCheck(dir string) doctor.Check {
	return doctor.Check{
		ID:       "disk.workspace",
		Title:    "The scratch disk has free space",
		Category: doctor.CategoryStorage,
		Severity: doctor.SeverityWarning,
		Run: func(_ context.Context, r *doctor.Result) error {
			var stat syscall.Statfs_t
			if err := syscall.Statfs(dir, &stat); err != nil {
				return err
			}

			block := uint64(stat.Bsize)
			free, total := stat.Bavail*block, stat.Blocks*block
			ratio := 0.0
			if total > 0 {
				ratio = float64(free) / float64(total)
			}

			percent := float64(int(ratio*1000)) / 10
			details := map[string]any{"path": dir, "freeBytes": free, "totalBytes": total, "freePercent": percent}
			if ratio < diskWarnFreeRatio {
				r.Warn(fmt.Sprintf("Only %.1f%% of the scratch disk is free; zip exports and imports may fail.", percent),
					resolution("Give code-bucket a larger ephemeral volume."), details)
				return nil
			}

			r.Pass(fmt.Sprintf("%.1f%% of the scratch disk is free.", percent), details)
			return nil
		},
	}
}
