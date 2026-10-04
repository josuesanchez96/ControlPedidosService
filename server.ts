import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Interfaces y Tipos
export interface OrderItem {
  producto: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  direccionEnvio: string;
  notas?: string;
  total: number;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'ENVIADO' | 'CANCELADO';
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

// Extensión de Request para incluir el usuario autenticado
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Sistema de Usuarios Hardcodeados
const USERS_DB: Record<string, User> = {
  'token-user-1': {
    id: 'user-1',
    name: 'Usuario Alfa',
    email: 'alfa@empresa.com'
  },
  'token-user-2': {
    id: 'user-2',
    name: 'Usuario Beta',
    email: 'beta@empresa.com'
  }
};

// Almacenamiento en Memoria
export const ordersStore: Order[] = [
  {
    id: 'ord-seed-001',
    userId: 'user-1',
    items: [
      { producto: 'Monitor Gamer 27"', cantidad: 1, precioUnitario: 350.00 }
    ],
    direccionEnvio: 'Calle Principal 123, Ciudad',
    notas: 'Entregar en horario de oficina',
    total: 350.00,
    estado: 'PENDIENTE',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ord-seed-002',
    userId: 'user-2',
    items: [
      { producto: 'Teclado Mecánico RGB', cantidad: 2, precioUnitario: 85.50 }
    ],
    direccionEnvio: 'Avenida Central 456, Ciudad',
    notas: '',
    total: 171.00,
    estado: 'PENDIENTE',
    createdAt: new Date().toISOString()
  }
];

// Cache de Idempotencia: Clave = `${userId}:${idempotencyKey}` -> Valor = { status, body }
export interface CachedResponse {
  statusCode: number;
  body: any;
}
export const idempotencyCache = new Map<string, CachedResponse>();

// Aplicación Express
const app = express();
app.use(cors());
app.use(express.json());

// Middleware de Autenticación
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticación ausente, inválido o formato incorrecto (se requiere "Bearer <token>")'
    });
  }

  const token = authHeader.substring(7).trim();
  const user = USERS_DB[token];

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticación inválido o expirado'
    });
  }

  req.user = user;
  next();
};

// Endpoint Raíz / Información de la API
app.get('/', (req: Request, res: Response) => {
  res.json({
    nombre: 'API de Control de Pedidos',
    version: '1.0.0',
    estado: 'ACTIVO',
    endpoints: [
      { metodo: 'GET', ruta: '/health', descripcion: 'Estado de salud de la API' },
      { metodo: 'GET', ruta: '/pedidos', descripcion: 'Listar pedidos paginados (Requiere Authorization: Bearer token-user-1)' },
      { metodo: 'POST', ruta: '/pedidos', descripcion: 'Crear pedido idempotente (Requiere Idempotency-Key header)' },
      { metodo: 'GET', ruta: '/pedidos/:id', descripcion: 'Consultar pedido por ID' }
    ],
    documentacion: '/openapi.yaml'
  });
});

// Endpoint de Salud / Inicio
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 1. GET /pedidos - Paginación y Filtrado por Usuario
app.get('/pedidos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;

  // Parsear query parameters de paginación
  let page = parseInt(req.query.page as string, 10);
  let limit = parseInt(req.query.limit as string, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 5;
  if (limit > 50) limit = 50;

  // Filtrar solo los pedidos del usuario autenticado
  const userOrders = ordersStore.filter(o => o.userId === currentUser.id);

  const total = userOrders.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedData = userOrders.slice(startIndex, startIndex + limit);




  return res.status(200).json({
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

// 2. POST /pedidos - Creación de Pedido Idempotente
app.post('/pedidos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const idempotencyKey = req.headers['idempotency-key'] as string;

  // Validar presencia del header de idempotencia
  if (!idempotencyKey || idempotencyKey.trim() === '') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'El encabezado "Idempotency-Key" es obligatorio para crear un pedido'
    });
  }

  const cacheKey = `${currentUser.id}:${idempotencyKey.trim()}`;

  // Verificar si la solicitud ya fue procesada anteriormente
  if (idempotencyCache.has(cacheKey)) {
    const cached = idempotencyCache.get(cacheKey)!;
    // Retornamos el efecto final guardado (misma respuesta almacenada)
    return res.status(cached.statusCode).json(cached.body);
  }

  const { items, direccionEnvio, notas } = req.body || {};
  const validationErrors: string[] = [];

  // Validaciones de datos de entrada
  if (!items || !Array.isArray(items) || items.length === 0) {
    validationErrors.push('El campo "items" debe ser un arreglo con al menos un producto');
  } else {
    items.forEach((item, index) => {
      if (!item.producto || typeof item.producto !== 'string' || item.producto.trim() === '') {
        validationErrors.push(`El item en la posición ${index} debe tener un "producto" válido`);
      }
      if (typeof item.cantidad !== 'number' || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
        validationErrors.push(`El item en la posición ${index} debe tener una "cantidad" entera mayor a 0`);
      }
      if (typeof item.precioUnitario !== 'number' || item.precioUnitario <= 0) {
        validationErrors.push(`El item en la posición ${index} debe tener un "precioUnitario" numérico mayor a 0`);
      }
    });
  }

  if (!direccionEnvio || typeof direccionEnvio !== 'string' || direccionEnvio.trim() === '') {
    validationErrors.push('El campo "direccionEnvio" es obligatorio y debe ser una cadena de texto no vacía');
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Error de validación en los datos del pedido',
      details: validationErrors
    });
  }

  // Cálculo del total
  const total = items.reduce((acc: number, item: OrderItem) => {
    return acc + (item.cantidad * item.precioUnitario);
  }, 0);

  const roundedTotal = Math.round(total * 100) / 100;

  // Crear el nuevo pedido
  const newOrder: Order = {
    id: `ord-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: currentUser.id,
    items,
    direccionEnvio: direccionEnvio.trim(),
    notas: typeof notas === 'string' ? notas.trim() : '',
    total: roundedTotal,
    estado: 'PENDIENTE',
    createdAt: new Date().toISOString()
  };

  ordersStore.push(newOrder);

  // Almacenar en caché de idempotencia
  idempotencyCache.set(cacheKey, {
    statusCode: 201,
    body: newOrder
  });

  return res.status(201).json(newOrder);
});

// 3. GET /pedidos/:id - Obtener Pedido por ID con Validación de Autorización/Ownership
app.get('/pedidos/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const orderId = req.params.id;

  const order = ordersStore.find(o => o.id === orderId);

  // 1. Recurso inexistente -> 404
  if (!order) {
    return res.status(404).json({
      error: 'Not Found',
      message: `El pedido con ID '${orderId}' no fue encontrado`
    });
  }

  // 2. Acceso a recurso ajeno -> 403 Forbidden
  if (order.userId !== currentUser.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Acceso denegado: No tienes permisos para consultar este pedido'
    });
  }

  // 3. Dueño del recurso -> 200 OK
  return res.status(200).json(order);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor de Pedidos ejecutándose en http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️  El puerto ${PORT} ya está en uso. Si otra instancia está ejecutándose, la API ya está activa en http://localhost:${PORT}.`);
    } else {
      console.error('❌ Error al iniciar el servidor:', err);
    }
  });
}

export default app;
