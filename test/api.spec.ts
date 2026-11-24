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
let databaseFailure: Error | undefined;
const repository = {
  findProfile: async () => {
    if (databaseFailure) throw databaseFailure;
    return {
      id: 'main',
      name: 'Test Developer',
      description: 'Test profile',
    };
  },
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
    .useValue({
      $queryRaw: async () => {
        if (databaseFailure) throw databaseFailure;
        return [{ value: 1 }];
      },
    })
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

test('database failures are redacted and readiness recovers', async () => {
  databaseFailure = new Error(
    'Invalid prisma.profile.findUnique(): private-db.internal',
  );
  try {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ profile { name } }' })
      .expect(200);
    assert.equal(response.body.data.profile, null);
    assert.equal(response.body.errors[0].message, 'Internal server error');
    assert.deepEqual(response.body.errors[0].extensions, {
      code: 'INTERNAL_SERVER_ERROR',
    });
    assert.doesNotMatch(
      JSON.stringify(response.body),
      /prisma|private-db|stacktrace/,
    );
    await request(app.getHttpServer()).get('/health').expect(503, {
      message: 'Database unavailable',
      error: 'Service Unavailable',
      statusCode: 503,
    });
  } finally {
    databaseFailure = undefined;
  }
  await request(app.getHttpServer())
    .get('/health')
    .expect(200, { status: 'ok' });
});

test('GraphQL validation errors remain useful to clients', async () => {
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: '{ profile { unknownField } }' })
    .expect(400);
  assert.equal(
    response.body.errors[0].extensions.code,
    'GRAPHQL_VALIDATION_FAILED',
  );
  assert.match(response.body.errors[0].message, /unknownField/);
});
