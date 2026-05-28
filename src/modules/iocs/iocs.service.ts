import { Injectable } from '@nestjs/common';
import { IocType } from '@prisma/client';
import { serializePrisma } from '../../common/serializers/prisma.serializer';
import { PrismaService } from '../../infra/db/prisma.service';

type CreateIocInput = {
  submission_id: string;
  type: IocType;
  value: string;
  confidence?: number;
};

@Injectable()
export class IocsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateIocInput) {
    const existingIoc = await this.prisma.ioc.findFirst({
      where: {
        submission_id: input.submission_id,
        type: input.type,
        value: input.value,
      },
    });

    if (existingIoc) {
      return serializePrisma(existingIoc);
    }

    const ioc = await this.prisma.ioc.create({
      data: {
        submission_id: input.submission_id,
        type: input.type,
        value: input.value,
        confidence: input.confidence ?? 1,
      },
    });

    return serializePrisma(ioc);
  }

  async findBySubmissionId(submissionId: string) {
    const iocs = await this.prisma.ioc.findMany({
      where: {
        submission_id: submissionId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return serializePrisma(iocs);
  }
}
