import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProfileLink {
  @Field(() => ID) id!: string;
  @Field() label!: string;
  @Field() url!: string;
}

@ObjectType()
export class Skill {
  @Field(() => ID) id!: string;
  @Field() name!: string;
}

@ObjectType()
export class Experience {
  @Field(() => ID) id!: string;
  @Field() company!: string;
  @Field() position!: string;
  @Field(() => GraphQLISODateTime) startDate!: Date;
  @Field(() => GraphQLISODateTime, { nullable: true }) endDate!: Date | null;
  @Field(() => [String]) achievements!: string[];
}

@ObjectType()
export class Project {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() url!: string;
}

@ObjectType()
export class Profile {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() description!: string;
  @Field(() => [ProfileLink]) links!: ProfileLink[];
  @Field(() => [Skill]) skills!: Skill[];
  @Field(() => [Experience]) experience!: Experience[];
  @Field(() => [Project]) projects!: Project[];
}
