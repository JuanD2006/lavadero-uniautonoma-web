/* Lavadero Uniautónoma – interfaz web (JS puro, sin dependencias) */
const API = '/api';
const PRECIOS = { basico: 15000, completo: 25000 }; // deben coincidir con lavados.controller.js
const TOPE = 10; // lavadas pagadas para ganar una gratis

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- utilidades ---------- */

// Crea elementos de forma segura (usa texto, nunca innerHTML)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function toast(mensaje, tipo = 'ok', detalles = []) {
  const t = h('div', { class: `toast ${tipo === 'error' ? 'toast--error' : ''}` }, mensaje);
  if (detalles.length) t.append(h('ul', {}, detalles.map(d => h('li', {}, d))));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 6500 : 3500);
}

function mostrarError(e) {
  if (e instanceof TypeError) {
    toast('No se pudo conectar con el servidor. ¿Está corriendo "npm start"?', 'error');
  } else {
    toast(e.message || 'Ocurrió un error', 'error', e.detalles || []);
  }
}

/* ---------- sesión ---------- */
// La sesión vive en el servidor y el navegador la identifica con una cookie HttpOnly
// (el JavaScript no puede leerla). fetch envía la cookie solo en cada petición a /api.
const sesion = { usuario: null };

async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
    signal
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (res.status === 401 && path !== '/auth/login' && sesion.usuario) { // la sesión que tenías expiró
    cerrarSesion((data && data.mensaje) || 'Inicia sesión para continuar');
  }
  if (!res.ok || (data && data.ok === false)) {
    const err = new Error((data && data.mensaje) || `Error ${res.status}`);
    err.detalles = (data && data.errores) || [];
    throw err;
  }
  return data;
}

