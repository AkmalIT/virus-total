export class CreateFileSubmissionDto {
  user_id!: string;
  file_name!: string;
  sha256?: string;
  mime_type?: string;
  size_bytes?: number | string;
}
