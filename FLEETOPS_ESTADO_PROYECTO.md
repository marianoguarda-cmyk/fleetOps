# FleetOps — Documento de estado del proyecto

> Subí este archivo al inicio de una nueva conversación con Claude para retomar el desarrollo de FleetOps sin perder contexto.

## Qué es FleetOps

Sistema de gestión de flota multi-país para Chazki. Permite a operadores/conductores hacer el check diario de sus vehículos, liquidar rutas de entrega, y a administradores supervisar todo desde un panel web con dashboard, planificación, satelital y reportes.

---

## Stack tecnológico

- **Frontend:** HTML5 + CSS3 + JavaScript vanilla (archivos únicos, sin build)
- **Backend:** Node.js + Express (`app.js`) — proxy GPS, subida a Google Drive, creación de usuarios
- **Base de datos:** Supabase (PostgreSQL + PostgREST + GoTrue Auth + Storage)
- **Gráficos:** Chart.js (CDN)
- **Deploy:** Vercel con CI/CD automático desde GitHub
- **URL producción:** https://fleet-ops-kohl.vercel.app
- **Repositorio:** https://github.com/marianoguarda-cmyk/fleetOps

---

## Archivos principales

| Archivo | Función |
|---|---|
| `fleetops-vercel/index.html` | Panel web completo (admin/super_admin) |
| `fleetops-vercel/operador.html` | PWA móvil para conductores/operadores |
| `fleetops-vercel/app.js` | Servidor Express: proxy GPS, upload Google Drive, API crear usuario |
| `fleetops-vercel/sw.js` | Service Worker (offline + caché PWA) |
| `fleetops-vercel/package.json` | Dependencias Node.js |
| `fleetops-vercel/vercel.json` | Configuración de deploy Vercel |

---

## Credenciales y configuración

### Supabase
- **URL:** `https://rzmijsyioxtmnfjpezvb.supabase.co`
- **Anon key:** usada en frontend (index.html y operador.html), no es secreta
- **Service key:** en variable de entorno Vercel `SUPABASE_SERVICE_KEY` (usada solo en app.js para crear usuarios vía Admin API)

### Google Drive (fotos)
- **Service Account:** `fleetops-drive@operating-braid-496220-b0.iam.gserviceaccount.com`
- **Proyecto GCP:** `operating-braid-496220-b0` (dentro de Google Cloud de chazki.com)
- **Tipo de Drive:** Shared Drive (Unidad compartida) llamado `FleetOps` — IMPORTANTE: las service accounts NO tienen cuota en Drive personal, por eso se usa Shared Drive con la cuenta agregada como "Administrador de contenido"
- **Carpetas (IDs):**
  - `conductores`: `1HbWvm2uahei85ySU0P3a_c3T0EHCyXa_`
  - `vehiculos`: `1XP45p-iv3yWFfm8UCEbbd6IEU7IoBidJ`
  - `checks`: `1ima6LbI3AjrYNcsXcr-jhVsNNq1fqhW7`
- **Endpoint:** `POST /api/drive/upload` — recibe `{base64, filename, tipo}`, devuelve `{success, id, url}`
- **Formato de URL de imagen para mostrar:** `https://lh3.googleusercontent.com/d/{fileId}` (el formato `uc?export=view` NO renderiza bien en `<img>`)
- **Auth:** JWT firmado con la private key de la service account, scope `https://www.googleapis.com/auth/drive` (scope completo, no `drive.file`), token cacheado en memoria del server

### API GPS Satelital
- **URL:** `https://plataforma.gotdns.org:2302/api/seguimiento/transmissions`
- **Token:** env var `GPS_TOKEN` (default `0fde2a7b8593c641`)
- **Proxy:** `GET /api/gps/transmissions` en app.js (evita CORS)
- **Restricción importante:** esta integración GPS en vivo es EXCLUSIVA de Chile. Para otros países, el panel solo muestra rastreadores guardados en Supabase sin datos en vivo, con mensaje aclaratorio.
- Semáforos: 🟢 en movimiento (speed>0) · 🟡 detenido · 🔴 sin reporte (+30min)

