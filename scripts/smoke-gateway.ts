import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/gateway/src/app.module';
import { validateRuntimeConfig } from '../libs/config/src/runtime-config';

async function runSmoke() {
  const runtimeConfig = validateRuntimeConfig();
  console.log('Starting gateway smoke...');
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false });
  console.log('Gateway app created.');

  app.enableCors({
    origin: runtimeConfig.allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(0, '127.0.0.1');
  console.log('Gateway app listening.');

  try {
    const url = await app.getUrl();
    const response = await fetch(`${url}/api/health`);
    if (!response.ok) {
      throw new Error(`Expected /api/health to return 200, received ${response.status}`);
    }

    const body = await response.json();
    if (body.status !== 'ok' || body.service !== 'campus-one-backend') {
      throw new Error(`Unexpected /api/health body: ${JSON.stringify(body)}`);
    }

    console.log(`Gateway smoke passed at ${url}/api/health.`);
  } finally {
    await app.close();
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
