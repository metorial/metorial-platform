package supervisor

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/protocol"
)

type worker struct {
	id     int64
	cmd    *exec.Cmd
	conn   net.Conn
	writer *protocol.Writer
	exited chan struct{}

	killed atomic.Bool

	mu      sync.Mutex
	ready   bool
	crash   *protocol.Frame
	exitErr error
}

func (s *Supervisor) spawnWorker(id int64) (*worker, error) {
	parent, child, err := socketPair()
	if err != nil {
		return nil, err
	}
	defer child.Close()

	conn, err := net.FileConn(parent)
	parent.Close()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(s.cfg.NodeBinary, nodeArgs(s.cfg)...)
	cmd.Dir = s.cfg.BundleDir
	cmd.Env = workerEnv(s.cfg, s.socketPath)
	cmd.ExtraFiles = []*os.File{child}
	cmd.SysProcAttr = workerProcAttr()

	// Plain os.Pipes rather than cmd.StdoutPipe: Wait must not block on grandchildren that
	// inherited stdio and outlive the worker.
	stdoutR, stdoutW, err := os.Pipe()
	if err != nil {
		conn.Close()
		return nil, err
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		conn.Close()
		stdoutR.Close()
		stdoutW.Close()
		return nil, err
	}
	cmd.Stdout, cmd.Stderr = stdoutW, stderrW

	err = cmd.Start()
	stdoutW.Close()
	stderrW.Close()
	if err != nil {
		conn.Close()
		stdoutR.Close()
		stderrR.Close()
		return nil, fmt.Errorf("start worker: %w", err)
	}

	w := &worker{id: id, cmd: cmd, conn: conn, writer: protocol.NewWriter(conn), exited: make(chan struct{})}

	go func() { defer stdoutR.Close(); s.out.pipeLines("stdout", stdoutR) }()
	go func() { defer stderrR.Close(); s.out.pipeLines("stderr", stderrR) }()

	framesDone := make(chan struct{})
	go func() {
		defer close(framesDone)
		s.readFrames(w)
	}()
	go func() {
		err := cmd.Wait()

		// Frames written just before the exit are still in the socket buffer. Children
		// that inherited the control socket would keep it open forever, so don't wait long.
		select {
		case <-framesDone:
		case <-time.After(250 * time.Millisecond):
		}
		_ = conn.Close()
		<-framesDone

		w.mu.Lock()
		w.exitErr = err
		w.mu.Unlock()
		close(w.exited)
		s.onWorkerExit(w)
	}()

	return w, nil
}

func (w *worker) send(f *protocol.Frame) error {
	return w.writer.Write(f)
}

// kill takes down the worker's whole process group, including anything it spawned.
func (w *worker) alive() bool {
	if w.killed.Load() {
		return false
	}
	select {
	case <-w.exited:
		return false
	default:
		return true
	}
}

func (w *worker) kill() {
	if w.cmd.Process == nil {
		return
	}
	_ = syscall.Kill(-w.cmd.Process.Pid, syscall.SIGKILL)
	_ = w.cmd.Process.Kill()
}

func (w *worker) crashFrame() *protocol.Frame {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.crash
}

func (w *worker) exitReason() string {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.crash != nil && w.crash.Message != "" {
		return w.crash.Message
	}
	if w.exitErr != nil {
		return w.exitErr.Error()
	}
	return "worker exited"
}

func (s *Supervisor) readFrames(w *worker) {
	reader := bufio.NewReaderSize(w.conn, 64<<10)
	for {
		f, err := protocol.Read(reader)
		if err != nil {
			return
		}

		switch f.Type {
		case protocol.TypeReady:
			s.onWorkerReady(w)
		case protocol.TypeResult:
			s.onResult(f)
		case protocol.TypeLog:
			s.onLog(f)
		case protocol.TypeLookup:
			go s.onLookup(w, f)
		case protocol.TypeCrash:
			w.mu.Lock()
			w.crash = f
			w.mu.Unlock()
			s.log.Error("worker crashed", "workerId", w.id, "phase", f.Phase, "message", f.Message, "stack", f.Stack)
		default:
			s.log.Warn("unknown worker frame", "type", f.Type)
		}
	}
}

func socketPair() (*os.File, *os.File, error) {
	syscall.ForkLock.RLock()
	defer syscall.ForkLock.RUnlock()

	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, nil, err
	}
	syscall.CloseOnExec(fds[0])
	syscall.CloseOnExec(fds[1])
	return os.NewFile(uintptr(fds[0]), "control"), os.NewFile(uintptr(fds[1]), "control-worker"), nil
}