### Variables de entorno en Vercel
- `SUPABASE_SERVICE_KEY`
- `GPS_TOKEN`

---

## Arquitectura multi-país (multi-tenant)

Un solo Supabase con Row Level Security (RLS) por país.

### Funciones SQL helper
- `get_user_pais_id()` — devuelve el pais_id del usuario logueado
- `is_super_admin()` — true si el usuario es super_admin
- `auth_rol()` — devuelve el rol del usuario logueado

### Roles
- **super_admin** (mariano.guarda@chazki.com, alfredo.bourdieu@chazki.com): ve todos los países, selector de país en topbar con bandera, badge indicador de país activo persistente
- **admin**: ve solo su pais_id, gestiona todo dentro de su país
- **operador / conductor**: ve solo su pais_id, accede SOLO a operador.html (check + liquidación + historial + mapa)

### Patrón de filtrado por país (frontend)
```js
function getPaisId(){
  if(isSuperAdmin()) return PAIS_ACTIVO || null; // null = todos los países
  return CP?.pais_id || null;
}
function withPais(query){
  const pid = getPaisId();
  if(pid) return query.eq('pais_id', pid);
  return query; // super_admin sin filtro ve todo
}
```
Todas las queries de listados deben usar `withPais()`. Bug recurrente: si una query nueva no usa `withPais()`, no respeta el filtro de país.

### Cambio de país (super_admin)
Función `cambiarPais(paisId)`:
- Limpia todos los caches en memoria (`EMPRESAS_CACHE`, `CLIENTES_CACHE`, `VEH_CACHE_CHECK`, etc.)
- Actualiza indicador visual en topbar
- Sincroniza todos los selectores de país abiertos
- Recarga la sección activa con `await` para traer datos frescos del nuevo país
- Bug ya resuelto: si no se limpian los caches, las funciones de carga "ven" que el cache no está vacío y no piden datos nuevos

---

## Tablas Supabase

- `paises` — AR, MX, CL, PE, CO, UY (id, codigo, nombre, activo)
- `profiles` — usuarios: id, email, nombre, rol (operador/conductor/admin/super_admin), pais_id, activo
- `empresas` — empresas de transporte: pais_id, activo, foto_url
- `vehiculos` — empresa_id, pais_id, link_gps, nombre_empresa_gps, rastreador_id, activo, created_at, foto_url
- `conductores` — empresa_id, pais_id, venc_licencia, venc_libreta_sanitaria, venc_psicofisico, vehiculo_id, foto_url, email (para vincular con su usuario de Auth)
- `clientes` — nombre, direccion, telefono, email, pais_id, activo
- `rastreadores` — gps_gid (unique), gps_id_dispositivo, nombre, vehiculo_id, pais_id, activo
- `checks_diarios` — ver detalle abajo (tiene campos estándar + campos específicos de Perú)
- `alertas` — vencimientos con pais_id
- `planificacion` — fecha, vehiculos_planificados, pais_id, cliente_id (unique constraint: fecha+pais_id+cliente_id)
- `liquidaciones` — ver módulo de Liquidación abajo
- `liquidaciones_detalle` — liquidacion_id, motivo, cantidad, descripcion, monto
- Storage bucket: `fleet-fotos` (público, legacy — la mayoría de fotos nuevas van a Google Drive)

### Tabla `checks_diarios` — columnas completas

Campos estándar (todos los países excepto Perú):
```
vehiculo_id, pais_id, fecha, hora_check, cliente_id,
doc_chofer_ok, doc_chofer_estado, carga_ok, carga_estado, precinto_numero,
vehiculo_ok, vehiculo_estado, estado_final, gps_estado,
link_gps_check, empresa_gps, rastreador_gid, rastreador_nombre,
sale_con_peon, nombre_peon, observaciones, registrado_por, fotos (array text)
```

