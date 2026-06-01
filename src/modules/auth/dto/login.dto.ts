import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email пользователя',
  })
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd!', description: 'Пароль пользователя' })
  password!: string;
}
