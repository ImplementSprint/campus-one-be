import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AlumniModule } from './alumni.module';

async function bootstrap() {
  const app = await NestFactory.create(AlumniModule);
  app.enableCors();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.ALUMNI_PORT ?? 4003;
  await app.listen(port);
  console.log(`Alumni service running on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/api/v1/alumni/health`);
}
bootstrap();