Campos específicos de Perú (`tipo_check = 'peru'`):
```
tipo_check, tipo_vehiculo_check,
doc_soat, doc_revision_tecnica, doc_permiso_circulacion,
mec_combustible, mec_aceite, mec_liquido_frenos, mec_luces, mec_bocina,
mec_frenos, mec_neumaticos, mec_llanta_repuesto, mec_kit_herramientas,
cond_limpieza, cond_area_carga, cond_candados, cond_carretilla, cond_film,
pers_completo, pers_credencial, pers_pantalon, pers_epp,
comentarios_check (jsonb con un comentario por cada item)
```
Cada item de Perú usa valores: `'si' | 'no' | 'na'` (no aplica). `doc_chofer_estado` se reutiliza para guardar el resultado de "Licencia de conducir" en el check de Perú.

### Tabla `liquidaciones` — columnas completas
```
id, fecha, conductor_id, vehiculo_id, cliente_id, pais_id, empresa_id,
-- Planilla de salida (la crea el admin o el conductor desde la app):
bultos_salida, monto_esperado, observaciones_salida, hora_salida, creado_por,
-- Liquidación al regresar (SOLO la cierra admin/super_admin):
bultos_entregados, bultos_no_entregados, monto_cobrado, monto_diferencia,
efectivo_entregado, diferencia_efectivo,
hora_regreso, observaciones_liquidacion, liquidado_por,
estado ('pendiente' | 'liquidado' | 'con_diferencia'),
created_at, updated_at
```

### RLS de `liquidaciones` (importante)
```sql
-- SELECT e INSERT: cualquier usuario autenticado del país (incluye conductores)
-- UPDATE y DELETE: SOLO admin/super_admin (un conductor no puede cerrar su propia liquidación)
create policy "Actualizar liquidaciones solo admin" on liquidaciones
  for update using (
    is_super_admin()
    or (pais_id = get_user_pais_id() and auth_rol() in ('admin','super_admin'))
  );
```

---

## Checklist diferenciado por país

**Decisión de producto:** el checklist varía por país. Hasta ahora solo Perú tiene un checklist propio; el resto usa el "estándar". La detección es automática según el país del usuario logueado (o `PAIS_ACTIVO` si es super_admin).

```js
function esPeru(){
  const paisId = isSuperAdmin() ? PAIS_ACTIVO : (CP?.pais_id || null);
  if(!paisId) return false;
  const pe = PAISES_CACHE.find(p=>p.codigo==='PE');
  return pe && paisId === pe.id;
}
```

### Check estándar (resto de países)
Secciones: Documentación del chofer (licencia + DNI), Carga/mercadería (remito + precinto), Estado del vehículo (carrocería, espejos, fluidos, limpieza, extintor, botiquín), GPS, Peón, Fotos, Observaciones.

### Check Perú (basado en formulario físico de Chazki "Checklist de distribución – Unidad y personal")
4 secciones, cada item con Sí/No/No aplica + comentario:
1. **Documentación:** SOAT, Revisión técnica, Licencia de conducir, Permiso de circulación
2. **Estado mecánico** (9 items): combustible, aceite, líquido de frenos, luces, bocina, frenos, neumáticos, llanta de repuesto, kit de herramientas
3. **Condiciones, implementos y seguridad** (5 items): limpieza unidad, área de carga, candados/conos/tacos, carretilla, film/cutter/wincha
4. **Personal** (4 items): personal completo, credencial laboral, pantalón jean limpio, EPP's

Implementado tanto en `index.html` (sección `#s-checklist-pe`) como en `operador.html` (página `#p-check-pe`), con la misma lógica de detección de país duplicada en ambos archivos (no comparten JS).

**Importante para el futuro:** si se agrega un checklist de otro país, hay que replicar este patrón: HTML de la sección nueva + función `esXxx()` + lógica de guardado con `tipo_check` distintivo + actualizar `goTo`/`goPage` para que decida cuál mostrar.

---

## Módulo de Liquidación de ruta

**Caso de uso original:** Colombia, donde los conductores llevan mercadería, cobran en efectivo, y devuelven lo no entregado + el efectivo cobrado. **Decisión de producto:** implementar como módulo universal disponible para todos los países (no solo Colombia), por si se necesita a futuro.

