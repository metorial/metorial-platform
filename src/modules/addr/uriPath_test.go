package addr

import (
	"testing"
)

func TestReplaceURIPath(t *testing.T) {
	tests := []struct {
		name            string
		uriStr          string
		newPathAndQuery string
		want            string
		wantErr         bool
	}{
		{
			name:            "replace path only",
			uriStr:          "https://example.com/old/path?foo=bar",
			newPathAndQuery: "/new/path",
			want:            "https://example.com/new/path",
			wantErr:         false,
		},
		{
			name:            "replace path and query",
			uriStr:          "https://example.com/old/path?foo=bar",
			newPathAndQuery: "/another/path?baz=qux",
			want:            "https://example.com/another/path?baz=qux",
			wantErr:         false,
		},
		{
			name:            "replace with empty path",
			uriStr:          "https://example.com/old/path?foo=bar",
			newPathAndQuery: "",
			want:            "https://example.com",
			wantErr:         false,
		},
		{
			name:            "replace with only query",
			uriStr:          "https://example.com/old/path?foo=bar",
			newPathAndQuery: "?new=val",
			want:            "https://example.com?new=val",
			wantErr:         false,
		},
		{
			name:            "invalid URI",
			uriStr:          "://bad_uri",
			newPathAndQuery: "/path",
			want:            "",
			wantErr:         true,
		},
		{
			name:            "no query in original, add query",
			uriStr:          "https://example.com/old/path",
			newPathAndQuery: "/new/path?x=1",
			want:            "https://example.com/new/path?x=1",
			wantErr:         false,
		},
		{
			name:            "no query in original, no query in new",
			uriStr:          "https://example.com/old/path",
			newPathAndQuery: "/new/path",
			want:            "https://example.com/new/path",
			wantErr:         false,
		},
		{
			name:            "root path",
			uriStr:          "https://example.com/old/path?foo=bar",
			newPathAndQuery: "/?a=b",
			want:            "https://example.com/?a=b",
			wantErr:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ReplaceURIPath(tt.uriStr, tt.newPathAndQuery)
			if (err != nil) != tt.wantErr {
				t.Errorf("ReplaceURIPath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ReplaceURIPath() = %v, want %v", got, tt.want)
			}
		})
	}
}
