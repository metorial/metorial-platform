// Interop fixture: an ldrpc server driven by interop/interop.test.ts through the real
// TypeScript @lowerdeck/rpc-client.
package main

import (
	"context"
	"crypto/ed25519"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
)

type getInput struct {
	BucketID string `json:"bucketId"`
}

func (in *getInput) Validate() error {
	if in.BucketID == "" {
		return ldrpc.ValidationErrors{{Code: "required", Message: "bucketId is required", Path: []string{"bucketId"}}}
	}
	return nil
}

type bucket struct {
	ID        string            `json:"id"`
	CreatedAt time.Time         `json:"createdAt"`
	ExpiresAt *time.Time        `json:"expiresAt"`
	Labels    map[string]string `json:"labels"`
	Caller    string            `json:"caller,omitempty"`
}

type echoItem struct {
	At time.Time `json:"at"`
}

type echoPayload struct {
	At    time.Time  `json:"at"`
	Items []echoItem `json:"items"`
	Big   int64      `json:"big"`
	Note  *string    `json:"note,omitempty"`
}

func newServer(path string, auth ldrpc.AuthenticateFunc) *ldrpc.Server {
	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: path, Authenticate: auth})

	srv.Handle("bucket:get", ldrpc.Unary(func(ctx context.Context, in *getInput) (*bucket, error) {
		if in.BucketID == "missing" {
			return nil, ldrpc.NotFoundError("bucket", in.BucketID)
		}
		caller := ""
		if c, ok := ldrpc.CallInfoFromContext(ctx).Auth.(ldrpc.Ed25519Caller); ok {
			caller = c.KeyID
		}
		return &bucket{
			ID:        in.BucketID,
			CreatedAt: time.UnixMilli(1_700_000_000_123),
			Labels:    map[string]string{"env": "test"},
			Caller:    caller,
		}, nil
	}))

	srv.Handle("bucket:echo", ldrpc.Unary(func(ctx context.Context, in *echoPayload) (*echoPayload, error) {
		return in, nil
	}))

	srv.Handle("bucket:void", ldrpc.Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) {
		return nil, nil
	}))

	srv.Handle("bucket:empty", ldrpc.Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) {
		return &struct{}{}, nil
	}))

	return srv
}

func main() {
	publicKey, err := ldrpc.ParseEd25519PublicJWK([]byte(os.Getenv("ED25519_PUBLIC_JWK")))
	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()
	newServer("/rpc", nil).Mount(mux)
	newServer("/signed", ldrpc.HMACAuth(func(r *http.Request) (string, error) {
		return "shared-secret", nil
	})).Mount(mux)
	newServer("/ed25519", ldrpc.Ed25519Auth("go-interop", func(ctx context.Context, keyID string) (ed25519.PublicKey, error) {
		if keyID != "ts-caller" {
			return nil, fmt.Errorf("unknown key %q", keyID)
		}
		return publicKey, nil
	})).Mount(mux)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	fmt.Printf("listening http://%s\n", listener.Addr())

	if err := http.Serve(listener, mux); err != nil {
		panic(err)
	}
}