### Flujo
1. **Salida:** el admin (panel web) O el conductor (app operador) crea una "planilla de salida": conductor, vehículo, cliente, bultos a entregar, monto esperado, hora de salida. Queda en estado `pendiente`.
2. **Liquidación (regreso):** SOLO el admin/super_admin puede cerrarla (reforzado con RLS, no solo en la UI). Completa: bultos entregados (calcula automáticamente los no entregados), detalle de motivos de no entrega (ausente/dirección incorrecta/rechazo/otro), monto cobrado, efectivo que el conductor entrega físicamente.
3. **Cálculo automático de diferencias:**
   - `monto_diferencia` = monto_cobrado − monto_esperado (cuánto se desvió de lo esperado)
   - `diferencia_efectivo` = efectivo_entregado − monto_cobrado (si el conductor entregó menos efectivo del que dice haber cobrado → posible faltante)
4. **Estado final:** `liquidado` si diferencia = 0, `con_diferencia` si no.

### Alertas
- Si una planilla lleva más de **28 horas** en estado `pendiente` sin liquidar, se marca como alerta urgente (🚨) tanto en el dashboard como en la sección de Liquidación.

### Dashboard de Liquidación (panel admin)
- 5 stats clickeables: Total / Liquidadas / Pendientes / Con diferencia / 🚨 Alertas +28hs
- Tabs de filtro: Todos / Pendientes / Liquidadas / Con diferencia
- Filtro de fecha: Hoy / Semana / Mes / Todo
- Exportación CSV con todos los campos

### En la app operador (conductor)
- Pestaña 💰 Liquidación
- Botón **+ Nueva planilla** (el conductor puede crear, NO puede cerrar)
- Ve sus propias planillas (busca su `conductor_id` por email)
- Si tiene pendientes, aparece alerta naranja
- En planillas pendientes, en vez de botón de acción ve: "⏳ Esperando liquidación por un administrador"

---

## Creación de usuarios (conductores con acceso a la app)

Desde el modal de "Nuevo conductor" en el panel admin, hay una sección **"Acceso a la plataforma"** (solo visible al crear, no al editar) con campo de contraseña **opcional**:
- Si se completa email + contraseña (mín. 6 caracteres) → se crea el conductor en la tabla `conductores` Y un usuario en Supabase Auth con `rol: 'conductor'`, vía endpoint `POST /api/crear-usuario`
- Si se deja la contraseña vacía → solo se crea el registro del conductor, sin acceso a la plataforma
- El usuario creado solo puede acceder a `operador.html`, donde solo ve Check diario, Liquidación, Historial y Mapa — sin acceso al panel admin

### Endpoint `/api/crear-usuario` (app.js)
Usa la Service Role Key de Supabase (Admin API, sin rate limit de registro normal) para crear el usuario en Auth y simultáneamente el registro en `profiles` con `pais_id` correcto desde el primer momento.

### Bug histórico resuelto: pais_id null en perfiles
Cuando un perfil se crea automáticamente al primer login (fallback en `afterLogin`) sin pasar por el endpoint admin, puede quedar con `pais_id = null`. Fix aplicado: `afterLogin` ahora también completa `pais_id` desde `user.user_metadata.pais_id` si el perfil existe pero no tiene país. Igualmente, si aparecen perfiles viejos con `pais_id null`, hay que corregirlos manualmente vía SQL.

---

## Dashboard con gráficos (Chart.js)

Sección de analytics en el dashboard del panel admin, con filtros combinables (Empresa + Cliente + Vehículo + Conductor, todos a la vez) y selector de rango (7/14/30/90 días).

### 6 gráficos
1. **Cumplimiento de checks por día (%)** — línea
2. **Estados de check por día** — barras apiladas (OK verde / Obs. ámbar / Error rojo)
3. **Liquidaciones: cobrado vs esperado por día ($)** — barras comparativas
4. **Diferencias de liquidación por día ($)** — barras coloreadas según signo
5. **Top 10 vehículos por cantidad de checks** — barras horizontales
6. **Top 10 conductores por cantidad de checks** — barras horizontales

