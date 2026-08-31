import 'dotenv/config';
import { PrismaClient, TransactionType, TransferStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed de base de datos MiniPay...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Limpieza segura de base de datos
  await prisma.transaction.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Tablas limpiadas.');

  // 2. Crear Usuarios de prueba con sus billeteras (incluyendo Alias y CVU)
  const userLucas = await prisma.user.create({
    data: {
      name: 'Lucas Dev',
      email: 'lucas@minipay.com',
      passwordHash,
      wallet: {
        create: {
          balance: 20000, // 25000 inicial - 5000 transferidos
          currency: 'ARS',
          alias: 'lucas.dev.mp',
          cvu: '0000045600000000000001',
        },
      },
    },
    include: { wallet: true },
  });

  const userJuan = await prisma.user.create({
    data: {
      name: 'Juan Perez',
      email: 'juan@minipay.com',
      passwordHash,
      wallet: {
        create: {
          balance: 15000, // 10000 inicial + 5000 recibidos
          currency: 'ARS',
          alias: 'juan.perez.mp',
          cvu: '0000045600000000000002',
        },
      },
    },
    include: { wallet: true },
  });

  const userMaria = await prisma.user.create({
    data: {
      name: 'Maria Gomez',
      email: 'maria@minipay.com',
      passwordHash,
      wallet: {
        create: {
          balance: 5000,
          currency: 'ARS',
          alias: 'maria.gomez.mp',
          cvu: '0000045600000000000003',
        },
      },
    },
    include: { wallet: true },
  });

  console.log('👤 Usuarios creados:');
  console.log('   - Lucas: lucas@minipay.com | Alias: lucas.dev.mp | CVU: 0000045600000000000001');
  console.log('   - Juan:  juan@minipay.com  | Alias: juan.perez.mp | CVU: 0000045600000000000002');
  console.log('   - María: maria@minipay.com | Alias: maria.gomez.mp | CVU: 0000045600000000000003');

  // 3. Registrar Depósitos Iniciales en el Ledger de Transacciones
  if (userLucas.wallet) {
    await prisma.transaction.create({
      data: {
        walletId: userLucas.wallet.id,
        type: TransactionType.DEPOSIT,
        amount: 25000,
      },
    });
  }

  if (userJuan.wallet) {
    await prisma.transaction.create({
      data: {
        walletId: userJuan.wallet.id,
        type: TransactionType.DEPOSIT,
        amount: 10000,
      },
    });
  }

  if (userMaria.wallet) {
    await prisma.transaction.create({
      data: {
        walletId: userMaria.wallet.id,
        type: TransactionType.DEPOSIT,
        amount: 5000,
      },
    });
  }

  // 4. Crear una Transferencia de ejemplo entre Lucas y Juan
  if (userLucas.wallet && userJuan.wallet) {
    const transfer = await prisma.transfer.create({
      data: {
        senderWalletId: userLucas.wallet.id,
        receiverWalletId: userJuan.wallet.id,
        amount: 5000,
        status: TransferStatus.COMPLETED,
        idempotencyKey: 'seed-transfer-sample-001',
        completedAt: new Date(),
      },
    });

    // Movimiento de salida para Lucas
    await prisma.transaction.create({
      data: {
        walletId: userLucas.wallet.id,
        transferId: transfer.id,
        type: TransactionType.TRANSFER_SENT,
        amount: 5000,
      },
    });

    // Movimiento de entrada para Juan
    await prisma.transaction.create({
      data: {
        walletId: userJuan.wallet.id,
        transferId: transfer.id,
        type: TransactionType.TRANSFER_RECEIVED,
        amount: 5000,
      },
    });

    console.log('💸 Transferencia de ejemplo registrada: Lucas -> Juan ($5.000 ARS).');
  }

  console.log('✅ Base de datos poblada exitosamente.');
  console.log('🔑 Credenciales para todos los usuarios de prueba: Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
