import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli.ts', 'src/mcp.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Native module loads from agent/node_modules at runtime (Node ABI).
  external: ['better-sqlite3'],
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
  // Allow bundled CJS deps to call require() under ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);"
  }
})

console.log('Built dist/cli.js and dist/mcp.js')
