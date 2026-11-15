export let normalizeCase = (input: string) => {
  return (
    input
      // Replace underscores and hyphens with spaces for easy splitting
      .replace(/[_-]/g, ' ')
      // Insert spaces between lowercase-to-uppercase transitions (camelCase & PascalCase)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Insert spaces between number-letter transitions
      .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
      // Split by spaces and normalize to lowercase
      .split(/\s+/)
      .map(word => word.trim().toLowerCase())
      .filter(Boolean) // Remove empty strings
  );
};
