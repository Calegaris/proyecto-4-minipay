import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene todos los contactos agendados por el usuario autenticado
   * con proyección segura (sin contraseñas ni hashes).
   */
  async getContacts(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
      select: {
        id: true,
        aliasCustomName: true,
        createdAt: true,
        updatedAt: true,
        contactUser: {
          select: {
            id: true,
            name: true,
            email: true,
            wallet: {
              select: {
                id: true,
                alias: true,
                cvu: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts;
  }

  /**
   * Agrega un nuevo contacto a la agenda del usuario resolviéndolo
   * por Email, Alias o CVU.
   */
  async createContact(userId: string, createContactDto: CreateContactDto) {
    const { aliasCustomName, contactEmail, contactAlias, contactCvu } =
      createContactDto;

    // 1. Validación de identificador obligatorio
    if (!contactEmail && !contactAlias && !contactCvu) {
      throw new BadRequestException(
        'Debe proporcionar al menos un identificador: email, alias o cvu',
      );
    }

    // 2. Resolver usuario destino
    let targetUser: any = null;

    if (contactCvu) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { cvu: contactCvu },
        include: { user: true },
      });
      targetUser = wallet?.user ?? null;
    } else if (contactAlias) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { alias: contactAlias },
        include: { user: true },
      });
      targetUser = wallet?.user ?? null;
    } else if (contactEmail) {
      targetUser = await this.prisma.user.findUnique({
        where: { email: contactEmail },
      });
    }

    if (!targetUser) {
      throw new NotFoundException(
        'El usuario destinatario no existe o no tiene una cuenta activa',
      );
    }

    // 3. Regla de negocio: No auto-agendarse
    if (targetUser.id === userId) {
      throw new BadRequestException(
        'No puedes agregarte a ti mismo a tu agenda de contactos',
      );
    }

    // 4. Prevenir duplicados
    const existingContact = await this.prisma.contact.findUnique({
      where: {
        userId_contactUserId: {
          userId,
          contactUserId: targetUser.id,
        },
      },
    });

    if (existingContact) {
      throw new ConflictException(
        'Este usuario ya se encuentra registrado en tu agenda de contactos',
      );
    }

    // 5. Crear el contacto con proyección segura
    return this.prisma.contact.create({
      data: {
        userId,
        contactUserId: targetUser.id,
        aliasCustomName,
      },
      select: {
        id: true,
        aliasCustomName: true,
        createdAt: true,
        updatedAt: true,
        contactUser: {
          select: {
            id: true,
            name: true,
            email: true,
            wallet: {
              select: {
                id: true,
                alias: true,
                cvu: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Elimina un contacto de la agenda del usuario autenticado.
   */
  async deleteContact(userId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contacto no encontrado en tu agenda');
    }

    await this.prisma.contact.delete({
      where: { id: contactId },
    });

    return {
      message: 'Contacto eliminado exitosamente de la agenda',
    };
  }
}
