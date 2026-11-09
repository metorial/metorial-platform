package gitremote

import (
	"bytes"
	"errors"
	"testing"
)

func TestParseAdvertisement(t *testing.T) {
	sha := "1111111111111111111111111111111111111111"
	service := pkt("# service=git-upload-pack\n") + "0000"
	v2 := service + pkt("version 2\n") + pkt("ls-refs=unborn\n") + pkt("fetch=shallow filter\n")

	tests := []struct {
		name    string
		body    string
		version int
		refs    map[string]string
		wantErr error
	}{
		{
			name:    "v0 refs",
			body:    service + pkt(sha+" refs/heads/main\x00shallow filter\n") + pkt(sha+" refs/tags/v1\n") + "0000",
			version: 0,
			refs:    map[string]string{"refs/heads/main": sha, "refs/tags/v1": sha},
		},
		{
			name:    "v2 capabilities",
			body:    v2 + "0000",
			version: 2,
			refs:    map[string]string{},
		},
		{
			name:    "empty ref name after a double space",
			body:    pkt(ZeroSHA+"  refs/heads/main\x00report-status\n") + "0000",
			wantErr: ErrProtocol,
		},
		{
			name:    "empty ref name on a later line",
			body:    pkt(sha+" refs/heads/main\x00report-status\n") + pkt(sha+"  \n") + "0000",
			wantErr: ErrProtocol,
		},
		{
			name:    "ref name with a NUL",
			body:    pkt(sha+" refs/heads/main\x00report-status\n") + pkt(sha+" refs/heads/a\x00b\n") + "0000",
			wantErr: ErrProtocol,
		},
		{
			name:    "v0 advertisement without a flush",
			body:    pkt(sha + " refs/heads/main\x00report-status\n"),
			wantErr: ErrProtocol,
		},
		{
			name:    "v2 advertisement without a flush",
			body:    v2,
			wantErr: ErrProtocol,
		},
		{
			name:    "v2 advertisement cut inside a packet",
			body:    v2 + "0040fetch",
			wantErr: ErrProtocol,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adv, err := ParseAdvertisement(bytes.NewReader([]byte(tt.body)), ServiceUploadPack)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if adv.Version != tt.version {
				t.Fatalf("version = %d, want %d", adv.Version, tt.version)
			}
			if len(adv.Refs) != len(tt.refs) {
				t.Fatalf("refs = %v, want %v", adv.Refs, tt.refs)
			}
			for name, want := range tt.refs {
				if adv.Refs[name] != want {
					t.Fatalf("refs[%q] = %q, want %q", name, adv.Refs[name], want)
				}
			}
		})
	}
}
