import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email пользователя',
  })
  email!: string;

  @ApiProperty({ example: 'johndoe', description: 'Имя пользователя' })
  username!: string;

  @ApiProperty({ example: 'P@ssw0rd!', description: 'Пароль' })
  password!: string;

  @ApiPropertyOptional({
    example: 'analyst',
    description: 'Роль пользователя (по умолчанию: user)',
    enum: ['user', 'analyst', 'admin'],
  })
  role?: string;
}
