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

let app: INestApplication;
let db: PrismaService;

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
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  await app.init();
  db = app.get(PrismaService);
});
after(async () => {
  await app?.close();
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
  assert.equal(profile.experience[0].startDate, '2024-01-01T00:00:00.000Z');
  assert.equal(profile.experience[0].endDate, null);
  assert.deepEqual(
    profile.experience[0].achievements,
    profileData.experience[0].achievements,
  );
  assert.equal(profile.projects[0].url, profileData.projects[0].url);
  await request(app.getHttpServer()).get('/health').expect(200);
});
