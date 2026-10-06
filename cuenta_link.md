# Cuentas ↔ empresas ↔ dispositivos (`cuenta_link.md`)

Cómo cada login en Riper/ZTRACK obtiene **qué empresa Madurador** consulta y **qué IMEI** ve.  
Complementa `dispositivos_usuario.md` y `apis.md`.

---

## Modelo en una frase

```text
Usuario (email + rol + company + identificador)
    → reglas de flota en server/src/routes/madurador.js
        → una o más llamadas upstream:
          GET {MADURADOR_API_BASE}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={EMPRESA}
        → (opcional) filtro por allowlist de IMEI / empaquetado de panel
    → front (fleetDemo / gourmet / madurador.ts) refuerza filtros
```

**El rol** (`superadmin` / `admin` / `operator` / `viewer`) define **permisos** (control, usuarios, etc.).  
**Email + `identificador` + reglas de flota** definen **qué equipos** aparecen.

Upstream vivo (comprobar con curl):

```bash
curl -sS "{MADURADOR_API_BASE}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=7001"
```

Si esa URL responde `[]`, la cuenta ligada a esa empresa **no puede mostrar equipos** aunque el seed y el login estén bien.

---

## Links exactos: Ripener → upstream Madurador

Base por defecto (servidor):

```text
MADURADOR_API_BASE = http://161.132.53.51:9051
```

(si no hay override en `.env`)

**Endpoint interno (navegador / JWT):**

```http
GET {RIPENER}/api/v1/madurador/dispositivos
```

Ese endpoint **no es la fuente de datos**: el servidor Ripener llama a Madurador. Template único de lista:

```http
GET {MADURADOR_API_BASE}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={EMPRESA}
```

### Por cuenta — URLs concretas (defaults)

#### UltraOrganics (`*ultraorganics@riper.local`)

`ULTRAORGANICS_UPSTREAM_IDENTIFICADORES` def. `1001,2001,3001`. El servidor hace **3** GETs en paralelo y luego empaqueta paneles `MEX1001` / `MEX2001` / `MEX3001`:

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=1001
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=3001
```

Empaque (código `ultraorganicsFleet.js` + `madurador.js`):

| Panel UI | Etileno (IMEI) | Humedad (IMEI) |
|----------|----------------|----------------|
| MEX1001 | MEX1001 | MEX1002 |
| MEX2001 | MEX2001 | MEX2002 |
| MEX3001 | MEX3001 | MEX3001 |

Comandos (otra URL, no es la lista):

```http
GET http://161.132.53.51:9051/TermoKing/comando_control/{deviceId}?tipo={tipo}&dato={dato}
```

#### BRAEDT (`braedt@riper.local`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=7001
```

#### Demo Madurador (`demo-madurador@riper.local`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=6001
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=7001
```

#### Greenyard (`greenyard@riper.local`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=4001
```

Luego filtra allowlist: `NEWY2001`, `NEWY1001`.

#### Gourmet Trading (`gourmettrading@ztrack.app`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=5001
```

Luego allowlist IMEI Gourmet (túnel + standalone). Grupo túnel (dato agregado):

```http
GET http://161.132.53.51:9051/Unidos/leer_grupo_tunel/?grupo=TUNEL_GREAT
```

Comandos túnel:

```http
GET http://161.132.53.51:9051/Tunel/comando_control_tunel/{imei}?tipo={tipo}&dato={dato}
```

#### ThermoKing (`thermoking@riper.local`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=3001
```

Luego deja solo IMEI `PRUEBA_CA000001`.

#### Superadmin (`superadmin@riper.local`)

Varias llamadas (merge):

```http
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=2001
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=3001
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=4001
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=5001
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=6001
GET …/listar_dispositivos_proceso_identificador_empresa/?identificador=7001
```

(Base completa: `http://161.132.53.51:9051/Madurador/…`)

#### Demo flota (`demo-flota@riper.local`)

No usa `/api/v1/madurador/dispositivos` en el camino habitual; el front llama el proxy:

```http
GET {RIPENER}/api/v1/madurador-demo/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001
```

