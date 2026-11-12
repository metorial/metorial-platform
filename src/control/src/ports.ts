import * as commands from './process';

let gracefulTimeout = 3000;
let killTimeout = 2000;
let pollInterval = 100;

interface Listener {
  pid: number;
  command: string;
  port: number;
}

export let listeningProcesses = async (ports: number[], cwd: string) => {
  let listeners: Listener[] = [];

  for (let port of new Set(ports)) {
    let child = commands.spawn(
      'lsof',
      ['-nP', '-a', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'],
      cwd,
      {},
      false,
      true
    );
    let stderr = '';
    child.stderr?.on('data', chunk => (stderr += chunk.toString()));
    child.stdin?.end();

    let output: string;

    try {
      output = await commands.wait(child, 'lsof', true);
    } catch (error) {
      if (error instanceof commands.ProcessError && error.code === 1 && !stderr.trim())
        continue;

      throw new Error(`could not check listeners on port ${port}: ${error}`, { cause: error });
    }

    let pid: number | undefined;

    for (let line of output.split('\n')) {
      if (/^p\d+$/.test(line)) pid = Number(line.slice(1));
      else if (line.startsWith('c') && pid)
        listeners.push({ pid, command: line.slice(1), port });
    }
  }

  return listeners;
};

export let clearServicePorts = async (
  ports: number[],
  cwd: string,
  log: (message: string) => void,
  managedProcessGroups: () => number[] = () => []
) => {
  let listeners = await listeningProcesses(ports, cwd);
  if (!listeners.length) return;

  let managed = new Set(managedProcessGroups());
  let protectedPids = new Set(managed);

  if (managed.size) {
    let processes = await commands.output('ps', ['-axo', 'pid=,pgid='], cwd);

    for (let line of processes.split('\n')) {
      let [pid, group] = line.trim().split(/\s+/).map(Number);
      if (pid && group && managed.has(group)) protectedPids.add(pid);
    }
  }

  listeners = listeners.filter(listener => !protectedPids.has(listener.pid));
  if (!listeners.length) return;
  if (listeners.some(listener => listener.pid === process.pid))
    throw new Error('refusing to terminate the control process to free a service port');

  let signal = (targets: Listener[], value: NodeJS.Signals) => {
    for (let listener of targets)
      log(
        `port ${listener.port} is in use by ${listener.command} (pid ${listener.pid}); sending ${value} before starting the service`
      );

    for (let pid of new Set(targets.map(listener => listener.pid))) {
      commands.checkInterrupted();

      try {
        process.kill(pid, value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
  };
  let remaining = async () =>
    (await listeningProcesses(ports, cwd)).filter(
      listener => !protectedPids.has(listener.pid)
    );

  let waitForRelease = async (timeout: number) => {
    let deadline = Date.now() + timeout;
    let active = await remaining();

    while (active.length && Date.now() < deadline) {
      await commands.delay(pollInterval);
      active = await remaining();
    }

    return active;
  };

  signal(listeners, 'SIGTERM');
  let active = await waitForRelease(gracefulTimeout);
  let originalPids = new Set(listeners.map(listener => listener.pid));
  let stubborn = active.filter(listener => originalPids.has(listener.pid));

  if (stubborn.length) {
    signal(stubborn, 'SIGKILL');
    active = await waitForRelease(killTimeout);
  }

  if (active.length)
    throw new Error(
      `service ports are still in use: ${active.map(listener => `${listener.port} (pid ${listener.pid})`).join(', ')}`
    );

  log(
    `freed service port(s): ${[...new Set(listeners.map(listener => listener.port))].join(', ')}`
  );
};
