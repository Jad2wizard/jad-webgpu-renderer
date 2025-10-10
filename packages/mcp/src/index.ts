/**
 * MCP Server package for Node.js with TypeScript
 * This package provides MCP (Model Context Protocol) server functionality
 */

export function hello(): string {
  return 'MCP server package ready';
}

// If executed directly after build, simple log for sanity check
if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log(hello());
}