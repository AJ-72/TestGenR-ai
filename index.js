// Main entry point for Forge app
console.log(`[INDEX DEBUG] Forge app index loaded at ${new Date().toISOString()}`);

// Export all handlers for Forge to discover
export { run as testgen } from './src/testgen.jsx';
export { handler as resolver } from './src/resolver.js';
export { handler as projectsetting } from './src/projectsetting.jsx';

console.log(`[INDEX DEBUG] All handlers exported successfully`);