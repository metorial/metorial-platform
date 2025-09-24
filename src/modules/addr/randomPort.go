package addr

import (
	"fmt"
	"net"
)

func GetRandomPort() (int, error) {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	addr := listener.Addr().(*net.TCPAddr)
	if addr.Port == 0 {
		return 0, fmt.Errorf("failed to get a random port")
	}

	return addr.Port, nil
}
