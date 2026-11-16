import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ProfileRepository {
  constructor(private readonly db: PrismaService) {}

  findProfile(id: string) {
    return this.db.profile.findUnique({ where: { id } });
  }

  findLinks(ids: readonly string[]) {
    return this.db.profileLink.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }
  findSkills(ids: readonly string[]) {
    return this.db.skill.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }
  findExperience(ids: readonly string[]) {
    return this.db.experience.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
    });
  }
  findProjects(ids: readonly string[]) {
    return this.db.project.findMany({
      where: { profileId: { in: [...ids] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }
}
