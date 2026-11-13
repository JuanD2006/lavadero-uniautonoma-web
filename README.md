# API Lavadero Uniautónoma — Programa de Fidelidad

API REST en **Node.js + Express + MongoDB (Mongoose)** para gestionar los lavados de vehículos de estudiantes de la **Universidad Autónoma del Cauca**.

**Regla de negocio principal:** después de **10 lavados pagados**, el **siguiente (el 11.º) es totalmente gratis**. Luego el ciclo se reinicia.

**Parcial 2  API REST con Node.js y MongoDB**

- **Integrantes:JUAN DAVID ANAYA LOPEZ - FERNEY ARTURO DIAZ CERQUERA** 
- **Docente: DIEGO FERNANDO PRADO OSORIO** 



## Estructura
```
src/
├── config/db.js            # conexión a MongoDB
├── models/                 # Estudiante, Vehiculo, Lavado
├── controllers/            # lógica de cada funcionalidad
├── routes/                 # endpoints REST
├── middlewares/errores.js  # manejo global de errores (400/404/500)
├── app.js
└── server.js
```

## Modelo de datos (colecciones)
- **estudiantes**: nombre, codigo (único), correo (único), programa, telefono, lavadosPagados (ciclo), lavadosTotales, lavadosGratisUsados


- **vehiculos**: placa (única), tipo (`carro`/`moto`), marca, color, estudiante (ref)


- **lavados**: estudiante (ref), vehiculo (ref), tipoLavado (`basico` $15.000 / `completo` $25.000), precio, esGratis, numeroLavadoEstudiante

## Historias de usuario y funcionalidades

| N.º | Historia de usuario | Funcionalidad | Endpoint y método | Resultado esperado |
|---|---|---|---|---|
| 1 | Como **estudiante**, quiero registrarme en el programa, para participar y acumular lavados hacia uno gratis. | Registrar estudiante | `POST /api/estudiantes` | 201 + estudiante creado. 400 si faltan datos o el código/correo se repite |
| 2 | Como **administrador del lavadero**, quiero listar y filtrar estudiantes por programa, para conocer quiénes participan. | Listar/filtrar estudiantes | `GET /api/estudiantes?programa=` | 200 + lista |
| 3 | Como **administrador**, quiero consultar un estudiante con sus vehículos, para atenderlo rápidamente en caja. | Consultar estudiante por id | `GET /api/estudiantes/:id` | 200 + estudiante y vehículos. 404 si no existe |
| 4 | Como **estudiante**, quiero actualizar mi teléfono o correo, para que el lavadero pueda contactarme. | Actualizar estudiante | `PUT /api/estudiantes/:id` | 200 + datos actualizados |
| 5 | Como **estudiante**, quiero registrar mi vehículo, para que mis lavados queden asociados a él. | Registrar vehículo | `POST /api/vehiculos` | 201 + vehículo. 404 si el estudiante no existe. 400 si placa repetida o tipo inválido |
| 6 | Como **operario**, quiero buscar un vehículo por placa, para identificar al dueño al llegar al lavadero. | Buscar vehículo por placa/tipo | `GET /api/vehiculos?placa=` | 200 + vehículos con datos del dueño |
| 7 | Como **estudiante**, quiero que mi lavado se registre y se cobre según mi historial, para que el lavado número 11 sea gratis. | Registrar lavado con regla de fidelidad | `POST /api/lavados` | 201; precio normal o `0` y `esGratis: true` tras 10 pagados |
| 8 | Como **estudiante**, quiero consultar cuántos lavados me faltan, para saber cuándo tendré mi lavado gratis. | Consultar fidelidad | `GET /api/estudiantes/:id/fidelidad` | 200 + lavados restantes |
| 9 | Como **administrador**, quiero buscar el historial de lavados por nombre, código o placa (sin listar el historial de todos), para controlar ingresos y promociones. | Historial por buscador con total cobrado | `GET /api/lavados?q=&gratis=&desde=&hasta=` | 200 + lista y `totalCobrado`; 400 si no se busca |
| 10 | Como **estudiante**, quiero eliminar un vehículo que ya vendí, para que no aparezca en mi perfil. | Eliminar vehículo | `DELETE /api/vehiculos/:id` | 200. 404 si no existe |

