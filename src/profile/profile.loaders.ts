import DataLoader from 'dataloader';
import { ProfileRepository } from './profile.repository';

export function collectionLoader<T extends { profileId: string }>(
  fetch: (ids: readonly string[]) => Promise<T[]>,
): DataLoader<string, T[]> {
  return new DataLoader(async (ids) => {
    const rows = await fetch(ids);
    const groups = new Map<string, T[]>();
    for (const row of rows) {
      const group = groups.get(row.profileId) ?? [];
      group.push(row);
      groups.set(row.profileId, group);
    }
    return ids.map((id) => groups.get(id) ?? []);
  });
}

// A new instance is created for each HTTP request; caches never cross requests.
export function createProfileLoaders(repository: ProfileRepository) {
  return {
    links: collectionLoader((ids) => repository.findLinks(ids)),
    skills: collectionLoader((ids) => repository.findSkills(ids)),
    experience: collectionLoader((ids) => repository.findExperience(ids)),
    projects: collectionLoader((ids) => repository.findProjects(ids)),
  };
}

export interface ProfileContext {
  loaders: ReturnType<typeof createProfileLoaders>;
}
