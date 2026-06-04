import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('CLIENT_SECRET'),
      callbackURL: `${config.get<string>('APP_URL', 'http://localhost:5000')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails: { value: string }[]; displayName: string },
    done: VerifyCallback,
  ) {
    const { id, emails, displayName } = profile;
    done(null, {
      oauth_subject: id,
      oauth_provider: 'google',
      email: emails[0].value,
      username: displayName,
    });
  }
}
