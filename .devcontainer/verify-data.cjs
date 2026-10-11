// Check the persisted tutorial data read-only, straight from SQLite.
const { execFileSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const db = '.agentic-qe/memory.db';
function query(sql) {
  return JSON.parse(execFileSync('sqlite3', ['-readonly', '-json', db, sql], { encoding: 'utf8' }) || '[]');
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name);
    return e.isDirectory() ? files(file) : /\.ts$/.test(e.name) ? [path.resolve(file)] : [];
  });
}
const sourceFiles = files('src');
const indexed = new Set(query("SELECT file_path FROM hypergraph_nodes WHERE type = 'file'").map(r => r.file_path));
for (const file of sourceFiles) {
  if (!indexed.has(file)) throw new Error(`Source file missing from the graph: ${file}. Run prepare-workshop.sh.`);
}
const [{ n: patterns }] = query('SELECT count(*) AS n FROM qe_patterns');
const [{ n: embedded }] = query('SELECT count(*) AS n FROM qe_pattern_embeddings WHERE dimension = 384 AND length(embedding) > 0');
if (!patterns || !embedded) {
  throw new Error('No embedded patterns in AQE memory: the embedder is not working. See TROUBLESHOOTING.md.');
}
console.log(`${sourceFiles.length} source files indexed; ${patterns} patterns in memory, ${embedded} with 384-dimensional embeddings: OK`);
