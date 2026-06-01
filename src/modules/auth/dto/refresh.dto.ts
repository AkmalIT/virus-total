import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'clx1abc...', description: 'ID пользователя (UUID)' })
  user_id!: string;
}
