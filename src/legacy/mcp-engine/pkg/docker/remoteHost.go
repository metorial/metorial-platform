package docker

import (
	"log"
	"os"
	"path/filepath"
)

var initializedRemoteAddresses = make(map[string]bool)

func initRemoteKey(externalHost, externalHostPrivateKey string) {
	if externalHost == "" || externalHostPrivateKey == "" {
		return
	}

	if initializedRemoteAddresses[externalHost] {
		return
	}
	initializedRemoteAddresses[externalHost] = true

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("failed to get home dir: %v", err)
		return
	}

	sshDir := filepath.Join(homeDir, ".ssh")
	err = os.MkdirAll(sshDir, 0700)
	if err != nil {
		log.Printf("failed to create .ssh dir: %v", err)
		return
	}

	keyPath := filepath.Join(sshDir, "id_rsa_"+externalHost)
	err = os.WriteFile(keyPath, []byte(externalHostPrivateKey), 0600)
	if err != nil {
		log.Printf("failed to write ssh key for %s: %v", externalHost, err)
		return
	}

	configPath := filepath.Join(sshDir, "config")
	configEntry := `
Host ` + externalHost + `
    HostName ` + externalHost + `
    User dockeruser
    IdentityFile ` + keyPath + `
    StrictHostKeyChecking no
`

	f, err := os.OpenFile(configPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("failed to open ssh config: %v", err)
		return
	}
	defer f.Close()

	_, err = f.WriteString(configEntry)
	if err != nil {
		log.Printf("failed to write ssh config: %v", err)
		return
	}

	log.Printf("SSH key for %s initialized at %s", externalHost, keyPath)
}
