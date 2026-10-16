export let executableTargets = (d: {
  names: string[];
  tasks: { task: string; command: string; package: string }[];
}) => [
  ...new Set(
    d.tasks
      .filter(task => d.names.includes(task.task) && task.command !== '<NONEXISTENT>')
      .map(task => task.package)
  )
];

export let taskWorkspaceClosure = (d: {
  names: string[];
  targets: string[];
  tasks: {
    taskId: string;
    task: string;
    package: string;
    directory: string;
    dependencies: string[];
  }[];
}) => {
  let tasks = new Map(d.tasks.map(task => [task.taskId, task]));
  let visited = new Set<string>();
  let workspaces = new Map<string, string>();
  let visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    let task = tasks.get(id);
    if (!task) throw new Error(`Missing Turbo task in test graph: ${id}`);
    if (task.package !== '//') workspaces.set(task.package, task.directory);
    for (let dependency of task.dependencies) visit(dependency);
  };
  for (let task of d.tasks) {
    if (d.targets.includes(task.package) && d.names.includes(task.task)) visit(task.taskId);
  }
  return Object.fromEntries(workspaces);
};
