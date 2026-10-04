# Sistema de Control de Pedidos - API & Suite de Pruebas QA Automation

Este proyecto implementa una API RESTful desarrollada en **Node.js, Express y TypeScript**, junto con la especificación **OpenAPI 3.1**, una **Matriz de Pruebas completa** y una **Colección de Postman automatizada** con aserciones en JavaScript.

---

## 1. Requisitos del Sistema y Versiones

- **Node.js:** v18.0.0 o superior (Probado en Node.js v20+ / v24+)
- **npm:** v9.0.0 o superior
- **TypeScript:** v5.4+ (ejecutado con `tsx` sin transpilación previa requerida)
- **Herramienta de Pruebas:** Postman Desktop v11+ (o Newman CLI v6+)

---

## 2. Preparación de Datos

La API utiliza un sistema de almacenamiento en memoria sin dependencias de bases de datos externas ni credenciales reales:

- **Base de Datos Mock:** Inicializada automáticamente al arrancar la API (`ordersStore` en `server.ts`).
- **Usuarios de Prueba Mock:**
  - `token-user-1` (Usuario Alfa - ID: `user-1`)
  - `token-user-2` (Usuario Beta - ID: `user-2`)
- **Variables de Entorno Postman:** Precargadas en `environment.json` (`base_url`, `token_user1`, `token_user2`, `idempotency_key`).
- *Nota de Seguridad:* Todos los tokens e identidades son simulaciones locales de prueba. No se utilizan tokens, contraseñas ni datos personales reales.

---

## 3. Inicio de la API

### Pasos de Instalación
1. Abrir la terminal en el directorio del proyecto:
   ```bash
   cd "c:/Proyectos2026/ControlPedidos Service"
   ```
2. Instalar las dependencias:
   ```bash
   npm install
   ```

### Ejecución del Servidor
Para iniciar el servidor en modo desarrollo con recarga automática:
```bash
npm run dev
```

O para iniciar en modo producción:
```bash
npm start
```

El servidor estará escuchando en `http://localhost:3000`. Puede verificar la salud de la API en:
[http://localhost:3000/health](http://localhost:3000/health)

---

## 4. Ejecución de Pruebas en Postman

### Método A: Desde Postman Collection Runner (Interfaz Gráfica)
1. Abra Postman.
2. Haga clic en **Import** e importe los archivos `collection.json` y `environment.json`.
3. Seleccione el entorno **ControlPedidos Environment** en la esquina superior derecha.
4. Haga clic derecho sobre la colección **ControlPedidos API Test Suite - Rubrica QA** y elija **Run collection**.
5. Verifique que las 12 peticiones estén seleccionadas (**TC01 a TC12**).
6. Haga clic en **Run ControlPedidos API Test Suite**.

### Resumen de Resultados Esperados (Ejecución Completa):
- **Casos de prueba ejecutados:** 12 casos (TC01 a TC12)
- **Aserciones evaluadas:** 24 aserciones
- **Resultado:** **24 Passed / 0 Failed (100% Éxito)**

```text
Summary:
- Total Requests: 12
- Total Tests / Assertions: 24
- Passed: 24
- Failed: 0
- Status: PASS
```

---

## 5. Evidencia de Fallo Controlado e Incompatibilidad de Contrato

Demostramos la capacidad de la suite de automatización para detectar **rompimientos de contrato** entre la API y la especificación OpenAPI 3.1.

### Paso 1: Introducir la Incompatibilidad Local
En `server.ts` (línea ~150 del endpoint `GET /pedidos`), renombre la propiedad `total` por `montoTotal`:

```typescript
// Modificación temporal en server.ts:
const paginatedData = userOrders.slice(startIndex, startIndex + limit).map(o => ({
  id: o.id,
  userId: o.userId,
  items: o.items,
  direccionEnvio: o.direccionEnvio,
  montoTotal: o.total, // ❌ CAMBIO INTENCIONAL: 'total' a 'montoTotal'
  estado: o.estado,
  createdAt: o.createdAt
}));
```

### Paso 2: Evidencia del Fallo Controlado
Al reejecutar **TC10 - Validar Esquema de Éxito OpenAPI** en Postman, la prueba falla inmediatamente:

```text
❌ FAIL | TC10 - Validar Esquema de Éxito OpenAPI
AssertionError: expected { id: 'ord-seed-001', userId: 'user-1', montoTotal: 350, ... } to have property 'total'
```
*Explicación:* OpenAPI 3.1 define que el esquema `Order` **requiere** la propiedad `total`. La suite detecta la regresión e impide que el cambio destructivo avance a producción.

---

## 6. Evidencia de Corrección y Restauración

### Paso 1: Restaurar la API
Revierta la modificación en `server.ts` a su estado original:

```typescript
// Código Válido Restaurado:
const paginatedData = userOrders.slice(startIndex, startIndex + limit);
```

### Paso 2: Evidencia del Resultado Exitoso
Al reejecutar la prueba **TC10** y la colección completa en Postman:

```text
✅ PASS | TC10 - Status code is 200 OK
✅ PASS | TC10 - Validación de Contrato PaginatedOrdersResponse

Suite Execution Summary:
---------------------------------------------------
TC01 - Crear Pedido Válido                    [PASS 201]
TC02 - Verificación Posterior (GET por ID)   [PASS 200]
TC03 - Datos Inválidos / Campos Obligatorios  [PASS 400]
TC04 - Ausencia de Credenciales               [PASS 401]
TC05 - Invalidez de Credenciales             [PASS 401]
TC06 - Acceso a Recurso Ajeno (Ownership)    [PASS 403]
TC07 - Recurso Inexistente                    [PASS 404]
TC08 - Paginación de Resultados               [PASS 200]
TC09 - Repetición Operación Idempotente       [PASS 201/200]
TC10 - Validar Esquema de Éxito OpenAPI       [PASS 200]
TC11 - Validar Esquema de Error OpenAPI       [PASS 400]
TC12 - Validación Negocio (Valores Positivos) [PASS 400]
---------------------------------------------------
Total: 12 Casos Ejecutados | 24 Passed | 0 Failed
```

---

## 7. Estructura de Archivos del Proyecto

- `server.ts`: Código fuente del servidor Express en TypeScript.
- `openapi.yaml`: Especificación OpenAPI 3.1 de la API.
- `matriz_pruebas.md`: Matriz formal con 12 casos de prueba de QA.
- `environment.json`: Variables de entorno exportables para Postman.
- `collection.json`: Colección v2.1 de Postman con pruebas automatizadas en JS.
- `README.md`: Documentación completa e instrucciones.
