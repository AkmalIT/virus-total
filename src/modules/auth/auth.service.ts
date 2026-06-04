import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email || !dto.username || !dto.password) {
      throw new BadRequestException(
        'email, username and password are required',
      );
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      password_hash: passwordHash,
      role: dto.role,
    });

    return {
      user: this.toPublicUser(user),
      access_token: await this.issueToken(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (
      !user ||
      !user.password_hash ||
      !(await this.verifyPassword(dto.password, user.password_hash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: this.toPublicUser(user),
      access_token: await this.issueToken(user),
    };
  }

  async refresh(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: this.toPublicUser(user),
      access_token: await this.issueToken(user),
    };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, passwordHash: string) {
    const [salt, key] = passwordHash.split(':');

    if (!salt || !key) {
      return false;
    }

    const expected = Buffer.from(key, 'hex');
    const actual = (await scrypt(password, salt, 64)) as Buffer;

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private async issueToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async loginWithGoogle(profile: {
    oauth_subject: string;
    oauth_provider: string;
    email: string;
    username: string;
  }) {
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        username: profile.username,
        oauth_provider: profile.oauth_provider,
        oauth_subject: profile.oauth_subject,
      });
    }

    return {
      user: this.toPublicUser(user),
      access_token: await this.issueToken(user),
    };
  }

  private toPublicUser<T extends { password_hash: string | null }>(user: T) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _passwordHash, ...publicUser } = user;

    return serializePrisma(publicUser);
  }
}
