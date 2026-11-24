import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { seedProfile } from '../prisma/seed-profile';
import { profileData } from '../prisma/profile.data';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { ProfileRepository } from '../src/profile/profile.repository';
import { createProfileLoaders } from '../src/profile/profile.loaders';

let app: INestApplication;
let db: PrismaClient;
const queries: string[] = [];

before(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      'Set TEST_DATABASE_URL to a migrated, disposable test database',
    );
  const databaseName = new URL(url).pathname;
  if (!databaseName.endsWith('_test'))
    throw new Error('Test database name must end with _test');
  process.env.DATABASE_URL = url;
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: [{ emit: 'event', level: 'query' }],
  });
  client.$on('query', (event) => queries.push(event.query));
  db = client;
  await db.$connect();
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(db)
    .compile();
  app = module.createNestApplication();
  await app.init();
});
after(async () => {
  await app?.close();
  await db?.$disconnect();
});

const fullQuery = `{
  profile { name links { url } skills { name }
    experience { company } projects { name } }
}`;

async function measuredQuery(query: string) {
  queries.length = 0;
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query })
    .expect(200);
  assert.equal(response.body.errors, undefined);
  const selects = queries.filter((sql) => /^SELECT\b/i.test(sql.trim()));
  return { data: response.body.data, selects };
}

function assertTables(selects: string[], expected: string[]) {
  const tables = selects.map(
    (sql) => /FROM\s+"public"\."([^"]+)"/i.exec(sql)?.[1],
  );
  assert.deepEqual(tables.sort(), [...expected].sort(), selects.join('\n'));
}

test('real SQL: scalar query reads only Profile; full query reads each relation once', async () => {
  await seedProfile(db);
  const scalar = await measuredQuery('{ profile { name } }');
  assertTables(scalar.selects, ['Profile']);
  const full = await measuredQuery(fullQuery);
  assertTables(full.selects, [
    'Profile',
    'ProfileLink',
    'Skill',
    'Experience',
    'Project',
  ]);
});

test('real SQL: field aliases share one relation query and a new request sees updates', async () => {
  await seedProfile(db);
  const query = '{ profile { a: skills { name } b: skills { name } } }';
  const first = await measuredQuery(query);
  assertTables(first.selects, ['Profile', 'Skill']);
  assert.deepEqual(first.data.profile.a, first.data.profile.b);
  await db.skill.create({
    data: {
      id: 'fresh-skill',
      profileId: 'main',
      name: 'Fresh skill',
      sortOrder: 100,
    },
  });
  try {
    const second = await measuredQuery(query);
    assertTables(second.selects, ['Profile', 'Skill']);
    assert.equal(second.data.profile.a.length, first.data.profile.a.length + 1);
    assert.deepEqual(second.data.profile.a.at(-1), { name: 'Fresh skill' });
  } finally {
    await seedProfile(db);
  }
});

test('real SQL: adding 100 skills does not increase query count', async () => {
  await seedProfile(db);
  await db.skill.createMany({
    data: Array.from({ length: 100 }, (_, i) => ({
      id: `extra-${i}`,
      profileId: 'main',
      name: `Extra ${i}`,
      sortOrder: 100 + i,
    })),
  });
  try {
    const full = await measuredQuery(fullQuery);
    assertTables(full.selects, [
      'Profile',
      'ProfileLink',
      'Skill',
      'Experience',
      'Project',
    ]);
    assert.equal(
      full.data.profile.skills.length,
      profileData.skills.length + 100,
    );
  } finally {
    await seedProfile(db);
  }
});

test('real SQL: collection loader batches different parents and keeps key order', async () => {
  await seedProfile(db);
  await db.profile.create({
    data: {
      id: 'batch-test',
      name: 'Batch test',
      description: '',
      skills: {
        create: { id: 'batch-test-skill', name: 'Other skill', sortOrder: 0 },
      },
    },
  });
  try {
    const loaders = createProfileLoaders(app.get(ProfileRepository));
    queries.length = 0;
    const [other, main, missing] = await Promise.all([
      loaders.skills.load('batch-test'),
      loaders.skills.load('main'),
      loaders.skills.load('missing'),
    ]);
    assertTables(
      queries.filter((sql) => /^SELECT\b/i.test(sql.trim())),
      ['Skill'],
    );
    assert.deepEqual(
      other.map((skill) => skill.name),
      ['Other skill'],
    );
    assert.equal(main.length, profileData.skills.length);
    assert.deepEqual(missing, []);
  } finally {
    await db.profile.delete({ where: { id: 'batch-test' } });
  }
});

test('real SQL: root aliases batch profile lookup and reuse relation loaders', async () => {
  await seedProfile(db);
  const result = await measuredQuery(
    '{ a: profile { skills { name } } b: profile { skills { name } } }',
  );
  assertTables(result.selects, ['Profile', 'Skill']);
  assert.deepEqual(result.data.a, result.data.b);
});

test('missing profile is null; repeated seed reconciles stale data and serves nested GraphQL', async () => {
  await db.profile.deleteMany({ where: { id: 'main' } });
  const empty = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: '{ profile { name } }' })
    .expect(200);
  assert.deepEqual(empty.body, { data: { profile: null } });
  await seedProfile(db);
  await db.skill.create({
    data: {
      id: 'obsolete',
      name: 'obsolete',
      profileId: 'main',
      sortOrder: 99,
    },
  });
  await db.profile.update({ where: { id: 'main' }, data: { name: 'stale' } });
  await seedProfile(db);
  await seedProfile(db);
  assert.equal(await db.profile.count({ where: { id: 'main' } }), 1);
  assert.equal(
    await db.skill.count({ where: { profileId: 'main' } }),
    profileData.skills.length,
  );
  assert.equal(await db.skill.findUnique({ where: { id: 'obsolete' } }), null);
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `{
    profile { name description links { label url } skills { name }
      experience { company position startDate endDate achievements } projects { name url } }
  }`,
    })
    .expect(200);
  assert.equal(response.body.errors, undefined);
  const profile = response.body.data.profile;
  assert.equal(profile.name, profileData.name);
  assert.deepEqual(
    profile.skills.map((skill: { name: string }) => skill.name),
    profileData.skills.map((skill) => skill.name),
  );
  assert.equal(profile.links[0].url, profileData.links[0].url);
  assert.deepEqual(
    profile.experience,
    [...profileData.experience]
      .sort(
        (a, b) =>
          b.startDate.getTime() - a.startDate.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map(({ company, position, startDate, endDate, achievements }) => ({
        company,
        position,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString() ?? null,
        achievements,
      })),
  );
  assert.deepEqual(
    profile.projects,
    [...profileData.projects]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map(({ name, url }) => ({ name, url })),
  );
  await request(app.getHttpServer()).get('/health').expect(200);
});
