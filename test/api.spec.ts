import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ProfileRepository } from '../src/profile/profile.repository';

let app: INestApplication;
const calls = { skills: 0, links: 0, experience: 0, projects: 0 };
const repository = {
  findProfile: async () => ({
    id: 'main',
    name: 'Test Developer',
    description: 'Test profile',
  }),
  findSkills: async () => {
    calls.skills++;
    return [{ id: 'ts', profileId: 'main', name: 'TypeScript' }];
  },
  findLinks: async () => {
    calls.links++;
    return [];
  },
  findExperience: async () => {
    calls.experience++;
    return [];
  },
  findProjects: async () => {
    calls.projects++;
    return [];
  },
};

before(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ $queryRaw: async () => [{ value: 1 }] })
    .overrideProvider(ProfileRepository)
    .useValue(repository)
    .compile();
  app = module.createNestApplication();
  await app.init();
});
after(async () => {
  await app?.close();
});

test('scalar query does not read any collections', async () => {
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: '{ profile { name description } }' })
    .expect(200);
  assert.equal(response.body.errors, undefined);
  assert.equal(response.body.data.profile.name, 'Test Developer');
  assert.deepEqual(calls, { skills: 0, links: 0, experience: 0, projects: 0 });
});

test('aliases reuse the relation cache only within one request', async () => {
  const query = '{ profile { a: skills { name } b: skills { name } } }';
  for (let count = 1; count <= 2; count++) {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200);
    assert.equal(response.body.errors, undefined);
    assert.deepEqual(response.body.data.profile.a, [{ name: 'TypeScript' }]);
    assert.deepEqual(
      response.body.data.profile.a,
      response.body.data.profile.b,
    );
    assert.equal(calls.skills, count);
  }
  assert.equal(calls.projects + calls.links + calls.experience, 0);
});

test('Sandbox and readiness endpoint are available', async () => {
  const sandbox = await request(app.getHttpServer())
    .get('/graphql')
    .set('Accept', 'text/html')
    .expect(200);
  assert.match(sandbox.text, /apollo/i);
  await request(app.getHttpServer())
    .get('/health')
    .expect(200, { status: 'ok' });
});
