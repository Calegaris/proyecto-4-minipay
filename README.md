# 💳 MiniPay — Wallet API

> **[Español](#-español)** | **[English](#-english)**

---

## 🇪🇸 Español

API RESTful para una **Billetera Digital con Dinero Ficticio**, desarrollada como Proyecto Integrador Backend con **NestJS**, **TypeScript**, **PostgreSQL** y **Prisma ORM**.

El sistema implementa operaciones financieras de alta concurrencia garantizando **Consistencia ACID**, **Atomicidad Transaccional**, **Idempotencia de Peticiones** y **Autenticación Segura con Rotación de Tokens**.

---

### 🚀 Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Framework** | [NestJS 11](https://nestjs.com/) (Arquitectura modular con Inyección de Dependencias) |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) (Tipado estricto) |
| **Base de Datos** | [PostgreSQL 16](https://www.postgresql.org/) (Contenedor en Docker) |
| **ORM** | [Prisma 7](https://www.prisma.io/) (con `@prisma/adapter-pg` y pool `pg`) |
| **Seguridad** | Passport JWT, bcrypt, Helmet, CORS, `@nestjs/throttler` (Rate Limiting) |
| **Documentación** | OpenAPI 3.0 / Swagger UI (`@nestjs/swagger`) |
| **Testing** | Jest + Supertest (Suite de pruebas End-to-End) |
| **Gestor de Paquetes** | [pnpm](https://pnpm.io/) |

---

### 🏛️ Arquitectura y Modelo de Datos

```mermaid
erDiagram
    USER ||--|| WALLET : "posee (1:1)"
    USER ||--o{ REFRESH_TOKEN : "mantiene (1:N)"
    WALLET ||--o{ TRANSFER : "envía (SentTransfers)"
    WALLET ||--o{ TRANSFER : "recibe (ReceivedTransfers)"
    WALLET ||--o{ TRANSACTION : "registra movimientos"
    TRANSFER ||--o{ TRANSACTION : "asocia movimientos (1:2)"

    USER {
        string id PK "UUID"
        string email UK "Único, indexado"
        string password "Hasheada con bcrypt"
        string name "Nombre del usuario"
        datetime createdAt
        datetime updatedAt
    }

    WALLET {
        string id PK "UUID"
        string userId FK "Único (1:1 con User)"
        decimal balance "12 dígitos, 2 decimales"
        string currency "ARS por defecto"
        datetime createdAt
        datetime updatedAt
    }

    TRANSFER {
        string id PK "UUID"
        string senderWalletId FK
        string receiverWalletId FK
        decimal amount "Mayor a 0"
        enum status "PENDING, COMPLETED, FAILED"
        string idempotencyKey UK "Clave única de idempotencia"
        datetime createdAt
        datetime completedAt
    }

    TRANSACTION {
        string id PK "UUID"
        string walletId FK
        string transferId FK "Opcional (null en depósitos)"
        enum type "DEPOSIT, TRANSFER_SENT, TRANSFER_RECEIVED"
        decimal amount
        datetime createdAt
    }

    REFRESH_TOKEN {
        string id PK "UUID"
        string token UK "Hash único con jti RFC 7519"
        string userId FK
        datetime expiresAt
        boolean isRevoked "Control de rotación"
        datetime createdAt
    }
```

---

### 🧠 Decisiones Técnicas y Desafíos Resueltos

#### 1. Atomicidad Transaccional en Transferencias (`prisma.$transaction`)
- El débito del remitente (`balance: { decrement: amount }`), el crédito del destinatario (`balance: { increment: amount }`), el registro `Transfer` y los dos asientos en `Transaction` (`TRANSFER_SENT` y `TRANSFER_RECEIVED`) se ejecutan dentro de una **transacción interactiva atómica**.
- Si cualquiera de los pasos falla, se ejecuta un **Rollback automático**.

#### 2. Sistema de Idempotencia (`Idempotency-Key`)
- El endpoint `POST /transfers` acepta la cabecera `Idempotency-Key`.
- Si se reintenta una petición con la misma clave y los mismos datos, devuelve inmediatamente el resultado de la transferencia previa **sin duplicar el débito**.
- Si se reutiliza la misma clave con datos diferentes, la solicitud se rechaza con `400 Bad Request`.

#### 3. Autenticación y Rotación de Refresh Tokens (RFC 7519)
- Contraseñas protegidas con **bcrypt (10 rondas de salt)**.
- Respuestas genéricas (`Credenciales inválidas`) para evitar la enumeración de usuarios.
- **Rotación estricta de Refresh Tokens**: Un refresh token solo puede utilizarse una vez. Al renovar la sesión, se revoca en base de datos y se emite un nuevo par con identificador único `jti` (`crypto.randomUUID()`).

#### 4. Seguridad Perimetral y Rate Limiting
- **Helmet**: Inyección de cabeceras HTTP seguras y eliminación de `X-Powered-By`.
- **CORS Estricto**: Configuración explícita mediante la variable `CORS_ORIGIN`.
- **Throttling**: Límite global (20 req/min) y límite reforzado de **5 intentos por minuto** en `/auth/login` y `/auth/register`.

---

### ⚙️ Variables de Entorno (.env)

```env
PORT=3000
NODE_ENV=development

DATABASE_URL="postgresql://minipay:adminminipay123@localhost:5433/minipay?schema=public"

BCRYPT_SALT_ROUNDS=10
JWT_SECRET="minipay_jwt_super_secret_key_2026_x9a8b7"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="minipay_jwt_refresh_super_secret_key_2026_z1y2x3"
JWT_REFRESH_EXPIRES_IN="7d"

CORS_ORIGIN="http://localhost:5173"
THROTTLE_TTL=60
THROTTLE_LIMIT=20
```

---

### 🛠️ Instalación y Puesta en Marcha

```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar PostgreSQL y Adminer en Docker
docker compose up -d

# 3. Ejecutar migraciones de Prisma
pnpm dlx prisma migrate dev

# 4. Iniciar servidor en desarrollo
pnpm start:dev
```
- **API Base:** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/api/docs`
- **Adminer:** `http://localhost:8080`

---

### 🧪 Pruebas Automatizadas E2E

```bash
pnpm test:e2e
```
*Resultados: 24/24 tests pasando (100% PASS en `app`, `auth`, `wallet`, `transfer`).*

---

<br>

---

## 🇺🇸 English

RESTful API for a **Virtual Wallet System with Simulated Currency**, built as a Backend Capstone Project using **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**.

The platform processes high-concurrency financial operations with **ACID Consistency**, **Atomic Database Transactions**, **Request Idempotency**, and **Secure JWT Authentication with Refresh Token Rotation**.

---

### 🚀 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | [NestJS 11](https://nestjs.com/) (Modular architecture with Dependency Injection) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict type safety) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) (Dockerized container) |
| **ORM** | [Prisma 7](https://www.prisma.io/) (with `@prisma/adapter-pg` and `pg` connection pool) |
| **Security** | Passport JWT, bcrypt, Helmet, CORS, `@nestjs/throttler` (Rate Limiting) |
| **Documentation** | OpenAPI 3.0 / Swagger UI (`@nestjs/swagger`) |
| **Testing** | Jest + Supertest (Comprehensive End-to-End test suite) |
| **Package Manager**| [pnpm](https://pnpm.io/) |

---

### 🏛️ Database Architecture & Entity Relationships

```mermaid
erDiagram
    USER ||--|| WALLET : "owns (1:1)"
    USER ||--o{ REFRESH_TOKEN : "maintains (1:N)"
    WALLET ||--o{ TRANSFER : "sends (SentTransfers)"
    WALLET ||--o{ TRANSFER : "receives (ReceivedTransfers)"
    WALLET ||--o{ TRANSACTION : "records movements"
    TRANSFER ||--o{ TRANSACTION : "links movements (1:2)"

    USER {
        string id PK "UUID"
        string email UK "Unique, indexed"
        string password "Hashed with bcrypt"
        string name "User full name"
        datetime createdAt
        datetime updatedAt
    }

    WALLET {
        string id PK "UUID"
        string userId FK "Unique (1:1 with User)"
        decimal balance "12 digits, 2 decimals"
        string currency "ARS by default"
        datetime createdAt
        datetime updatedAt
    }

    TRANSFER {
        string id PK "UUID"
        string senderWalletId FK
        string receiverWalletId FK
        decimal amount "Greater than 0"
        enum status "PENDING, COMPLETED, FAILED"
        string idempotencyKey UK "Unique idempotency key"
        datetime createdAt
        datetime completedAt
    }

    TRANSACTION {
        string id PK "UUID"
        string walletId FK
        string transferId FK "Optional (null for deposits)"
        enum type "DEPOSIT, TRANSFER_SENT, TRANSFER_RECEIVED"
        decimal amount
        datetime createdAt
    }

    REFRESH_TOKEN {
        string id PK "UUID"
        string token UK "Unique hash with RFC 7519 jti"
        string userId FK
        datetime expiresAt
        boolean isRevoked "Rotation control"
        datetime createdAt
    }
```

---

### 🧠 Core Architectural Decisions & Design Patterns

#### 1. Atomic Database Transactions (`prisma.$transaction`)
- Sender balance deduction (`decrement`), recipient balance credit (`increment`), `Transfer` record creation, and ledger entries (`TRANSFER_SENT`, `TRANSFER_RECEIVED`) are executed inside a single **interactive database transaction**.
- An automatic **Rollback** is triggered if any intermediate operation fails, preventing ledger inconsistencies or fund losses.

#### 2. Request Idempotency Handling (`Idempotency-Key`)
- The `POST /transfers` endpoint extracts the `Idempotency-Key` header.
- Repeating a request with the same key and payload returns the previous transfer result **without debiting balances again**.
- Reusing an existing key with different parameters is rejected with `400 Bad Request`.

#### 3. Authentication & Refresh Token Rotation (RFC 7519)
- Passwords are securely hashed with **bcrypt (10 salt rounds)**.
- User enumeration attacks are mitigated by returning generic `Invalid credentials` error messages on login failures.
- **Strict Token Rotation**: Each refresh token can only be used once. Token exchange revokes the existing token and generates a new pair containing unique UUID `jti` claims (`crypto.randomUUID()`).

#### 4. Perimeter Defense & Rate Limiting
- **Helmet**: Injects security headers and removes `X-Powered-By`.
- **Explicit CORS**: Restricted to allowed origins specified in `CORS_ORIGIN`.
- **Throttling**: Global rate limit (20 req/min) with strict limiting (**5 req/min**) on `/auth/login` and `/auth/register`.

---

### 📡 API Endpoints Reference

| Method | Endpoint | Description | Auth / Headers |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness and readiness health probe | Public |
| `POST` | `/auth/register` | Register user and initialize wallet | Public (5 req/min) |
| `POST` | `/auth/login` | Authenticate user & issue tokens | Public (5 req/min) |
| `POST` | `/auth/refresh` | Rotate refresh token | Public |
| `POST` | `/auth/logout` | Revoke active refresh token | Public |
| `GET` | `/wallet` | Retrieve balance and wallet info | `Bearer JWT` |
| `POST` | `/wallet/deposit` | Deposit simulated funds | `Bearer JWT` |
| `GET` | `/wallet/transactions`| View transaction history | `Bearer JWT` |
| `POST` | `/transfers` | Execute money transfer | `Bearer JWT`, `Idempotency-Key` |
| `GET` | `/transfers/:id` | View specific transfer details | `Bearer JWT` (Participants only) |
| `GET` | `/transfers` | List all sent/received transfers | `Bearer JWT` |

---

### 🛠️ Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL and Adminer via Docker
docker compose up -d

# 3. Run Prisma migrations
pnpm dlx prisma migrate dev

# 4. Start local development server
pnpm start:dev
```
- **API Base:** `http://localhost:3000`
- **Swagger Documentation:** `http://localhost:3000/api/docs`

---

### 🧪 Automated E2E Tests

```bash
pnpm test:e2e
```
*Results: 24/24 passing tests (100% PASS across all suites).*
