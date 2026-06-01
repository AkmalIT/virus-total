import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('VirusTotal API')
    .setDescription(
      'REST API для сервиса анализа файлов, URL-адресов и хешей. ' +
        'Поддерживает загрузку файлов, очереди анализа, WebSocket-уведомления и управление IOC.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'base64url',
        description:
          'Development token — base64url({"sub":"<userId>","issued_at":"<ISO date>"})',
      },
      'access-token',
    )
    .addTag('Auth', 'Регистрация, вход и обновление токена')
    .addTag('Submissions', 'Отправка файлов, URL-адресов и хешей на анализ')
    .addTag('Analysis', 'Получение результатов и прогресса анализа')
    .addTag('Jobs', 'Управление задачами анализа и очередью')
    .addTag('Results', 'Результаты анализа по submission/job')
    .addTag('IOCs', 'Индикаторы компрометации (IoC)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'VirusTotal API Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application started on port ${process.env.PORT ?? 3000}`);
  console.log(
    `Swagger docs available at http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
void bootstrap();
