import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WalletFactory {
  /**
   * Genera un CVU (Clave Virtual Uniforme) bancario de 22 dígitos.
   * Prefijo simulado de MiniPay (8 dígitos): 00000456
   * Número de cuenta aleatorio (14 dígitos criptográficamente seguros).
   */
  generateCvu(): string {
    const bankPrefix = '00000456';
    let accountDigits = '';
    for (let i = 0; i < 14; i++) {
      accountDigits += crypto.randomInt(0, 10).toString();
    }
    return `${bankPrefix}${accountDigits}`;
  }

  /**
   * Genera un Alias único y legible para la billetera.
   * Formato: nombre.apellido.minipay o palabras aleatorias.
   */
  generateAlias(userName: string): string {
    const cleanName = userName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]/g, '.') // Reemplazar caracteres especiales por puntos
      .replace(/\.+/g, '.') // Evitar puntos repetidos
      .replace(/^\.|\.$/g, ''); // Quitar puntos iniciales/finales

    const randomSuffix = crypto.randomInt(100, 999);
    return `${cleanName || 'usuario'}.${randomSuffix}.mp`;
  }

  /**
   * Factory method para construir la estructura de creación de una Wallet
   */
  createInitialWallet(userName: string) {
    return {
      balance: 0.0,
      currency: 'ARS',
      alias: this.generateAlias(userName),
      cvu: this.generateCvu(),
    };
  }
}
