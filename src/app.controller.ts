import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health & Info')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Mensaje de bienvenida de la API' })
  @ApiResponse({ status: 200, description: 'Mensaje de saludo retornado' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check probe para monitoreo de liveness y readiness' })
  @ApiResponse({
    status: 200,
    description: 'Servicio en funcionamiento correcto',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-08-28T04:30:00.000Z',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}


