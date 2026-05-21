import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { EnrollmentModule } from './enrollment.module';

async function bootstrap() {
  const app = await NestFactory.create(EnrollmentModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.ENROLLMENT_PORT ?? 4001;
  await app.listen(port);
  console.log(`Enrollment service running on http://localhost:${port}`);
}
bootstrap();