que reenvía a:

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001
```

#### Cliente genérico (`app_users.identificador = X`)

```http
GET http://161.132.53.51:9051/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={X}
```

### Historial (todas las flotas Madurador)

```http
GET http://161.132.53.51:9051/Madurador/buscar_datos_madurador_rango/?imei={IMEI}&fecha_inicio=…&fecha_fin=…
```

(Normalmente vía proxy Ripener / `madurador-demo`.)

### Validar ya (curl)

```bash
BASE=http://161.132.53.51:9051
# UltraOrganics
curl -sS "$BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=1001" | head -c 200
curl -sS "$BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=2001" | head -c 200
curl -sS "$BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=3001" | head -c 200
# BRAEDT
curl -sS "$BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=7001"
# Greenyard
curl -sS "$BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=4001" | head -c 200
```

---

## Tabla maestra

| Cuenta (email seed) | Empresa(s) Madurador | Cómo elige dispositivos | Control panel |
|---------------------|----------------------|-------------------------|---------------|
| `superadmin@riper.local` | **2001** + **3001** (pin) + **4001** + **5001** + **6001** + **7001** | Fusión de todas; pin IMEI en 3001; + simulados INKA-SIM en front | Normal (superadmin) |
| `demo-madurador@riper.local` | **6001** + **7001** | Lista completa de cada empresa (merge) | Según rol admin |
| `braedt@riper.local` | **7001** solo | Lista completa de empresa 7001 (sin filtro sufijo IMEI) | **Suspendido** hasta validación (`BRAEDT_CONTROL_ENABLED=1`) |
| `demo-flota@riper.local` | **2001** | Proxy demo / identificador 2001 | viewer |
| `*ultraorganics@riper.local` | **1001**, **2001**, **3001** | Empaqueta paneles `MEX1001/2001/3001` | Según rol |
| `thermoking@riper.local` | **3001** | Solo IMEI pin `PRUEBA_CA000001` | viewer |
| `greenyard@riper.local` | **4001** | Allowlist `NEWY2001`, `NEWY1001` | admin |
| `gourmettrading@ztrack.app` | **5001** | Túnel + standalone (IMEI pin Gourmet) | admin |
| Otro usuario con `identificador` en BD | Su `identificador` | Lista empresa + filtro cliente por **sufijo IMEI = identificador** | Según rol |

Código servidor: `server/src/routes/madurador.js`  
Seeds: `server/src/seed.js`  
Flotas: `server/src/*Fleet.js`, `server/src/braedtFleet.js`, `server/src/demoMaduradorFleet.js`

---

## Flujo técnico (lista de flota)

```text
Browser  GET /api/v1/madurador/dispositivos  (JWT)
   │
   ▼
Ripener decide por email / rol:
   │  superadmin     → merge empresas (wide + pin + greenyard + 5001 + extras 6001,7001)
   │  demo-madurador → merge 6001 + 7001
   │  BRAEDT         → solo 7001
   │  UltraOrganics  → varias empresas + empaque panel
   │  ThermoKing     → 3001 + pin IMEI
   │  Greenyard      → 4001 + allowlist IMEI
   │  Gourmet        → 5001 + allowlist IMEI
   │  genérico       → app_users.identificador (+ filtro sufijo IMEI en front)
   ▼
Upstream Madurador (por cada identificador de empresa)
   GET …/listar_dispositivos_proceso_identificador_empresa/?identificador={id}
   ▼
JSON { data: [...filas], meta: { source, degraded, empresa_identificador? } }
   ▼
Front mapMaduradorRowToDevice + filtros de sesión
```

Historial de gráficas (mismo alcance de IMEI):

```http
GET {MADURADOR}/Madurador/buscar_datos_madurador_rango/?imei={imei}&fecha_inicio=…&fecha_fin=…
```

(vía proxy Ripener / `VITE_MADURADOR_DEMO_API_URL`).

---

## Detalle por cuenta

### 1. Superadmin — `superadmin@riper.local`

| Campo | Valor |
|-------|--------|
| Detección | JWT `role === 'superadmin'` |
| Empresas | `SUPERUSER_MADURADOR_WIDE_EMPRESA_IDENTIFICADOR` (def. **2001**), pin **3001**, Greenyard **4001**, **5001**, extras **6001,7001** |
| Filtros | En 3001: IMEI `SUPERUSER_DEVICE_IMEI` (def. `PRUEBA_CA000001`; `*` = todos de 3001) |
| Front | + dispositivos simulados INKA-SIM |
| Env extras | `SUPERUSER_MADURADOR_EXTRA_EMPRESA_IDENTIFICADORES=6001,7001` (`NONE` = no cargar) |

El superadmin **sí incluye empresa 7001** en el merge. Si 7001 está vacía upstream, simplemente no aporta filas; el resto de empresas sí se ven.

---

### 2. Demo Madurador — `demo-madurador@riper.local`

| Campo | Valor |
|-------|--------|
| Detección | Email (`DEMO_MADURADOR_EMAIL`) |
| Empresas | `DEMO_MADURADOR_EMPRESA_IDENTIFICADORES` def. **6001,7001** |
| Lista | Merge completo de ambas (sin allowlist) |
| Contraseña seed | `madurador` / `DEMO_MADURADOR_PASSWORD` |

---

### 3. BRAEDT — `braedt@riper.local`  ← caso actual

| Campo | Valor |
|-------|--------|
| Detección | Email `BRAEDT_EMAIL` (def. `braedt@riper.local`) **o** `company = BRAEDT` en `app_users` |
| Empresa | `BRAEDT_IDENTIFICADOR` def. **7001** |
| Lista | **Solo** `listar_dispositivos…?identificador=7001` (lista completa, sin pin IMEI ni filtro sufijo) |
| Rol seed | `admin` |
| Contraseña seed | `braedt2026!` / `BRAEDT_PASSWORD` |
| Control | **Suspendido** (panel, túnel, inicio de proceso/seguimiento). Superadmin no se ve afectado. Habilitar: `BRAEDT_CONTROL_ENABLED=1` (+ opcional `VITE_BRAEDT_CONTROL_ENABLED=1`) |
| Código | `server/src/braedtFleet.js`, rama en `madurador.js`, seed `seedBraedtUser` |

#### Por qué puede verse “sin equipos”

Comprobado contra el upstream por defecto (`http://161.132.53.51:9051`):

| Identificador | Dispositivos (aprox.) |
|---------------|------------------------|
| 2001 | 5 (MEX…) |
| 4001 | 2 (NEWY…) |
| 6001 | 1 |
| **7001** | **0 (`[]`)** |

La cuenta BRAEDT está **correctamente enlazada a 7001**. Mientras Madurador no registre equipos bajo el identificador de empresa **7001**, el dashboard BRAEDT mostrará lista vacía.

**Qué hacer:**

1. En Madurador/backend de flota, asociar los IMEI de BRAEDT a la empresa **7001**.
2. Verificar:
   ```bash
   curl -sS "$MADURADOR_API_BASE/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=7001"
   ```
3. Si temporalmente los equipos están bajo otra empresa, cambiar `BRAEDT_IDENTIFICADOR` (y re-login), o migrar esos IMEI a 7001 en origen.
4. Reiniciar API Ripener tras seed/env para asegurar usuario `braedt@riper.local` con `identificador=7001` y `company=BRAEDT`.

---

### 4. Demo flota — `demo-flota@riper.local`

| Campo | Valor |
|-------|--------|
| Identificador | **2001** |
| Camino | Proxy `/api/v1/madurador-demo/…` (`maduradorFleetDirect.ts`), no la fusión superadmin |
| Rol | `viewer` |

---

### 5. UltraOrganics — `*ultraorganics@riper.local`

| Campo | Valor |
|-------|--------|
| Detección | Email termina en `ultraorganics@riper.local` |
| Upstream | Empresas **1001 / 2001 / 3001** (config UltraOrganics) |
| Panel | `MEX1001`, `MEX2001`, `MEX3001` (compañeros físicos empaquetados) |

---

### 6. ThermoKing — `thermoking@riper.local`

| Campo | Valor |
|-------|--------|
| Empresa | **3001** |
| Dispositivo | Pin `THERMOKING_DEVICE_IMEI` / `PRUEBA_CA000001` |
| Rol | `viewer` |

---

### 7. Greenyard — `greenyard@riper.local`

| Campo | Valor |
|-------|--------|
| Empresa | **4001** |
| Dispositivos | Allowlist `GREENYARD_DEVICE_IMEIS` → `NEWY2001`, `NEWY1001` |
| Código | `greenyardFleet.js` |

---

### 8. Gourmet Trading — `gourmettrading@ztrack.app`

| Campo | Valor |
|-------|--------|
| Empresa | **5001** |
| Dispositivos | Allowlist túnel + standalone (`gourmetFleet.js`); UI agrega `tunel:TUNEL_GREAT` |
| Comandos | Tunel / TermoKing según IMEI |

---

### 9. Cliente genérico (`app_users.identificador`)

Si el email **no** cae en ninguna flota especial:

1. Se lee `identificador` de `app_users`.
2. Se llama upstream con ese identificador.
3. En front suele aplicarse: solo IMEI cuyo **sufijo** coincide con el identificador (p. ej. ident `1001` → `MEX1001`).  
   Excepción: flotas demo/BRAEDT/superadmin ya vienen filtradas en servidor y **no** reaplica ese sufijo.

Sin `identificador` → lista vacía por Madurador.

---

## Variables de entorno relevantes

| Variable | Efecto |
|----------|--------|
| `MADURADOR_API_BASE` | Host upstream Madurador |
| `BRAEDT_EMAIL` / `BRAEDT_PASSWORD` / `BRAEDT_IDENTIFICADOR` | Cuenta y empresa BRAEDT (def. 7001) |
| `BRAEDT_CONTROL_ENABLED` | `1` = habilita control para BRAEDT |
| `DEMO_MADURADOR_EMPRESA_IDENTIFICADORES` | Def. `6001,7001` |
| `SUPERUSER_MADURADOR_EXTRA_EMPRESA_IDENTIFICADORES` | Def. `6001,7001` en merge superadmin |
| `GREENYARD_*` / `GOURMET_*` / `THERMOKING_*` / `ULTRAORGANICS_*` | Pins y empresas de cada flota |

---

## Checklist de diagnóstico (“no veo equipos”)

1. ¿Login correcto? Email exacto de la flota (p. ej. `braedt@riper.local`).
2. ¿Usuario en BD con `identificador` / `company` esperados? (seed al arrancar API).
3. ¿Upstream de esa empresa tiene filas?
   ```bash
   curl -sS "{MADURADOR_API_BASE}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador={ID}"
   ```
4. ¿Respuesta Ripener?
   ```bash
   curl -sS -H "Authorization: Bearer $TOKEN" "{RIPENER}/api/v1/madurador/dispositivos"
   ```
5. ¿Filtro front (Greenyard/Gourmet pin) descartando IMEI?
6. ¿Flota degradada / 502? Revisar `meta.degraded` y registry.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `server/src/routes/madurador.js` | Email/rol → empresas → lista |
| `server/src/braedtFleet.js` | Reglas BRAEDT + control suspendido |
| `server/src/seed.js` | Crea/actualiza usuarios e `identificador` |
| `src/app/lib/fleetDemo.ts` | Detección de sesión flota en front |
| `src/app/lib/madurador.ts` | Cliente lista + filtros |
| `src/app/lib/api.ts` | Orquestación `fetchDevices` |
| `dispositivos_usuario.md` | Vista complementaria por cuenta |
| `apis.md` | Catálogo de endpoints |

---

## Nota roles vs flota

- Misma flota puede compartirse entre `admin` / `operator` / `viewer` de la misma familia de email (p. ej. UltraOrganics).
- **BRAEDT** es `admin` pero el **control está suspendido** a propósito; el **superadmin** conserva control normal sobre los mismos IMEI cuando existen en su merge (incl. 7001).
