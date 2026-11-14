package supervisor

import (
	"syscall"

	"golang.org/x/sys/unix"
)

// DisableDumping keeps the worker, which runs as the same uid, from reading this process's
// memory or environment through /proc or ptrace.
func DisableDumping() error {
	return unix.Prctl(unix.PR_SET_DUMPABLE, 0, 0, 0, 0)
}

func workerProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
}
