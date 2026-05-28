import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';

type CreateUserInput = {
  email: string;
  username: string;
  password_hash?: string | null;
  role?: string;
  oauth_provider?: string | null;
  oauth_subject?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        password_hash: input.password_hash,
        role: input.role ?? 'user',
        oauth_provider: input.oauth_provider,
        oauth_subject: input.oauth_subject,
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
