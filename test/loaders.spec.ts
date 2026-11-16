import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectionLoader } from '../src/profile/profile.loaders';

test('batches keys, preserves their order, caches duplicates and returns empty collections', async () => {
  const batches: (readonly string[])[] = [];
  const loader = collectionLoader(async (ids) => {
    batches.push(ids);
    return [
      { profileId: 'b', name: 'second' },
      { profileId: 'a', name: 'first' },
    ];
  });
  const results = await Promise.all([
    loader.load('a'),
    loader.load('b'),
    loader.load('a'),
    loader.load('missing'),
  ]);
  assert.deepEqual(batches, [['a', 'b', 'missing']]);
  assert.deepEqual(
    results.map((rows) => rows.map((row) => row.name)),
    [['first'], ['second'], ['first'], []],
  );
});

test('independent request loaders do not share cached data', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return [{ profileId: 'main' }];
  };
  await collectionLoader(fetch).load('main');
  await collectionLoader(fetch).load('main');
  assert.equal(calls, 2);
});
