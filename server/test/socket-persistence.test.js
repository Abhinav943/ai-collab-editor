import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { persistDocument } from '../src/sockets/index.js';

test('persists the current Yjs document content', async () => {
  const fileId = 'file-1';
  const doc = new Y.Doc();
  doc.getText(`file:${fileId}`).insert(0, 'persisted text');
  let update;
  await persistDocument(fileId, doc, {
    findByIdAndUpdate: async (id, changes) => {
      update = { id, changes };
      return { _id: id, ...changes };
    },
  });
  assert.deepEqual(update, { id: fileId, changes: { content: 'persisted text' } });
});

test('reports a missing database document instead of silently succeeding', async () => {
  await assert.rejects(
    persistDocument('missing', new Y.Doc(), { findByIdAndUpdate: async () => null }),
    /File not found while persisting missing/
  );
});
