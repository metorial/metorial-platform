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
