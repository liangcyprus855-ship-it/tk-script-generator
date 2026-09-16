import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

function harness() {
  const updater: any = new EventEmitter();
  const handlers: any = {};
  const timers: any[] = [];
  const calls: any[] = [];
  updater.checkForUpdates = async () => { calls.push('check'); };
  updater.quitAndInstall = (...args: any[]) => calls.push(args);
  const context: any = vm.createContext({
    require: (id: string) => id === 'electron' ? {
      app: { isPackaged: true, whenReady: () => new Promise(() => {}), on: () => {} },
      ipcMain: { handle: (name: string, handler: any) => { handlers[name] = handler; } }
    } : id === 'electron-updater' ? { autoUpdater: updater } : {},
    process: { env: {} },
    setTimeout: (fn: any, ms: number) => { const timer = { fn, ms, unref() {} }; timers.push(timer); return timer; },
    clearTimeout: () => {},
  });
  vm.runInContext(readFileSync('electron/main.cjs', 'utf8'), context);
  vm.runInContext('configureUpdater()', context);
  return { updater, handlers, timers, calls };
}
test('failed check schedules retry and persists error state for a reloaded renderer', async () => {
  const h = harness();
  h.updater.checkForUpdates = async () => { throw new Error('offline'); };
  await h.handlers['tk:check-update']();
  assert.equal(h.handlers['tk:update-state']().state, 'error');
  assert.equal(h.timers[0].ms, 15000);
  h.updater.checkForUpdates = async () => h.calls.push('retried');
  await h.timers[0].fn();
  assert.ok(h.calls.includes('retried'));
});
test('available event survives subscriber delay; download installs silently once', async () => {
  const h = harness();
  h.updater.emit('update-available', { version: '2.0.0', releaseNotes: 'changes' });
  assert.equal(h.handlers['tk:update-state']().version, '2.0.0');
  h.updater.emit('update-downloaded', { version: '2.0.0' });
  await h.handlers['tk:install-update']();
  await h.handlers['tk:install-update']();
  assert.deepEqual(h.calls, [[true, true]]);
});
