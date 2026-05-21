import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { StudentModule } from './student.module';

async function bootstrap() {
  const app = await NestFactory.create(StudentModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.STUDENT_PORT ?? 4004;
  await app.listen(port);
  console.log(`Student service running on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/api/v1/student/health`);
}
bootstrap();
