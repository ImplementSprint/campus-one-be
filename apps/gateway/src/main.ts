import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { validateRuntimeConfig } from '../../../libs/config/src/runtime-config';

async function bootstrap() {
  const runtimeConfig = validateRuntimeConfig();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: runtimeConfig.allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(runtimeConfig.port, '0.0.0.0');
  console.log(`[campus-one-backend] Gateway running on http://localhost:${runtimeConfig.port}`);
}

bootstrap();
