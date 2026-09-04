import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Contacts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar agenda de contactos',
    description:
      'Retorna todos los contactos frecuentes guardados por el usuario autenticado con datos públicos de billetera.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de contactos obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async getContacts(@CurrentUser('id') userId: string) {
    return this.contactsService.getContacts(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Agregar nuevo contacto a la agenda',
    description:
      'Agrega un destinatario frecuente resolviéndolo por Email, Alias o CVU, con un nombre personalizado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Contacto agregado exitosamente a la agenda',
  })
  @ApiResponse({
    status: 400,
    description: 'Falta identificador o intento de auto-agendarse',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario destinatario no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'El contacto ya se encuentra en la agenda',
  })
  async createContact(
    @CurrentUser('id') userId: string,
    @Body() createContactDto: CreateContactDto,
  ) {
    return this.contactsService.createContact(userId, createContactDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar contacto de la agenda',
    description: 'Elimina un contacto agendado por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del contacto a eliminar',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Contacto eliminado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Contacto no encontrado en la agenda del usuario',
  })
  async deleteContact(
    @CurrentUser('id') userId: string,
    @Param('id') contactId: string,
  ) {
    return this.contactsService.deleteContact(userId, contactId);
  }
}
