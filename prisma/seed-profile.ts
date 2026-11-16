import { PrismaClient } from '../src/generated/prisma/client';
import { PROFILE_ID } from '../src/profile/profile.constants';
import { profileData } from './profile.data';

export async function seedProfile(db: PrismaClient) {
  const { links, skills, experience, projects, ...profile } = profileData;
  await db.$transaction(async (tx) => {
    // Serialize concurrent startup seeds for this singleton profile.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(712643)`;
    await tx.profile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...profile },
      update: profile,
    });
    await tx.profileLink.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.skill.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.experience.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.project.deleteMany({ where: { profileId: PROFILE_ID } });
    await tx.profile.update({
      where: { id: PROFILE_ID },
      data: {
        links: { create: links },
        skills: { create: skills },
        experience: { create: experience },
        projects: { create: projects },
      },
    });
  });
}
