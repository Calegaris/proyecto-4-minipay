# 📬 MiniPay Digital Wallet - Postman Suite

Esta carpeta contiene la colección exportable oficial y el entorno de variables de **MiniPay Digital Wallet API** para realizar pruebas de integración y evaluación rápida en [Postman](https://www.postman.com/).

---

## 📁 Archivos Incluidos

1. **`minipay.postman_collection.json`**: Colección completa (Schema v2.1.0) organizada en 9 carpetas modulares con el 100% de los endpoints de la plataforma.
2. **`minipay.postman_environment.json`**: Entorno preconfigurado con variables dinámicas (`baseUrl`, `accessToken`, `transferId`, `qrCode`, etc.).

---

## 🚀 Guía de Importación y Uso en Postman (en 2 pasos)

### Paso 1: Importar en Postman
1. Abrí la aplicación **Postman**.
2. Hacé clic en el botón **"Import"** (ubicado arriba a la izquierda).
3. Arrastrá los archivos `minipay.postman_collection.json` y `minipay.postman_environment.json` hacia la ventana de importación.
4. En la esquina superior derecha de Postman, seleccioná el entorno activo: **`MiniPay Local Environment`**.

---

### Paso 2: Flujo de Ejecución Rápida

La colección cuenta con **Scripts de Automatización** que capturan automáticamente los tokens y variables para que no tengas que copiar ni pegar nada manualmente:

1. **Registro e Inicio de Sesión (`01. Authentication & Security`):**
   - Ejecutá **`Register User`** o **`Login User`**.
   - Los scripts inyectarán automáticamente el `accessToken`, `refreshToken` y `userEmail` en el entorno activo.
2. **Consultar Billetera y Depositar (`03. Wallets & Balance`):**
   - Ejecutá **`Deposit Funds`** para cargar saldo inicial.
3. **Transferencias y Comprobantes (`04. Transfers` & `05. PDF Receipts`):**
   - Ejecutá **`Create Transfer`**. El header `Idempotency-Key: {{$guid}}` generará un UUID único en cada envío y guardará el `transferId`.
   - **Para descargar el Comprobante en PDF:** En la petición **`Download Transfer Receipt`**, hacé clic en la flechita desplegable al lado del botón **"Send"** y seleccioná **"Send and Download"** para guardar el archivo `.pdf` en tu computadora.
4. **Pagos con Código QR Dinámico (`08. Dynamic QR Payments`):**
   - Ejecutá **`Generate Dynamic QR Code`** (guardará el payload firmado en `qrCode`).
   - Ejecutá **`Decode / Preview QR Code`** para previsualizar la orden.
   - Ejecutá **`Pay QR Order`** para liquidar el pago atómico.
5. **Analítica Financiera (`09. Financial Analytics`):**
   - Ejecutá **`Get Wallet Stats & Spending by Category`** para ver el balance, flujo neto de caja y desglose porcentual de gastos por rubro (`spendingByCategory`).

---

## 🔒 Variables del Entorno (`MiniPay Local Environment`)

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `baseUrl` | URL base del servidor backend | `http://localhost:3000` |
| `accessToken` | Token JWT Bearer para peticiones autenticadas | *(Dinámico por script)* |
| `refreshToken` | Token de rotación para renovar sesión | *(Dinámico por script)* |
| `transferId` | ID de la última transferencia realizada | *(Dinámico por script)* |
| `qrCode` | Payload Base64 del último código QR generado | *(Dinámico por script)* |
| `userPassword` | Contraseña por defecto para pruebas | `Password123!` |
