import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { InstitutionDataModule } from './institution-data.module';

async function bootstrap() {
  const app = await NestFactory.create(InstitutionDataModule);
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.INSTITUTION_DATA_PORT ?? 4001;
  await app.listen(port);
  console.log(`[institution-data-service] Running on http://localhost:${port}`);
  console.log(`  GET/POST  http://localhost:${port}/api/resources/:resource`);
  console.log(`  PATCH/DEL http://localhost:${port}/api/resources/:resource/:id`);
  console.log(`  GET       http://localhost:${port}/api/dashboard`);
  console.log(`  GET/PATCH http://localhost:${port}/api/school/profile`);
}

bootstrap();
