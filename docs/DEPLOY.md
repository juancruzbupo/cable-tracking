# Deployment

## Desarrollo local

### Requisitos
- Node.js 18+
- pnpm 8+
- Docker (para PostgreSQL)

### Setup

```bash
# 1. Clonar e instalar
git clone <repo>
cd cable-tracking
pnpm install

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Copiar env vars
cp apps/backend/.env.example apps/backend/.env

# 4. Crear/migrar DB
cd apps/backend
npx prisma migrate deploy
npx prisma generate

# 5. Levantar todo
cd ../..
pnpm dev
```

### URLs
| Servicio | URL |
|---|---|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:3000/api |
| Swagger docs | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 |
| Prisma Studio | `npx prisma studio` → http://localhost:5555 |

---

## Variables de entorno

### Backend (`apps/backend/.env`)

| Variable | Requerida | Default | Descripcion |
|---|---|---|---|
| DATABASE_URL | Si | - | Connection string de PostgreSQL |
| PORT | No | 3000 | Puerto del backend |
| NODE_ENV | No | development | Entorno (development / production) |
| FRONTEND_URL | Si | http://localhost:5174 | URL del frontend para CORS |

### Frontend

| Variable | Requerida | Default | Descripcion |
|---|---|---|---|
| VITE_API_URL | No | /api | URL base de la API (solo si no se usa proxy de Vite) |

En desarrollo, Vite proxea `/api` al backend automaticamente (ver `vite.config.ts`).
En produccion, configurar `VITE_API_URL` al dominio del backend.

---

## Produccion

### Base de datos

Opciones probadas:
- **Supabase**: PostgreSQL managed. Usar connection string de Supabase en `DATABASE_URL`.
- **Railway**: PostgreSQL con auto-backups.

```
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
```

### Migraciones en produccion

```bash
cd apps/backend
npx prisma migrate deploy   # Aplica migraciones pendientes (no interactivo)
npx prisma generate          # Regenera el client
```

**Nunca** usar `prisma migrate dev` en produccion (es interactivo y puede resetear datos).

### Backend

```bash
cd apps/backend
pnpm build                   # Compila TypeScript → dist/
node dist/main.js            # Ejecuta
```

Variables de entorno requeridas:
```
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://tu-dominio.com
```

### Frontend

```bash
cd apps/frontend
pnpm build                   # Genera dist/ con archivos estaticos
```

El build produce archivos en `dist/` que se sirven como sitio estatico (Vercel, Netlify, etc.).

Variable en build time:
```
VITE_API_URL=https://api.tu-dominio.com/api
```

### Docker Compose (DB en produccion)

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: cable_user
      POSTGRES_PASSWORD: <password-seguro>
      POSTGRES_DB: cable_tracking
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - '5432:5432'
```

---

## Troubleshooting

### "Cannot connect to database"
1. Verificar que Docker esta corriendo: `docker ps`
2. Verificar que el container existe: `docker compose up -d`
3. Verificar `DATABASE_URL` en `.env`

### "Port 3000 already in use"
```bash
lsof -i :3000    # Ver que proceso usa el puerto
kill <PID>        # Matarlo
```

### "Port 5174 already in use"
```bash
lsof -i :5174
kill <PID>
```

### "Prisma client not generated"
```bash
cd apps/backend
npx prisma generate
```

### "Migration failed"
```bash
cd apps/backend
npx prisma migrate status    # Ver estado de migraciones
npx prisma migrate deploy    # Aplicar pendientes
```

### "CORS error en el browser"
Verificar que `FRONTEND_URL` en `.env` del backend coincida con el puerto del frontend (5174).

### "Import timeout"
Los imports tienen timeouts de 120-180 segundos. Para archivos muy grandes, verificar logs del backend.