const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null) p.append(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const formData = (form) => Object.fromEntries(new FormData(form).entries());
const fecha = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
const vacio = (tbody, cols, texto) => tbody.replaceChildren(h('tr', {}, h('td', { colspan: cols, class: 'empty' }, texto)));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const nombreTipo = (t) => ({ basico: 'Básico' }[t] || cap(t));

/* ---------- modal ---------- */

function abrirModal(titulo, contenido) {
  const cerrar = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) cerrar(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal__head' },
        h('h3', {}, titulo),
        h('button', { class: 'modal__close', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
      contenido));
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return cerrar;
}

/* ---------- widget de fidelidad ---------- */

function widgetFidelidad({ nombre, pagados, gratisUsados, totales }) {
  const listo = pagados >= TOPE;
  const faltan = Math.max(TOPE - pagados, 0);
  const puntos = Array.from({ length: TOPE }, (_, i) =>
    h('div', { class: `dot ${i < pagados ? 'is-on' : ''}` }, i + 1));
  return h('div', {},
    nombre ? h('div', { class: 'fid__name' }, nombre) : null,
    h('div', { class: 'fid__sub' }, `Ciclo actual: ${Math.min(pagados, TOPE)} de ${TOPE} lavadas pagadas`),
    h('div', { class: `dots ${listo ? 'dots--ready' : ''}` }, puntos),
    h('div', { class: `fid__msg ${listo ? 'is-ready' : ''}` },
      listo ? '🎉 ¡El próximo lavado es GRATIS!' : `Faltan ${faltan} lavada${faltan === 1 ? '' : 's'} para una gratis`),
    h('div', { class: 'fid__stats' },
      h('div', { class: 'mini-stat' }, h('b', {}, totales), h('span', {}, 'Lavadas totales')),
      h('div', { class: 'mini-stat' }, h('b', {}, gratisUsados), h('span', {}, 'Gratis usadas')),
      h('div', { class: 'mini-stat' }, h('b', {}, pagados), h('span', {}, 'En el ciclo'))));
}

/* ---------- navegación ---------- */

const vistas = {
  estudiantes: () => cargarEstudiantes(),
  vehiculos: () => cargarVehiculos(),
  lavar: () => refrescarSelectores().then(() => seleccionarEstudianteLavado()),
  historial: () => buscarHistorial(),
  cuenta: () => cargarCuenta()
};

function irA(nombre) {
  const rol = sesion.usuario && sesion.usuario.rol;
  if (rol === 'estudiante') nombre = 'cuenta';                     // los estudiantes solo ven su cuenta
  else if (nombre === 'cuenta') nombre = 'estudiantes';
  if (nombre === 'lavar' && rol === 'lector') nombre = 'estudiantes';
  $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.view === nombre));
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${nombre}`));
  vistas[nombre]().catch(mostrarError);
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) irA(b.dataset.view);
});

/* ---------- selectores de estudiantes (compartidos) ---------- */

let estudiantesTodos = [];

async function refrescarSelectores() {
  const { data } = await api('/estudiantes');
  estudiantesTodos = data;
  const llenar = (sel, primera) => {
    const actual = sel.value;
    sel.replaceChildren(h('option', { value: '' }, primera),
      ...data.map(e => h('option', { value: e._id }, `${e.nombre} (${e.codigo})`)));
    if (data.some(e => e._id === actual)) sel.value = actual;
  };
  llenar($('#veh-estudiante'), data.length ? 'Selecciona un estudiante…' : 'No hay estudiantes registrados');
  llenar($('#lav-estudiante'), data.length ? 'Selecciona un estudiante…' : 'No hay estudiantes registrados');
}

/* ================= ESTUDIANTES ================= */

async function cargarEstudiantes() {
  const tbody = $('#tabla-estudiantes');
  const filtro = formData($('#filtro-estudiantes'));
  const { data } = await api('/estudiantes' + qs(filtro));
  if (!data.length) return vacio(tbody, 5, 'No hay estudiantes para mostrar.');
  tbody.replaceChildren(...data.map(e => h('tr', {},
    h('td', {}, e.codigo),
    h('td', {}, h('strong', {}, e.nombre), h('div', { class: 'fid__sub', style: 'margin:0' }, e.correo)),
    h('td', {}, e.programa),
    h('td', { class: 'num' }, e.lavadosTotales),
    h('td', { class: 'actions' },
      h('button', { class: 'btn btn--sm', onclick: () => verEstudiante(e._id) }, 'Ver'),
      h('button', { class: 'btn btn--sm solo-admin', onclick: () => editarEstudiante(e) }, 'Editar')))));
}

async function verEstudiante(id) {
  try {
    const [{ data: e }, { data: f }] = await Promise.all([
      api(`/estudiantes/${id}`), api(`/estudiantes/${id}/fidelidad`)
    ]);
    const vehiculos = e.vehiculos || [];
    abrirModal(e.nombre, h('div', {},
      h('dl', { class: 'kv' },
        h('dt', {}, 'Código'), h('dd', {}, e.codigo),
        h('dt', {}, 'Correo'), h('dd', {}, e.correo),
        h('dt', {}, 'Programa'), h('dd', {}, e.programa),
        h('dt', {}, 'Teléfono'), h('dd', {}, e.telefono || '—')),
      widgetFidelidad({
        pagados: f.lavadosPagadosEnCiclo, gratisUsados: f.lavadosGratisUsados, totales: f.lavadosTotales
      }),
      h('h4', {}, 'Vehículos'),
      vehiculos.length
        ? h('div', { class: 'chips' }, vehiculos.map(v => h('span', { class: 'chip' },
            h('span', { class: 'placa' }, v.placa), ` · ${cap(v.tipo)} ${v.marca}`)))
        : h('div', { class: 'fid__sub' }, 'Sin vehículos registrados.')));
  } catch (err) { mostrarError(err); }
}

function editarEstudiante(e) {
  const form = h('form', { autocomplete: 'off' },
    h('label', {}, 'Nombre', h('input', { name: 'nombre', required: true, value: e.nombre })),
    h('label', {}, 'Correo', h('input', { name: 'correo', type: 'email', required: true, value: e.correo })),
    h('label', {}, 'Programa', h('input', { name: 'programa', required: true, value: e.programa })),
    h('label', {}, 'Teléfono', h('input', { name: 'telefono', value: e.telefono || '' })),
    h('div', { class: 'fid__sub' }, `Código estudiantil: ${e.codigo} (no se puede cambiar)`),
    h('button', { class: 'btn btn--primary', type: 'submit' }, 'Guardar cambios'));
  const cerrar = abrirModal('Editar estudiante', form);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api(`/estudiantes/${e._id}`, { method: 'PUT', body: formData(form) });
      toast('Estudiante actualizado');
      cerrar();
      await cargarEstudiantes();
      await refrescarSelectores();
    } catch (err) { mostrarError(err); }
  });
}

$('#form-estudiante').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  try {
    const r = await api('/estudiantes', { method: 'POST', body: formData(form) });
    toast(r.cuenta ? `Estudiante registrado · usuario de acceso: ${r.cuenta.usuario}` : 'Estudiante registrado');
    form.reset();
    await cargarEstudiantes();
    await refrescarSelectores();
  } catch (err) { mostrarError(err); }
});

$('#filtro-estudiantes').addEventListener('submit', (ev) => { ev.preventDefault(); cargarEstudiantes().catch(mostrarError); });
$('#filtro-estudiantes').addEventListener('reset', () => setTimeout(() => cargarEstudiantes().catch(mostrarError)));

/* ================= VEHÍCULOS ================= */

async function cargarVehiculos() {
  await refrescarSelectores();
  const tbody = $('#tabla-vehiculos');
  const filtro = formData($('#filtro-vehiculos'));
  const { data } = await api('/vehiculos' + qs(filtro));
  if (!data.length) return vacio(tbody, 6, 'No hay vehículos para mostrar.');
  tbody.replaceChildren(...data.map(v => h('tr', {},
    h('td', {}, h('span', { class: 'placa' }, v.placa)),
    h('td', {}, h('span', { class: 'badge' }, cap(v.tipo))),
    h('td', {}, v.marca),
    h('td', {}, v.color || '—'),
    h('td', {}, v.estudiante ? `${v.estudiante.nombre}` : '—'),
    h('td', { class: 'actions' },
      h('button', { class: 'btn btn--sm btn--danger solo-admin', onclick: () => eliminarVehiculo(v) }, 'Eliminar')))));
}

async function eliminarVehiculo(v) {
  if (!confirm(`¿Eliminar el vehículo ${v.placa}?\nEl historial de lavados se conserva.`)) return;
  try {
    await api(`/vehiculos/${v._id}`, { method: 'DELETE' });
    toast(`Vehículo ${v.placa} eliminado`);
    await cargarVehiculos();
  } catch (err) { mostrarError(err); }
}

$('#form-vehiculo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const body = formData(form);
  body.placa = body.placa.trim().toUpperCase();
  try {
    await api('/vehiculos', { method: 'POST', body });
    toast(`Vehículo ${body.placa} registrado`);
    form.reset();
    await cargarVehiculos();
  } catch (err) { mostrarError(err); }
});

$('#filtro-vehiculos').addEventListener('submit', (ev) => { ev.preventDefault(); cargarVehiculos().catch(mostrarError); });
$('#filtro-vehiculos').addEventListener('reset', () => setTimeout(() => cargarVehiculos().catch(mostrarError)));

/* ================= REGISTRAR LAVADO ================= */

let estudianteLavado = null; // { ...estudiante, vehiculos: [...] }

$('#precio-basico').textContent = COP.format(PRECIOS.basico);
$('#precio-completo').textContent = COP.format(PRECIOS.completo);

function tipoSeleccionado() {
  return ($('input[name="tipoLavado"]:checked') || {}).value || 'basico';
}

function actualizarResumen() {
  const resumen = $('#lav-resumen');
  const submit = $('#lav-submit');
  const vehiculo = $('#lav-vehiculo').value;
  resumen.classList.remove('is-free');
  if (!estudianteLavado) {
    resumen.textContent = 'Elige un estudiante para ver el valor a cobrar.';
    submit.disabled = true;
    return;
  }
  const gratis = estudianteLavado.lavadosPagados >= TOPE;
  if (gratis) {
    resumen.classList.add('is-free');
    resumen.replaceChildren('Este lavado es ', h('strong', {}, 'GRATIS'), ' por fidelidad 🎉');
  } else {
    resumen.replaceChildren('Valor a cobrar: ', h('strong', {}, COP.format(PRECIOS[tipoSeleccionado()])));
  }
  submit.disabled = !vehiculo;
}

async function seleccionarEstudianteLavado() {
  const id = $('#lav-estudiante').value;
  const selVeh = $('#lav-vehiculo');
  const panel = $('#lav-fidelidad');
  if (!id) {
    estudianteLavado = null;
    selVeh.replaceChildren(h('option', { value: '' }, 'Primero elige un estudiante'));
    selVeh.disabled = true;
    panel.className = 'empty';
    panel.textContent = 'Selecciona un estudiante para ver su progreso.';
    return actualizarResumen();
  }
  const { data } = await api(`/estudiantes/${id}`);
  estudianteLavado = data;
  const vehiculos = data.vehiculos || [];
  const previo = selVeh.value;
  if (vehiculos.length) {
    selVeh.replaceChildren(...vehiculos.map(v =>
      h('option', { value: v._id }, `${v.placa} · ${cap(v.tipo)} ${v.marca}`)));
    selVeh.disabled = false;
    if (vehiculos.some(v => v._id === previo)) selVeh.value = previo;
  } else {
    selVeh.replaceChildren(h('option', { value: '' }, 'Este estudiante no tiene vehículos'));
    selVeh.disabled = true;
  }
  panel.className = '';
  panel.replaceChildren(widgetFidelidad({
    nombre: data.nombre, pagados: data.lavadosPagados,
    gratisUsados: data.lavadosGratisUsados, totales: data.lavadosTotales
  }), vehiculos.length ? '' : h('div', { class: 'resultado', style: 'background:#fef3c7;color:#92600a' },
    'Registra un vehículo para este estudiante en la pestaña "Vehículos".'));
  actualizarResumen();
}

$('#lav-estudiante').addEventListener('change', () => {
  $('#lav-resultado').replaceChildren();
  seleccionarEstudianteLavado().catch(mostrarError);
});
$('#lav-vehiculo').addEventListener('change', actualizarResumen);
$$('input[name="tipoLavado"]').forEach(r => r.addEventListener('change', actualizarResumen));

$('#form-lavado').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!estudianteLavado) return;
  const submit = $('#lav-submit');
  submit.disabled = true;
  try {
    const res = await api('/lavados', {
      method: 'POST',
      body: {
        estudiante: estudianteLavado._id,
        vehiculo: $('#lav-vehiculo').value,
        tipoLavado: tipoSeleccionado()
      }
    });
    const l = res.data;
    toast(res.mensaje);
    $('#lav-resultado').replaceChildren(h('div', { class: `resultado ${l.esGratis ? 'is-free' : ''}` },
      `${res.mensaje} · ${nombreTipo(l.tipoLavado)} · ${l.esGratis ? 'Gratis' : COP.format(l.precio)}`,
      h('div', { style: 'font-weight:400;margin-top:4px' }, `Lavado n.º ${l.numeroLavadoEstudiante} de este estudiante.`)));
    await seleccionarEstudianteLavado();
  } catch (err) {
    mostrarError(err);
    actualizarResumen();
  }
});

/* ================= HISTORIAL (por buscador, consulta asíncrona) ================= */
// No se carga el historial completo: solo se consulta cuando la persona escribe en el buscador.
// - Debounce: espera 350 ms sin teclear antes de consultar (evita una petición por cada letra).
// - AbortController: si escribe de nuevo, cancela la consulta anterior.
// - histSeq: descarta respuestas viejas que lleguen tarde.

let histTimer = null;
let histCtrl = null;
let histSeq = 0;

function estadoHistorial(texto, cargando = false) {
  const el = $('#his-estado');
  el.className = `search-state${cargando ? ' is-loading' : ''}`;
  el.textContent = texto;
}

function limpiarResultadosHistorial() {
  $('#his-tabla-wrap').hidden = true;
  $('#his-stats').replaceChildren();
}

async function buscarHistorial() {
  clearTimeout(histTimer);
  if (histCtrl) histCtrl.abort();

  const f = formData($('#filtro-historial'));
  const q = (f.q || '').trim();

  if (q.length < 2) {
    histSeq++;
    limpiarResultadosHistorial();
    estadoHistorial(q ? 'Escribe al menos 2 caracteres…' : 'Escribe un nombre, código o placa para ver su historial.');
    return;
  }

  const ctrl = new AbortController();
  histCtrl = ctrl;
  const mi = ++histSeq;
  estadoHistorial('Buscando…', true);

  try {
    const r = await api('/lavados' + qs({ ...f, q, limite: 50 }), { signal: ctrl.signal });
    if (mi !== histSeq) return; // llegó tarde: ya hay una búsqueda más nueva

    $('#his-stats').replaceChildren(
      h('div', { class: 'stat' }, h('span', {}, 'Lavados encontrados'), h('b', {}, r.total)),
      h('div', { class: 'stat' }, h('span', {}, 'Total cobrado'), h('b', {}, COP.format(r.totalCobrado))),
      h('div', { class: 'stat' }, h('span', {}, 'Lavados gratis'), h('b', {}, r.totalGratis)));

    if (!r.data.length) {
      $('#his-tabla-wrap').hidden = true;
      return estadoHistorial(`No se encontraron lavados para “${q}”.`);
    }
    estadoHistorial(r.total > r.mostrando ? `Mostrando los ${r.mostrando} más recientes de ${r.total}. Afina la búsqueda para ver otros.` : '');
    $('#tabla-historial').replaceChildren(...r.data.map(l => h('tr', {},
      h('td', {}, fecha(l.createdAt)),
      h('td', {}, l.estudiante ? l.estudiante.nombre : '—'),
      h('td', {}, l.vehiculo ? h('span', { class: 'placa' }, l.vehiculo.placa) : h('em', {}, 'Eliminado')),
      h('td', {}, nombreTipo(l.tipoLavado)),
      h('td', { class: 'num' }, COP.format(l.precio)),
      h('td', {}, h('span', { class: `badge ${l.esGratis ? 'badge--free' : 'badge--paid'}` }, l.esGratis ? 'Gratis' : 'Pagado')))));
    $('#his-tabla-wrap').hidden = false;
  } catch (err) {
    if (err.name === 'AbortError' || mi !== histSeq) return;
    limpiarResultadosHistorial();
    estadoHistorial('');
    mostrarError(err);
  }
}

const formHistorial = $('#filtro-historial');
formHistorial.addEventListener('submit', (ev) => { ev.preventDefault(); buscarHistorial(); });
formHistorial.addEventListener('input', (ev) => {
  if (ev.target.id !== 'his-q') return;
  clearTimeout(histTimer);
  histTimer = setTimeout(buscarHistorial, 350);
});
formHistorial.addEventListener('change', (ev) => { if (ev.target.id !== 'his-q') buscarHistorial(); });
formHistorial.addEventListener('reset', () => setTimeout(buscarHistorial));

/* ================= MI CUENTA (estudiante) ================= */

async function cargarCuenta() {
  const cont = $('#cuenta-contenido');
  const r = await api('/auth/mi-fidelidad');
  if (!r.vinculado) {
    cont.className = 'empty';
    cont.replaceChildren(
      h('p', {}, h('strong', {}, `Hola, ${r.nombre}`)),
      h('p', {}, 'Tu cuenta ya está creada, pero el lavadero aún no te tiene registrado como estudiante con este nombre.'),
      h('p', {}, 'Acércate al lavadero para que te registren (con el mismo nombre que usaste aquí) y vuelve a entrar para ver tu progreso.'));
    return;
  }
  cont.className = '';
  cont.replaceChildren(widgetFidelidad({
    nombre: r.nombre, pagados: r.lavadosPagadosEnCiclo,
    gratisUsados: r.lavadosGratisUsados, totales: r.lavadosTotales
  }));
}

/* ================= SESIÓN: login / registro / logout ================= */

function aplicarSesion() {
  const u = sesion.usuario;
  document.body.classList.toggle('rol-lector', !!u && u.rol === 'lector');
  document.body.classList.toggle('rol-estudiante', !!u && u.rol === 'estudiante');
  $('#user-box').hidden = !u;
  $('#login').hidden = !!u;
  if (u) {
    $('#user-nombre').textContent = u.nombre || u.usuario;
    $('#user-rol').textContent = { lector: 'Solo lectura', estudiante: 'Estudiante' }[u.rol] || 'Administrador';
  } else {
    setTimeout(() => $('#form-login').elements.usuario.focus());
  }
}

function cerrarSesion(mensaje = '') {
  sesion.usuario = null;
  clearTimeout(histTimer);
  if (histCtrl) histCtrl.abort();
  $$('.overlay:not(#login)').forEach(o => o.remove());   // cierra modales abiertos
  $('#form-login').reset();
  $('#form-registro').reset();
  mostrarFormulario('login');
  $('#login-error').textContent = mensaje;
  $('#login-ok').textContent = '';
  aplicarSesion();
}

// Alterna entre "Iniciar sesión" y "Crear cuenta" dentro de la misma pantalla
function mostrarFormulario(cual) {
  $('#form-login').hidden = cual !== 'login';
  $('#form-registro').hidden = cual !== 'registro';
  $('#login-error').textContent = '';
  $('#registro-error').textContent = '';
  const f = cual === 'login' ? $('#form-login') : $('#form-registro');
  setTimeout(() => f.querySelector('input').focus());
}
$('#ir-registro').addEventListener('click', () => { $('#login-ok').textContent = ''; mostrarFormulario('registro'); });
$('#ir-login').addEventListener('click', () => mostrarFormulario('login'));

$('#form-registro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const datos = formData(form);
  const error = $('#registro-error');
  error.textContent = '';
  if (datos.password !== datos.password2) { error.textContent = 'Las contraseñas no coinciden'; return; }
  const btn = $('#registro-submit');
  btn.disabled = true;
  try {
    const r = await api('/auth/registro', { method: 'POST', body: { nombre: datos.nombre, password: datos.password } });
    form.reset();
    mostrarFormulario('login');                      // la cuenta se crea; luego inicia sesión
    $('#form-login').elements.usuario.value = r.usuario;
    $('#login-ok').textContent = 'Cuenta creada. Ahora inicia sesión con tu nombre y contraseña.';
    setTimeout(() => $('#form-login').elements.password.focus());
  } catch (err) {
    error.textContent = err instanceof TypeError ? 'No se pudo conectar con el servidor' : err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#login-submit');
  btn.disabled = true;
  $('#login-error').textContent = '';
  $('#login-ok').textContent = '';
  try {
    const r = await api('/auth/login', { method: 'POST', body: formData(ev.target) });
    sesion.usuario = r.usuario;
    ev.target.reset();
    aplicarSesion();
    irA('estudiantes');
  } catch (err) {
    $('#login-error').textContent = err instanceof TypeError
      ? 'No se pudo conectar con el servidor' : err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#btn-clave').addEventListener('click', () => {
  const error = h('div', { class: 'login__error', role: 'alert' });
  const campo = (etiqueta, name, auto) => h('label', {}, etiqueta,
    h('input', { name, type: 'password', required: true, autocomplete: auto, maxlength: 100 }));
  const form = h('form', {},
    campo('Contraseña actual', 'passwordActual', 'current-password'),
    campo('Contraseña nueva (mínimo 6 caracteres)', 'passwordNueva', 'new-password'),
    campo('Repite la contraseña nueva', 'passwordNueva2', 'new-password'),
    error,
    h('button', { class: 'btn btn--primary', type: 'submit' }, 'Guardar contraseña'));
  const cerrar = abrirModal('Cambiar contraseña', form);
  form.elements.passwordActual.focus();
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = formData(form);
    error.textContent = '';
    if (d.passwordNueva.length < 6) { error.textContent = 'La contraseña nueva debe tener al menos 6 caracteres'; return; }
    if (d.passwordNueva !== d.passwordNueva2) { error.textContent = 'Las contraseñas nuevas no coinciden'; return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/auth/cambiar-password', { method: 'POST', body: { passwordActual: d.passwordActual, passwordNueva: d.passwordNueva } });
      cerrar();
      toast('Contraseña actualizada');
    } catch (err) {
      error.textContent = err instanceof TypeError ? 'No se pudo conectar con el servidor' : err.message;
      btn.disabled = false;
    }
  });
});

$('#btn-salir').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* igual se cierra en pantalla */ }
  cerrarSesion();
});

/* ---------- inicio ---------- */
// Si ya hay una sesión activa en el servidor (cookie), entra directo; si no, muestra el login.
(async () => {
  try {
    const r = await api('/auth/me');
    sesion.usuario = r.usuario;
    aplicarSesion();
    irA('estudiantes');
  } catch {
    aplicarSesion();
  }
})();
