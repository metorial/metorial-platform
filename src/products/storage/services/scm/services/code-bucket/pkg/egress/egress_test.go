package egress

import (
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"syscall"
	"testing"
	"time"
)

func setAllowPrivateNetworks(t *testing.T, allow bool) {
	t.Helper()

	previous := PrivateNetworksAllowed()
	AllowPrivateNetworks(allow)
	t.Cleanup(func() { AllowPrivateNetworks(previous) })
}

func TestIsPublicAddr(t *testing.T) {
	public := []string{
		"1.1.1.1",
		"8.8.8.8",
		"140.82.112.3",
		"172.15.255.255",
		"172.32.0.1",
		"192.167.255.255",
		"100.63.255.255",
		"100.128.0.1",
		"::ffff:140.82.112.3",
		"2606:4700:4700::1111",
		"2a00:1450:4001:81b::200e",
	}
	for _, value := range public {
		if !IsPublicAddr(netip.MustParseAddr(value)) {
			t.Errorf("expected %s to be public", value)
		}
	}

	private := []string{
		"0.0.0.0",
		"0.1.2.3",
		"10.0.0.1",
		"10.255.255.255",
		"100.64.0.1",
		"100.127.255.255",
		"127.0.0.1",
		"127.255.255.254",
		"169.254.169.254",
		"169.254.170.2",
		"172.16.0.1",
		"172.31.255.255",
		"192.0.0.1",
		"192.0.2.1",
		"192.88.99.1",
		"192.168.1.1",
		"198.18.0.1",
		"198.19.255.255",
		"198.51.100.1",
		"203.0.113.1",
		"224.0.0.1",
		"239.255.255.255",
		"240.0.0.1",
		"255.255.255.255",
		"::",
		"::1",
		"::ffff:127.0.0.1",
		"::ffff:10.0.0.1",
		"::ffff:169.254.169.254",
		"64:ff9b::a00:1",
		"64:ff9b:1::1",
		"100::1",
		"2001::1",
		"2001:db8::1",
		"2002:a00:1::1",
		"fc00::1",
		"fd00:ec2::254",
		"fe80::1",
		"fe80::1%eth0",
		"fec0::1",
		"ff02::1",
	}
	for _, value := range private {
		if IsPublicAddr(netip.MustParseAddr(value)) {
			t.Errorf("expected %s to be refused", value)
		}
	}

	if IsPublicAddr(netip.Addr{}) {
		t.Error("expected the zero address to be refused")
	}
}

func TestDialControlRefusesNonPublicAddresses(t *testing.T) {
	setAllowPrivateNetworks(t, false)

	var conn syscall.RawConn
	for _, address := range []string{
		"127.0.0.1:443",
		"10.0.0.5:8080",
		"169.254.169.254:80",
		"[::1]:443",
		"[fe80::1%eth0]:443",
		"[::ffff:192.168.0.1]:443",
		"internal.example:443",
		"127.0.0.1",
		"",
	} {
		if err := dialControl("tcp", address, conn); !errors.Is(err, ErrAddressNotAllowed) {
			t.Errorf("dialControl(%q) returned %v, want ErrAddressNotAllowed", address, err)
		}
	}

	for _, address := range []string{"140.82.112.3:443", "[2606:4700:4700::1111]:443"} {
		if err := dialControl("tcp", address, conn); err != nil {
			t.Errorf("dialControl(%q) returned %v, want nil", address, err)
		}
	}
}

func TestDialControlAllowsEverythingWhenPrivateNetworksAreAllowed(t *testing.T) {
	setAllowPrivateNetworks(t, true)

	var conn syscall.RawConn
	for _, address := range []string{"127.0.0.1:443", "10.0.0.5:8080", "[::1]:443", "140.82.112.3:443"} {
		if err := dialControl("tcp", address, conn); err != nil {
			t.Errorf("dialControl(%q) returned %v, want nil", address, err)
		}
	}
}

func TestPrivateNetworksAreRefusedUntilAllowed(t *testing.T) {
	if PrivateNetworksAllowed() {
		t.Fatal("expected private networks to be refused before the policy is set")
	}
}

func okServer(t *testing.T) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("internal"))
	}))
	t.Cleanup(server.Close)

	return server
}

func TestClientRefusesLoopbackServers(t *testing.T) {
	setAllowPrivateNetworks(t, false)
	server := okServer(t)

	_, port, err := net.SplitHostPort(server.Listener.Addr().String())
	if err != nil {
		t.Fatalf("split address: %v", err)
	}

	client := &http.Client{Transport: NewTransport(), Timeout: 10 * time.Second}
	for _, url := range []string{server.URL, "http://localhost:" + port} {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			t.Fatalf("expected the request to %s to be refused", url)
		}
		if !errors.Is(err, ErrAddressNotAllowed) {
			t.Fatalf("request to %s failed with %v, want ErrAddressNotAllowed", url, err)
		}
	}
}

func TestClientReachesLoopbackServersWhenPrivateNetworksAreAllowed(t *testing.T) {
	setAllowPrivateNetworks(t, true)
	server := okServer(t)

	client := &http.Client{Transport: NewTransport(), Timeout: 10 * time.Second}
	resp, err := client.Get(server.URL)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status %d", resp.StatusCode)
	}
}

func TestRedirectTargetsAreCheckedWhenTheyAreDialled(t *testing.T) {
	setAllowPrivateNetworks(t, false)

	internal := okServer(t)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, internal.URL+"/secret", http.StatusFound)
	}))
	t.Cleanup(provider.Close)

	providerAddress := provider.Listener.Addr().String()
	dialer := NewDialer()
	dialer.Control = func(network, address string, conn syscall.RawConn) error {
		if address == providerAddress {
			return nil
		}
		return dialControl(network, address, conn)
	}

	transport := NewTransport()
	transport.DialContext = dialer.DialContext
	client := &http.Client{Transport: transport, Timeout: 10 * time.Second}

	resp, err := client.Get(provider.URL)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected the redirect to the internal server to be refused")
	}
	if !errors.Is(err, ErrAddressNotAllowed) {
		t.Fatalf("redirect failed with %v, want ErrAddressNotAllowed", err)
	}
}

func TestResolveAllowPrivateNetworks(t *testing.T) {
	cases := []struct {
		name    string
		env     map[string]string
		want    bool
		wantErr bool
	}{
		{name: "cloud default", env: map[string]string{}, want: false},
		{name: "explicit cloud edition", env: map[string]string{"METORIAL_EDITION": "cloud"}, want: false},
		{name: "on-prem default", env: map[string]string{"METORIAL_EDITION": "on-prem"}, want: true},
		{name: "enabled in cloud", env: map[string]string{"ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS": "true"}, want: true},
		{name: "disabled on-prem", env: map[string]string{"METORIAL_EDITION": "on-prem", "ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS": "false"}, want: false},
		{name: "invalid value", env: map[string]string{"METORIAL_EDITION": "on-prem", "ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS": "yes"}, wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ResolveAllowPrivateNetworks(func(key string) string { return tc.env[key] })
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %t, want %t", got, tc.want)
			}
		})
	}
}
