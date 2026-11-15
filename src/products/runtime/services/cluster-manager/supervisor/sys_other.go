//go:build !linux

package supervisor

import "syscall"

func DisableDumping() error {
	return nil
}

func workerProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true}
}
