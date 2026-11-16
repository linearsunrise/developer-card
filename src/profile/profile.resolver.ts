import {
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  Profile,
  ProfileLink,
  Skill,
  Experience,
  Project,
} from './profile.models';
import { ProfileService } from './profile.service';
import { ProfileContext } from './profile.loaders';

@Resolver(() => Profile)
export class ProfileResolver {
  constructor(private readonly service: ProfileService) {}

  @Query(() => Profile, { nullable: true })
  profile() {
    return this.service.getProfile();
  }

  @ResolveField(() => [ProfileLink])
  links(@Parent() profile: Profile, @Context() context: ProfileContext) {
    return context.loaders.links.load(profile.id);
  }
  @ResolveField(() => [Skill])
  skills(@Parent() profile: Profile, @Context() context: ProfileContext) {
    return context.loaders.skills.load(profile.id);
  }
  @ResolveField(() => [Experience])
  experience(@Parent() profile: Profile, @Context() context: ProfileContext) {
    return context.loaders.experience.load(profile.id);
  }
  @ResolveField(() => [Project])
  projects(@Parent() profile: Profile, @Context() context: ProfileContext) {
    return context.loaders.projects.load(profile.id);
  }
}
