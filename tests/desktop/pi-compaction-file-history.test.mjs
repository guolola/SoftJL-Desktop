// Guards the installed Pi patch against reporting denied or unfinished file calls as completed changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBranchEntries } from '@earendil-works/pi-coding-agent';

const issued = (id, name, path) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: { path } }], timestamp: 1 });
const result = (id, isError) => ({ role: 'toolResult', toolCallId: id, toolName: 'write', isError, content: [{ type: 'text', text: isError ? 'Denied' : 'Written' }], timestamp: 2 });
const operations = messages => prepareBranchEntries(messages.map((message, index) => ({ type: 'message', id: String(index), parentId: index ? String(index - 1) : null, timestamp: new Date().toISOString(), message }))).fileOps;

test('only successful file calls enter the upstream compaction file lists', () => {
  const ops = operations([issued('no', 'write', 'denied.txt'), result('no', true), issued('yes', 'write', 'approved.txt'), result('yes', false)]);
  assert.deepEqual([...ops.written], ['approved.txt']);
});
test('a later denied edit cannot erase an earlier confirmed write to the same file', () => {
  const ops = operations([issued('yes', 'write', 'same.txt'), result('yes', false), issued('no', 'edit', 'same.txt'), result('no', true)]);
  assert.deepEqual([...ops.written], ['same.txt']);
  assert.deepEqual([...ops.edited], []);
});
test('pending calls and denied reads remain unconfirmed', () => {
  const ops = operations([issued('pending', 'write', 'pending.txt'), issued('read', 'read', 'private.txt'), result('read', true)]);
  assert.equal(ops.written.size, 0); assert.equal(ops.read.size, 0);
});
test('nested calls use their own outcomes even when their parent fails', () => {
  const ops = operations([{ ...result('script', true), nestedCalls: { complete: false, calls: [
    { id: 'ok', name: 'write', arguments: { path: 'ok.txt' }, status: 'ok' },
    { id: 'no', name: 'write', arguments: { path: 'denied.txt' }, status: 'error' },
    { id: 'pending', name: 'edit', arguments: { path: 'pending.txt' }, status: 'unfinished' },
  ] } }]);
  assert.deepEqual([...ops.written], ['ok.txt']); assert.equal(ops.edited.size, 0);
});
