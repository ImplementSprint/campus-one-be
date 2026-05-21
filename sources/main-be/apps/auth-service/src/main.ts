import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.AUTH_SERVICE_PORT ?? 3001;
  await app.listen(port);
  console.log(`[auth-service] Running on http://localhost:${port}`);
  console.log(`  POST http://localhost:${port}/api/auth/signup`);
  console.log(`  POST http://localhost:${port}/api/auth/login`);
}

bootstrap();
