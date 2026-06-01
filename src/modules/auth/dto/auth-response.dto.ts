import { ApiProperty } from '@nestjs/swagger';

export class UserPublicDto {
  @ApiProperty({
    example: 'clx1abc...',
    description: 'Уникальный ID пользователя',
  })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'johndoe' })
  username!: string;

  @ApiProperty({ example: 'user', enum: ['user', 'analyst', 'admin'] })
  role!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  created_at!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: () => UserPublicDto })
  user!: UserPublicDto;

  @ApiProperty({
    example:
      'eyJzdWIiOiJ1c2VyLWlkIiwiaXNzdWVkX2F0IjoiMjAyNC0wMS0wMVQwMDowMDowMC4wMDBaIn0',
    description: 'Development Bearer token (base64url encoded JSON)',
  })
  access_token!: string;
}