### Detalle importante: cómo se determina "el conductor" de un check
`checks_diarios` NO tiene `conductor_id` directo. El check se vincula al conductor a través del **vehículo**: se busca en la tabla `conductores` cuál tiene ese `vehiculo_id` asignado actualmente. Esto significa que el ranking de "Top conductores" refleja la asignación ACTUAL del conductor al vehículo, no necesariamente quién condujo ese día específico si hubo reasignaciones posteriores. NO usar `registrado_por` para este propósito — ese campo indica quién completó el formulario (a veces es un admin haciéndolo por el conductor), no quién es el conductor de ruta.

### Formato de fechas en los gráficos
Todas las etiquetas de eje X usan formato "Día abreviado DD/MM" (ej: "Mié 06/17") vía helper `fdCorto(fechaStr)`, no solo el número de fecha.

---

## UI / Navegación del panel admin

### Sidebar colapsable
- Botón `«` dentro del logo, y botón `☰` dentro del topbar (visible solo cuando el sidebar está oculto) para mostrar/ocultar
- Estado persistido en `localStorage` (`fleetops_sidebar_collapsed`)

### Menú organizado en grupos desplegables (acordeón)
Reorganizado por flujo de trabajo, no por tipo de dato:
- **Dashboard** (suelto, siempre visible)
- **Operación diaria:** Check diario, Liquidación, Planificación
- **Monitoreo:** Satelital, Historial, Alertas
- **Maestros:** Empresas, Clientes, Vehículos, Conductores
- **Administración** (solo admin/super_admin): Países, Usuarios

Estado de cada grupo (abierto/cerrado) persistido en `localStorage` (`fleetops_nav_groups`).

### Bug recurrente con clase `.admin-only`
La clase `.admin-only{display:none}` se activa/desactiva con JS (`el.style.display = isAdmin() ? 'flex' : 'none'`), pero **no todos los elementos `.admin-only` deben ser `flex`** — los contenedores tipo `.nav-group` deben ser `block`. Si se agregan nuevos elementos `.admin-only`, hay que distinguir el tipo de elemento al mostrarlo, no asumir `flex` para todos.

### Patrón de modales (CRÍTICO — bug recurrente)
Todos los modales deben tener esta estructura exacta para que los botones no queden "flotando" fuera del cuadro:
```html
<div class="overlay" id="ov-XXX">
  <div class="modal">
    <div class="modal-hd">...</div>
    <div class="modal-body">
      <!-- contenido scrolleable -->
    </div><!-- end modal-body -->
    <div class="modal-footer">
      <button class="btn" onclick="closeModal('XXX')">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarXXX()">Guardar</button>
    </div>
  </div>
</div>
```
CSS: `.modal{display:flex;flex-direction:column;overflow:hidden}`, `.modal-body{overflow-y:auto;flex:1}`, `.modal-footer{flex-shrink:0}`. Bug recurrente: al insertar contenido nuevo dentro de un modal existente (ej: agregar un campo), es fácil dejar un `<div>` o `<button>` sin cerrar correctamente, lo que rompe el layout y deja los botones de Cancelar/Guardar renderizados fuera del modal visualmente. Siempre contar aperturas/cierres de `<div>` después de editar un modal.

### Patrón openModal/editar (para evitar reseteo de campos)
`openModal(id)` es `async` y por defecto resetea los campos del formulario a vacío. Para editar un registro existente:
```js
function editarX(obj){
  $('mx-id').value = obj.id; // setear el ID ANTES de abrir
  openModal('x').then(()=>{
    // rellenar campos DESPUÉS de que el modal cargue sus selects/cache
    $('mx-campo').value = obj.campo || '';
  });
}
```
Y dentro de `openModal`, verificar `isEdit = $('mx-id').value !== ''` antes de resetear campos a vacío.

---

## Bugs históricos ya resueltos (para no repetir)

