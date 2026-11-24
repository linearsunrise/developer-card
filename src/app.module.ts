import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { ProfileModule } from './profile/profile.module';
import { ProfileRepository } from './profile/profile.repository';
import { createProfileLoaders } from './profile/profile.loaders';

@Module({
  imports: [
    DatabaseModule,
    ProfileModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ProfileModule],
      inject: [ProfileRepository],
      useFactory: (repository: ProfileRepository) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: false,
        introspection: true,
        includeStacktraceInErrorResponses: false,
        formatError: (error) =>
          error.extensions?.code === 'INTERNAL_SERVER_ERROR'
            ? {
                ...error,
                message: 'Internal server error',
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              }
            : error,
        plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        context: () => ({ loaders: createProfileLoaders(repository) }),
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
