import { fileURLToPath } from 'node:url';
import { startServer } from './server';
const backend = await startServer({ rootDir: fileURLToPath(new URL('.', import.meta.url)), development: process.env.NODE_ENV !== 'production', port: Number(process.env.PORT || 3000) });
console.log(`TK Script Generator: ${backend.url}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void backend.close().then(() => process.exit(0)); });
