import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health() {
    return { status: 'ok', service: 'campus-one-backend' };
  }

  @Get('ready')
  readiness() {
    return {
      status: 'ready',
      service: 'campus-one-backend',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
