package addr

import (
	"testing"
)

func TestExtractPort(t *testing.T) {
	tests := []struct {
		address  string
		wantPort int
		wantErr  bool
	}{
		{"localhost:8080", 8080, false},
		{"127.0.0.1:12345", 12345, false},
		{"[::1]:443", 443, false},
		{":9090", 9090, false},
		{"9090", 9090, false},
		{"host:65535", 65535, false},
		{"host:notaport", 0, true},
		{"", 0, true},
		{"host:", 0, true},
		{"[::1]", 0, true},
	}

	for _, tt := range tests {
		port, err := ExtractPort(tt.address)
		if (err != nil) != tt.wantErr {
			t.Errorf("ExtractPort(%q) error = %v, wantErr %v", tt.address, err, tt.wantErr)
			continue
		}
		if port != tt.wantPort {
			t.Errorf("ExtractPort(%q) = %d, want %d", tt.address, port, tt.wantPort)
		}
	}
}
