import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ApplicationModule } from './application.module';

async function bootstrap() {
  const app = await NestFactory.create(ApplicationModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.APPLICATION_PORT ?? 4002;
  await app.listen(port);
  console.log(`Application service running on http://localhost:${port}`);
}
bootstrap();
