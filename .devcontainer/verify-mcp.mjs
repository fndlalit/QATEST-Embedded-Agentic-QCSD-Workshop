// Real stdio handshake; no provider credentials and no paid model calls.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const server = spawn('aqe-mcp', [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, AQE_WORKERS_ENABLED: 'false' },
});
let nextId = 0;
const pending = new Map();
const lines = createInterface({ input: server.stdout });
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const waiter = pending.get(message.id);
  if (waiter) { pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); }
});
server.stderr.resume();
server.on('error', error => { for (const waiter of pending.values()) waiter.reject(error); });
server.on('exit', code => { for (const waiter of pending.values()) waiter.reject(new Error(`MCP exited: ${code}`)); });
function request(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}
const deadline = setTimeout(() => { console.error('MCP handshake timed out'); server.kill('SIGKILL'); process.exitCode = 1; }, 60000);
try {
  await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'qatest-embedded-readiness', version: '1.0.0' } });
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const tools = [];
  let cursor;
  do {
    const result = await request('tools/list', cursor ? { cursor } : {});
    tools.push(...result.tools);
    cursor = result.nextCursor;
  } while (cursor);
  const query = tools.find(t => t.name === 'memory_query');
  if (!query) throw new Error('AQE memory_query tool missing');
  console.log(`AQE MCP handshake and tools/list: OK (${tools.length} tools)`);
  const memory = await request('tools/call', { name: 'memory_query', arguments: { pattern: 'block transfer retry', semantic: true, limit: 2 } });
  if (memory.isError) throw new Error(`MCP memory_query failed: ${JSON.stringify(memory.content)}`);
  const payload = JSON.parse(memory.content.find(c => c.type === 'text').text);
  if (!payload.success || !Array.isArray(payload.data?.entries)) throw new Error(`MCP memory query failed: ${JSON.stringify(payload)}`);
  console.log(`AQE MCP memory_query protocol: OK (${payload.data.entries.length} entries returned)`);
  if (!payload.data.entries.length) {
    console.warn('Note: the memory query returned no entries. That is expected before the exercises have stored anything.');
    if (process.argv.includes('--require-recall')) process.exitCode = 1;
  }
} finally {
  clearTimeout(deadline);
  lines.close();
  server.stdin.end();
  server.kill();
}