## Ejemplos de cuerpos JSON
**POST /api/estudiantes**
```json
{ "nombre": "Laura Gómez", "codigo": "20231001", "correo": "laura@uniautonoma.edu.co", "programa": "Ingeniería de Sistemas", "telefono": "3001234567" }


```
**POST /api/vehiculos**
```json
{ "placa": "ABC123", "tipo": "carro", "marca": "Mazda", "color": "Rojo", "estudiante": "<ID_ESTUDIANTE>" }
```


**POST /api/lavados**
```json
{ "estudiante": "<ID_ESTUDIANTE>", "vehiculo": "<ID_VEHICULO>", "tipoLavado": "basico" }
```



## Códigos de estado
`200` / `201` éxito · `400` datos inválidos, duplicados o JSON mal formado · `404` recurso no encontrado · `500` error interno

## Pruebas
Importar `Lavadero_Uniautonoma.postman_collection.json` en **Postman** o **Thunder Client** (Collections → Import). Las peticiones 1 y 5 guardan automáticamente los IDs en variables de la colección. Guion de sustentación en `SUSTENTACION.md`.

---

## Interfaz web

Con el servidor corriendo (`npm start`), abre **http://localhost:3000** en el navegador.
La carpeta `public/` (HTML, CSS y JS puro) consume la API en `/api`; no necesita instalar nada más.

Al abrirla pide **iniciar sesión** (usuarios en la sección de autenticación). Pestañas: Estudiantes · Vehículos · Registrar lavado · Historial (el usuario *lector* solo ve consultas).

**Estudiantes:** si no tienen cuenta, en la pantalla de inicio pulsan **Crear una cuenta**, escriben su nombre y una contraseña, y luego inician sesión con ese mismo nombre (su *usuario*) y esa contraseña. Al entrar solo ven **su propia fidelidad**.


---

## Autenticación (inicio de sesión, registro de estudiantes y roles)

La API exige **iniciar sesión**. Sin sesión, todas las rutas (menos el login) responden **401**.

**Cómo funciona (sesión en el servidor):**
1. `POST /api/auth/login` con `usuario` y `password`.
2. El servidor busca el usuario y compara la contraseña con el hash guardado (**scrypt**, incluido en Node; nunca se guarda en texto plano y cada hash lleva su propia *sal*).
3. Si coincide, crea una **sesión** (un identificador aleatorio de 256 bits guardado en el servidor, con vencimiento de `SESSION_HOURS`) y la entrega al navegador en una **cookie** `HttpOnly` y `SameSite=Strict`. HttpOnly impide que el JavaScript de la página la lea; SameSite=Strict evita que otro sitio la use.
4. En cada petición el navegador envía la cookie y el middleware `verificarSesion` busca esa sesión. `POST /api/auth/logout` la destruye.

**Autenticación vs. autorización**
- *Autenticación* (`verificarSesion`): ¿quién eres? → 401 si no hay sesión o expiró.
- *Autorización* (`soloLecturaParaLector`): ¿qué puedes hacer? → 403 si un usuario **lector** intenta crear, editar o eliminar.

| Usuario inicial | Contraseña (`.env`) | Rol | Permisos |
|---|---|---|---|
| `admin` | `ADMIN_PASSWORD` (por defecto `admin123`) | admin | Todo |
| `lector` | `LECTOR_PASSWORD` (por defecto `lector123`) | lector | Solo consultar (GET) |

**Registro de estudiantes** — `POST /api/auth/registro` (pública) con `{ "nombre": "Juan Pérez", "password": "mínimo 6 caracteres" }`:
- El **usuario** es el nombre escrito (se ignoran mayúsculas y espacios de más: `Juan  PÉREZ` = `juan pérez`). Responde **201**; no inicia sesión sola, la persona entra después por `/login`.
- **400** si el nombre tiene menos de 2 caracteres, la contraseña menos de 6, o el nombre es `admin`/`lector`. **409** si ya existe una cuenta con ese nombre.
- El rol lo fija **siempre el servidor** (`estudiante`); el cliente no puede pedirse `admin`.
- Si el administrador ya registró al estudiante con ese mismo nombre (sin distinguir tildes/mayúsculas), la cuenta se enlaza con su ficha. Si no hay ficha, o hay dos con el mismo nombre, no se adivina: la cuenta queda sin enlazar.
- `GET /api/auth/mi-fidelidad` devuelve **solo** el progreso del propio estudiante (sin correo ni teléfono). El rol `estudiante` recibe **403** en `/api/estudiantes`, `/api/vehiculos` y `/api/lavados`, para que nadie vea datos de otros.

