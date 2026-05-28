import { SubmissionType } from '@prisma/client';

export class CreateSubmissionDto {
  user_id!: string;
  type!: SubmissionType;
  file_name?: string;
  url?: string;
  mime_type?: string;
  size_bytes?: number | string;
  sha256?: string;
  storage_key?: string;
}