1. **`openModal` async resetea campos al editar** → patrón `.then()` (ver arriba)
2. **`db` variable conflict** entre cliente Supabase e IndexedDB en operador.html → IndexedDB renombrado a `idbDb`
3. **Selects con `nth-of-type`** para leer chips seleccionados → reemplazado por IDs únicos
4. **Planificación no sumaba bien con "todos los países"** → decisión de producto: en vista "todos los países" NO se suma, solo se permite ver un país a la vez (super_admin debe seleccionar país para ver planificación)
5. **Satelital llamaba a la API GPS para cualquier país** → ahora solo llama la API en vivo si el país activo es Chile; otros países ven solo datos guardados en Supabase
6. **Cambio de país no refrescaba hasta navegar varias veces** → causa: caches en memoria no se limpiaban; fix en `cambiarPais()`
7. **Fotos de check no se veían en Google Drive** → causas combinadas: (a) Service Accounts no tienen cuota en Drive personal → migrado a Shared Drive; (b) URL `uc?export=view` no renderiza en `<img>` → cambiado a `lh3.googleusercontent.com/d/{id}`
8. **Service Worker servía versión cacheada vieja** → subir `CACHE_NAME` (v1→v2) y agregar headers `Cache-Control: no-cache, no-store, must-revalidate` a las rutas de `operador.html` en app.js
9. **`checks_diarios_doc_chofer_estado_check` constraint** bloqueaba guardar valores 'si'/'no'/'na' de Perú → constraint eliminado (ya no valida valores específicos)
10. **Modal de conductor con botones desencuadrados** → causa: `<div>` de botones quedó abierto sin cerrar al insertar la sección de foto/contraseña; reconstruido completo con estructura modal-body/modal-footer

---

## Funcionalidades completas — resumen por módulo

### Panel web (`index.html`)
- Dashboard con stats de flota + liquidaciones + alertas +28hs + 6 gráficos con filtros
- Check diario (detecta automáticamente PE vs estándar según país activo)
- Planificación semanal por cliente (requiere país seleccionado si es super_admin)
- Historial con filtros, badges (GPS/rastreador/precinto/peón), fotos clickeables (Drive), exportar CSV completo (~55 columnas incluyendo todos los campos de Perú)
- Satelital: mapa Leaflet, semáforos GPS, vincular rastreador (solo vivo en Chile)
- 💰 Liquidación: dashboard, alertas, tabs, CSV
- Empresas, Vehículos, Conductores (con foto a Drive + creación de usuario), Clientes: CRUD completo con soft delete (super_admin)
- Usuarios: crear vía `/api/crear-usuario`
- Alertas: vencimientos automáticos a 30 días
- Países (super_admin): selector global persistente con bandera

### App operador (`operador.html`)
- Login con Supabase Auth
- Check diario — estándar O Perú según país detectado del perfil
- 💰 Liquidación: ver planillas propias, crear nuevas (no puede cerrar), alerta de pendientes
- Historial filtrado por operador, con fotos
- Mapa GPS del dispositivo (geolocalización del navegador)
- Offline-first: IndexedDB para checks pendientes + sincronización automática al recuperar conexión
- Service Worker para funcionamiento sin conexión
- Empaquetable como APK vía webintoapp.com apuntando a `https://fleet-ops-kohl.vercel.app/operador.html`

---

## Pendientes / cosas a verificar en el futuro

- [ ] Confirmar que todos los perfiles viejos (`profiles`) tengan `pais_id` asignado correctamente (corrida puntual de SQL, no automatizada)
- [ ] Evaluar si el checklist de Perú debe compartir código entre `index.html` y `operador.html` (actualmente está duplicado en ambos archivos por ser HTML/JS standalone sin build step)
- [ ] Posible checklist diferenciado para otros países a futuro (mismo patrón que Perú)
- [ ] Rate limiter + validación Zod en app.js (recomendado por IT, prioridad baja)
- [ ] Revisar vínculo conductor↔vehículo para el ranking de "Top conductores" si se necesita precisión histórica exacta (hoy usa la asignación actual, no la del día del check)

---

## Cómo retomar el trabajo

1. Subí este documento al chat
2. Indicá qué querés hacer (nueva funcionalidad, fix de bug, etc.)
3. Si es relevante, compartí también el archivo `index.html` y/o `operador.html` actualizados desde tu repo de GitHub, ya que este documento describe el estado y los patrones, pero el código fuente real vive en el repositorio
4. Recordá siempre el flujo de trabajo: Claude genera el cambio → te lo entrega para descargar → reemplazás en tu carpeta local → `git add . && git commit -m "..." && git push` → Vercel redeploya automáticamente
