# Matriz de Pruebas de Automatización de API - Sistema de Control de Pedidos

Esta matriz define los 12 casos de prueba obligatorios requeridos para la validación de la API de Pedidos mediante Postman y la especificación OpenAPI 3.1.

| ID | Operación | Riesgo | Precondiciones | Datos (Headers / Body / Params) | Resultado Esperado | Aserciones | Limpieza |
|---|---|---|---|---|---|---|---|
| **TC01** | `POST /pedidos` | Alto | Servidor en ejecución; Token válido de User 1. | **Headers:** `Authorization: {{token_user1}}`, `Idempotency-Key: {{idempotency_key}}`<br>**Body:** `{"items": [{"producto": "Teclado RGB", "cantidad": 2, "precioUnitario": 45.00}], "direccionEnvio": "Calle 10 #45", "notas": "Urgente"}` | **201 Created**<br>Retorna objeto Pedido con `id`, `total: 90`, `estado: "PENDIENTE"` | `pm.response.to.have.status(201)`<br>`pm.expect(res.id).to.exist`<br>`pm.expect(res.total).to.eql(90)`<br>`pm.environment.set("current_order_id", res.id)` | Ninguna (Guardar `current_order_id` para pruebas posteriores). |
| **TC02** | `GET /pedidos/:id` | Alto | TC01 ejecutado exitosamente (`current_order_id` guardado). | **Headers:** `Authorization: {{token_user1}}`<br>**Path Param:** `id = {{current_order_id}}` | **200 OK**<br>Retorna exactamente el pedido creado en TC01. | `pm.response.to.have.status(200)`<br>`pm.expect(res.id).to.eql(pm.environment.get("current_order_id"))`<br>`pm.expect(res.userId).to.eql("user-1")` | Ninguna. |
| **TC03** | `POST /pedidos` | Medio | Servidor en ejecución; Token válido. | **Headers:** `Authorization: {{token_user1}}`, `Idempotency-Key: key-invalid-01`<br>**Body:** `{"direccionEnvio": "Calle Falsa 123"}` *(Sin `items`)* | **400 Bad Request**<br>Mensaje indicando error de validación en `items`. | `pm.response.to.have.status(400)`<br>`pm.expect(res.error).to.eql("Bad Request")`<br>`pm.expect(res.details).to.be.an('array')` | Ninguna. |
| **TC04** | `GET /pedidos` | Alto | Servidor en ejecución. | **Headers:** *Sin encabezado `Authorization`* | **401 Unauthorized**<br>Respuesta de error de autenticación ausente. | `pm.response.to.have.status(401)`<br>`pm.expect(res.error).to.eql("Unauthorized")` | Ninguna. |
| **TC05** | `POST /pedidos` | Alto | Servidor en ejecución. | **Headers:** `Authorization: Bearer token-falso-xyz123`, `Idempotency-Key: test-key`<br>**Body:** `{"items": [{"producto": "Mouse", "cantidad": 1, "precioUnitario": 10}], "direccionEnvio": "Test"}` | **401 Unauthorized**<br>Respuesta de error por token inválido. | `pm.response.to.have.status(401)`<br>`pm.expect(res.error).to.eql("Unauthorized")`<br>`pm.expect(res.message).to.include("inválido")` | Ninguna. |
| **TC06** | `GET /pedidos/:id` | Crítico | Pedido existente de User 1 (`current_order_id`). | **Headers:** `Authorization: {{token_user2}}` *(Token de User 2)*<br>**Path Param:** `id = {{current_order_id}}` | **403 Forbidden**<br>Acceso denegado por violación de propiedad/ownership. | `pm.response.to.have.status(403)`<br>`pm.expect(res.error).to.eql("Forbidden")`<br>`pm.expect(res.message).to.include("No tienes permisos")` | Ninguna. |
| **TC07** | `GET /pedidos/:id` | Medio | Servidor en ejecución; Token válido. | **Headers:** `Authorization: {{token_user1}}`<br>**Path Param:** `id = ord-non-existent-99999` | **404 Not Found**<br>Respuesta de recurso no encontrado. | `pm.response.to.have.status(404)`<br>`pm.expect(res.error).to.eql("Not Found")` | Ninguna. |
| **TC08** | `GET /pedidos` | Medio | Servidor en ejecución con pedidos registrados. | **Headers:** `Authorization: {{token_user1}}`<br>**Query Params:** `page=1&limit=2` | **200 OK**<br>Colección paginada con máximo 2 registros y objeto `pagination`. | `pm.response.to.have.status(200)`<br>`pm.expect(res.data.length).to.be.at.most(2)`<br>`pm.expect(res.pagination.page).to.eql(1)`<br>`pm.expect(res.pagination.limit).to.eql(2)` | Ninguna. |
| **TC09** | `POST /pedidos` | Crítico | TC01 ejecutado con `Idempotency-Key: {{idempotency_key}}`. | **Headers:** `Authorization: {{token_user1}}`, `Idempotency-Key: {{idempotency_key}}`<br>**Body:** *(Mismo o diferente cuerpo, la clave debe evitar duplicados)* | **201 Created** *(o 200 OK con payload idéntico de la caché)* | `pm.response.to.have.status(201)`<br>`pm.expect(res.id).to.eql(pm.environment.get("current_order_id"))` | Limpiar variable `idempotency_key` al finalizar la suite. |
| **TC10** | `GET /pedidos` | Medio | Servidor en ejecución; Token de User 1. | **Headers:** `Authorization: {{token_user1}}` | **200 OK**<br>Cumple rigurosamente el esquema de éxito definido en OpenAPI 3.1. | `pm.response.to.have.status(200)`<br>`pm.expect(res).to.have.property('data')`<br>`pm.expect(res).to.have.property('pagination')`<br>`pm.expect(res.pagination).to.have.all.keys('page','limit','total','totalPages')` | Ninguna. |
| **TC11** | `POST /pedidos` | Alto | Servidor en ejecución; Token válido. | **Headers:** `Authorization: {{token_user1}}` *(Falta header `Idempotency-Key`)*<br>**Body:** `{"items": [{"producto": "Desk", "cantidad": 1, "precioUnitario": 100}], "direccionEnvio": "Casa"}` | **400 Bad Request**<br>Cumple esquema de error OpenAPI 3.1 (`error` y `message`). | `pm.response.to.have.status(400)`<br>`pm.expect(res).to.have.property('error')`<br>`pm.expect(res).to.have.property('message')` | Ninguna. |
| **TC12** | `POST /pedidos` | Medio | Servidor en ejecución; Token de User 1. | **Headers:** `Authorization: {{token_user1}}`, `Idempotency-Key: test-neg-val-1`<br>**Body:** `{"items": [{"producto": "Item Test", "cantidad": -1, "precioUnitario": 0}], "direccionEnvio": "Test"}` | **400 Bad Request**<br>Error de validación por cantidad/precio inválidos. | `pm.response.to.have.status(400)`<br>`pm.expect(res.message).to.include("Error de validación")`<br>`pm.expect(res.details.length).to.be.at.least(1)` | Ninguna. |

---

### Resumen de Cobertura de la Matriz:
1. **Solicitud Válida (POST):** TC01
2. **Verificación posterior de cambio (GET):** TC02
3. **Datos inválidos / campos obligatorios:** TC03, TC12
4. **Ausencia de credenciales (401):** TC04
5. **Invalidez de credenciales (401):** TC05
6. **Acceso a recurso ajeno (403):** TC06
7. **Recurso inexistente (404):** TC07
8. **Paginación:** TC08
9. **Operación Idempotente:** TC09
10. **Esquema de éxito (OpenAPI):** TC10
11. **Esquema de error (OpenAPI):** TC11
12. **Caso Adicional:** TC12 (Validación de enteros positivos y precios mayores a cero en elementos del pedido).
