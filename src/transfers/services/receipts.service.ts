import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';

export type TransferWithReceiptDetails = Prisma.TransferGetPayload<{
  include: {
    senderWallet: { include: { user: true } };
    receiverWallet: { include: { user: true } };
  };
}>;

@Injectable()
export class ReceiptsService {
  /**
   * Genera en memoria RAM un documento PDF con diseño bancario oficial
   * utilizando Streams y retornando el Buffer final sin tocar el disco.
   */
  async generateTransferReceiptPdf(
    transfer: TransferWithReceiptDetails,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // -------------------------------------------------------------
      // 1. ENCABEZADO INSTITUCIONAL
      // -------------------------------------------------------------
      doc.rect(50, 45, 495, 60).fill('#0f172a'); // Fondo Slate 900

      doc
        .fontSize(20)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('MINIPAY DIGITAL WALLET', 70, 58, { align: 'left' });

      doc
        .fontSize(10)
        .fillColor('#94a3b8')
        .font('Helvetica')
        .text('COMPROBANTE OFICIAL DE TRANSFERENCIA INMEDIATA', 70, 83);

      doc.moveDown(3);

      // -------------------------------------------------------------
      // 2. MONTO DESTACADO Y ESTADO
      // -------------------------------------------------------------
      const formattedAmount = Number(transfer.amount).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const startY = 125;
      doc.rect(50, startY, 495, 80).fill('#f8fafc').stroke('#e2e8f0');

      doc
        .fontSize(12)
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .text('MONTO TRANSFERIDO', 70, startY + 15);

      doc
        .fontSize(24)
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text(`$ ${formattedAmount} ARS`, 70, startY + 35);

      // Badge de Estado Acreditado
      doc.rect(380, startY + 25, 140, 30).fill('#dcfce7'); // Verde suave
      doc
        .fontSize(11)
        .fillColor('#166534')
        .font('Helvetica-Bold')
        .text('✔ ACREDITADA', 380, startY + 34, {
          width: 140,
          align: 'center',
        });

      // -------------------------------------------------------------
      // 3. DATOS DE LA OPERACIÓN
      // -------------------------------------------------------------
      const opY = 225;
      doc
        .fontSize(13)
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text('DATOS DE LA OPERACIÓN', 50, opY);

      doc
        .moveTo(50, opY + 18)
        .lineTo(545, opY + 18)
        .strokeColor('#cbd5e1')
        .stroke();

      const formattedDate = new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(transfer.createdAt));

      doc.fontSize(10).fillColor('#475569').font('Helvetica');
      doc.text('Fecha y Hora (UTC):', 50, opY + 28);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(formattedDate, 200, opY + 28);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('ID de Transferencia:', 50, opY + 46);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.id, 200, opY + 46);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('Idempotency Key:', 50, opY + 64);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.idempotencyKey || 'N/A', 200, opY + 64);

      // -------------------------------------------------------------
      // 4. DATOS DEL EMISOR Y RECEPTOR (BLOQUES PARALELOS)
      // -------------------------------------------------------------
      const partiesY = 325;

      // Columna Izquierda: Emisor
      doc.rect(50, partiesY, 240, 140).fill('#f1f5f9').stroke('#cbd5e1');

      doc
        .fontSize(11)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('DATOS DEL EMISOR', 65, partiesY + 12);

      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      doc.text('Nombre:', 65, partiesY + 35);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.senderWallet.user.name, 65, partiesY + 48);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('Email:', 65, partiesY + 65);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.senderWallet.user.email, 65, partiesY + 78);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('CVU / Alias:', 65, partiesY + 95);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`${transfer.senderWallet.alias}`, 65, partiesY + 108);
      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text(`(${transfer.senderWallet.cvu})`, 65, partiesY + 120);

      // Columna Derecha: Receptor
      doc.rect(305, partiesY, 240, 140).fill('#f1f5f9').stroke('#cbd5e1');

      doc
        .fontSize(11)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('DATOS DEL RECEPTOR', 320, partiesY + 12);

      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      doc.text('Nombre:', 320, partiesY + 35);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.receiverWallet.user.name, 320, partiesY + 48);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('Email:', 320, partiesY + 65);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(transfer.receiverWallet.user.email, 320, partiesY + 78);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text('CVU / Alias:', 320, partiesY + 95);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`${transfer.receiverWallet.alias}`, 320, partiesY + 108);
      doc
        .fontSize(8)
        .fillColor('#64748b')
        .text(`(${transfer.receiverWallet.cvu})`, 320, partiesY + 120);

      // -------------------------------------------------------------
      // 5. SELLO DIGITAL DE INTEGRIDAD Y SEGURIDAD
      // -------------------------------------------------------------
      const secY = 490;
      const integrityHash = crypto
        .createHash('sha256')
        .update(
          `${transfer.id}:${transfer.amount.toString()}:${transfer.createdAt.toISOString()}`,
        )

        .digest('hex');

      doc
        .fontSize(10)
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .text('SELLO DIGITAL DE TRAZABILIDAD Y SEGURIDAD', 50, secY);

      doc
        .fontSize(8)
        .fillColor('#64748b')
        .font('Courier')
        .text(`SHA-256: ${integrityHash}`, 50, secY + 15, { width: 495 });

      // -------------------------------------------------------------
      // 6. PIE DE PÁGINA LEGAL
      // -------------------------------------------------------------
      const footerY = 730;
      doc
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .strokeColor('#e2e8f0')
        .stroke();

      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .font('Helvetica')
        .text(
          'Este comprobante fue emitido electrónicamente por el sistema automatizado de MiniPay Digital Wallet. No requiere firma física ni constituye factura fiscal. Válido como constancia de transferencia bancaria inmediata.',
          50,
          footerY + 10,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }
}
