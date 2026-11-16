import { Injectable } from '@nestjs/common';
import { ProfileRepository } from './profile.repository';
import { PROFILE_ID } from './profile.constants';

@Injectable()
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  // This application publishes one profile. Missing data is represented by null.
  getProfile() {
    return this.repository.findProfile(PROFILE_ID);
  }
}