| Rol | Cómo se obtiene | Permisos |
|---|---|---|
| admin | Se crea al arrancar (seed) | Todo |
| lector | Se crea al arrancar (seed) | Solo consultar (GET) |
| estudiante | Se registra desde la web o `POST /api/auth/registro` | Solo su propia fidelidad |

**Cuentas automáticas para estudiantes ya registrados** (`src/utils/cuentasEstudiantes.js`):
Al arrancar el servidor (`npm start`) se crea una cuenta para cada estudiante de la colección `estudiantes` que todavía no tenga una, y también cuando el administrador registra un estudiante nuevo. Es idempotente: reiniciar no duplica nada.

| Estudiante | Usuario | Contraseña |
|---|---|---|
| Juan Pérez | `juan` | `juan123` |
| María José López | `maria` | `maria123` |
| José Ángel Ñúñez | `jose` | `jose123` |

- Usuario y contraseña van en **minúsculas y sin tildes**. En el login se acepta el usuario con o sin tilde y con cualquier mayúscula (`José` = `jose`); la contraseña sí distingue mayúsculas.
- Si el primer nombre ya lo usa otra persona, el usuario pasa a ser *primer nombre + primer apellido* (`juan gomez`); la contraseña sigue siendo `juan123`.
- Si ni así hay nombre libre (dos estudiantes con el mismo nombre completo), esa persona queda sin cuenta y el servidor lo avisa en consola.
- Un nombre que empiece por `admin` o `lector` nunca pisa a esos usuarios.
- Quien ya tiene cuenta automática y pulsa "Crear una cuenta" recibe 409 con la indicación de entrar con su primer nombre.

**Cambiar la contraseña** — `POST /api/auth/cambiar-password` (requiere sesión) con `{ "passwordActual": "...", "passwordNueva": "..." }`. En la web: botón **Cambiar contraseña**, junto a "Salir".
- Sirve para cualquier rol y solo cambia la contraseña de **quien tiene la sesión iniciada**.
- Exige la contraseña actual (400 si es incorrecta), la nueva con mínimo 6 caracteres y distinta de la actual.
- Al cambiarla se cierran las **demás sesiones** de ese usuario (otros navegadores o dispositivos); la actual sigue abierta.
- Reiniciar el servidor **no** restablece la contraseña a `nombre123`: las cuentas automáticas solo se crean para quien aún no tiene una.
- Si alguien **olvida** la contraseña no hay recuperación automática: hay que borrar su usuario en MongoDB (colección `usuarios`) y reiniciar el servidor, y su cuenta se vuelve a crear con `nombre123`.

Limitación conocida: como el usuario es el nombre, **dos personas con el mismo nombre exacto no pueden tener cuentas separadas** (la segunda recibe 409 y debe añadir, por ejemplo, su segundo apellido).

Archivos: `src/models/Usuario.js`, `src/utils/password.js`, `src/controllers/auth.controller.js`, `src/middlewares/auth.js`, `src/routes/auth.routes.js`.

Variables del `.env` (ver `.env.example`): `SESSION_HOURS`, `ADMIN_PASSWORD`, `LECTOR_PASSWORD`.
Las sesiones viven en la memoria del servidor: si lo reinicias, hay que volver a iniciar sesión.

## Historial por buscador (consulta asíncrona)

El historial **ya no se lista completo**. `GET /api/lavados?q=texto` busca por **nombre, código o placa** (mínimo 2 caracteres) y devuelve como máximo 50 lavados.
Sin `q` responde 400. Filtros opcionales: `gratis=true|false`, `desde`, `hasta` (AAAA-MM-DD), `limite`.

En la web, la pestaña **Historial** consulta mientras se escribe, de forma asíncrona (`fetch` + `async/await`):
- **Debounce de 350 ms:** no lanza una petición por cada letra.
- **AbortController:** al seguir escribiendo cancela la consulta anterior.
- Descarta respuestas viejas que lleguen tarde.

## Probar en Postman
Importa la colección y ejecuta **0. Login ADMIN**: Postman guarda la cookie de sesión solo y la envía en las demás peticiones. Con **0h. Cambiar contraseña** pruebas el cambio (ajusta los valores del cuerpo a tu usuario). Con **0e. Registro de estudiante** y **0f. Login estudiante** pruebas el flujo de cuenta propia (y el 403 de **Extra: estudiante intenta ver estudiantes**). Con **0b. Login LECTOR** puedes comprobar el error 403 al intentar escribir, y con **0d. Cerrar sesión** terminar la sesión.
