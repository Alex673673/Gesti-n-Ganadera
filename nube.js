/* ============================================================
   Gestión Ganadera — conexión con Supabase (cuentas y datos en la nube)
   - Cuentas: Supabase Auth (correo + contraseña). El perfil vive en la tabla «perfiles».
   - Datos: se descargan al entrar y se guardan también en el navegador (copia local).
     Cada cambio se sube comparando con la última versión conocida de la nube (solo lo que cambió).
   - Sin conexión: los cambios quedan pendientes y se suben al volver la conexión,
     sin borrar lo que otros (p. ej. el veterinario) hayan añadido mientras tanto.
   - Veterinario: ve la explotación del ganadero elegido y solo sube SUS tratamientos.
   Expone window.Nube. Depende de window.supabase (supabase-js v2) y window.APP_CONFIG (config.js).
   ============================================================ */
(function () {
  'use strict';

  const TABLAS = ['fincas', 'cebaderos', 'animales', 'tratamientos', 'movimientos', 'cebos', 'pesajes', 'economia'];
  const ORDEN_BORRADO = ['economia', 'pesajes', 'cebos', 'movimientos', 'tratamientos', 'animales', 'cebaderos', 'fincas'];
  const LOTE_SUBIDA = 500;
  const LOTE_BORRADO = 100;
  const PAGINA = 1000;

  let sb = null;
  let ownerId = null;        // explotación que se está viendo (ganadero dueño)
  let miId = null;           // usuario con sesión
  let soloTratamientos = false; // modo veterinario
  let snapshot = vacio();    // tabla -> Map(id -> JSON de la fila tal como está en la nube)
  let creadores = new Map(); // id de tratamiento -> creado_por
  let obtenerEstado = null;  // () => { fincas, vacas, bajas, cebaderos, cebos }
  let alCambiarEstadoSync = () => {};
  let temporizador = null;
  let reintento = null;
  let enCurso = false;
  let otraVez = false;
  let estadoSync = { estado: 'inactivo', mensaje: '' };
  // Tablas de migraciones posteriores: si en Supabase faltan, esos datos se quedan solo en este navegador
  const OPCIONALES = ['economia', 'pesajes'];
  const ausentes = new Set();
  const faltaTabla = (err, tabla) => new RegExp(tabla, 'i').test(String((err && (err.message || err.details)) || '')) &&
    /PGRST205|schema cache|does not exist/i.test(String((err && (err.code || '')) + ' ' + ((err && err.message) || '')));

  function vacio() { return Object.fromEntries(TABLAS.map((t) => [t, new Map()])); }
  const nul = (v) => (v === '' || v === undefined ? null : v);
  const txt = (v) => (v === null || v === undefined ? '' : v);
  const esUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const numONull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

  /* ---------- Cliente ---------- */
  function disponible() {
    return !!(window.supabase && window.supabase.createClient && window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL);
  }
  function cliente() {
    if (!sb) {
      if (!disponible()) throw new Error('No se pudo cargar la conexión con la nube. Comprueba tu conexión a internet y recarga.');
      sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return sb;
  }

  // Mensajes de error comprensibles
  function traducirError(err) {
    const m = String((err && (err.message || err.error_description)) || err || '');
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'Todavía no has confirmado tu correo. Revisa tu bandeja de entrada (y la de spam).';
    if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese correo.';
    if (/Password should be at least/i.test(m)) return 'La contraseña es demasiado corta (mínimo 6 caracteres).';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera un poco y vuelve a probar.';
    if (/Failed to fetch|NetworkError|network|fetch failed|Load failed/i.test(m)) return 'Sin conexión con la nube. Comprueba tu internet.';
    if (/economia/i.test(m) && /schema cache|does not exist|PGRST205/i.test(m)) {
      return 'Falta crear la tabla de economía en Supabase: ejecuta migracion_04_economia.sql en el SQL Editor.';
    }
    if (/duplicate key value.*crotal/i.test(m)) return 'Ya hay otro animal activo con ese crotal.';
    if (/cebos_sin_solape/i.test(m)) return 'Ese animal ya estaba en un cebadero en esas fechas.';
    if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer ese cambio.';
    return m || 'Error desconocido.';
  }
  const esErrorDeRed = (err) => /Failed to fetch|NetworkError|network|fetch failed|Load failed|timeout/i.test(String((err && err.message) || err || ''));

  /* ---------- Cuentas ---------- */
  async function sesion() {
    const { data, error } = await cliente().auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function perfilDe(id) {
    const { data, error } = await cliente().from('perfiles').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  // Perfil en el formato que usa la app ({ id, usuario, email, perfil, tipoExplotacion, especies })
  const perfilApp = (p) => (p ? { id: p.id, usuario: p.usuario, email: p.email, perfil: p.perfil, tipoExplotacion: p.tipo_explotacion, especies: p.especies } : null);

  async function miPerfil() {
    const s = await sesion();
    if (!s) return null;
    miId = s.user.id;
    let p = await perfilDe(miId);
    if (!p) {
      // Por si el perfil no se creó al registrarse: se crea ahora con los datos de la cuenta
      const meta = s.user.user_metadata || {};
      const { data, error } = await cliente().from('perfiles').insert({
        id: miId, usuario: meta.usuario || String(s.user.email || 'usuario').split('@')[0], email: s.user.email,
        perfil: meta.perfil === 'veterinario' ? 'veterinario' : 'ganadero',
        tipo_explotacion: meta.tipoExplotacion || 'bovino', especies: meta.especies && meta.especies.length ? meta.especies : ['bovino']
      }).select().single();
      if (error) throw error;
      p = data;
    }
    return perfilApp(p);
  }

  async function entrar(email, password) {
    const { error } = await cliente().auth.signInWithPassword({ email, password });
    if (error) throw new Error(traducirError(error));
    return miPerfil();
  }

  // Devuelve { perfil } si entra directamente o { confirmar: true } si hay que confirmar el correo
  async function registrar({ email, password, usuario, perfil, tipoExplotacion, especies }) {
    const redireccion = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
    const { data, error } = await cliente().auth.signUp({
      email, password,
      options: { data: { usuario, perfil, tipoExplotacion, especies }, emailRedirectTo: redireccion }
    });
    if (error) throw new Error(traducirError(error));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Ya existe una cuenta con ese correo.');
    }
    if (!data.session) return { confirmar: true };
    return { perfil: await miPerfil() };
  }

  async function salir() {
    detenerSync();
    try { await cliente().auth.signOut(); } catch { /* sin conexión: la sesión local se borra igualmente */ }
    ownerId = null; miId = null; snapshot = vacio(); creadores = new Map();
  }

  async function actualizarPerfil(cambios) {
    const fila = {};
    if (cambios.usuario !== undefined) fila.usuario = cambios.usuario;
    if (cambios.tipoExplotacion !== undefined) fila.tipo_explotacion = cambios.tipoExplotacion;
    if (cambios.especies !== undefined) fila.especies = cambios.especies;
    const { data, error } = await cliente().from('perfiles').update(fila).eq('id', miId).select().single();
    if (error) throw new Error(traducirError(error));
    return perfilApp(data);
  }

  async function cambiarEmail(email) {
    const { error } = await cliente().auth.updateUser({ email });
    if (error) throw new Error(traducirError(error));
  }

  // Comprueba la contraseña actual entrando de nuevo y después la cambia
  async function cambiarPassword(email, actual, nueva) {
    const { error: e1 } = await cliente().auth.signInWithPassword({ email, password: actual });
    if (e1) throw new Error(/Invalid login/i.test(e1.message) ? 'La contraseña actual no es correcta.' : traducirError(e1));
    const { error } = await cliente().auth.updateUser({ password: nueva });
    if (error) throw new Error(traducirError(error));
  }

  // Tras abrir el enlace de «¿Olvidaste tu contraseña?» ya hay sesión: se fija la nueva directamente
  async function fijarPassword(nueva) {
    const { error } = await cliente().auth.updateUser({ password: nueva });
    if (error) throw new Error(traducirError(error));
  }

  async function recuperarPassword(email) {
    const redireccion = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
    const { error } = await cliente().auth.resetPasswordForEmail(email, { redirectTo: redireccion });
    if (error) throw new Error(traducirError(error));
  }

  function alCambiarAuth(fn) {
    if (!disponible()) return;
    cliente().auth.onAuthStateChange((evento, s) => fn(evento, s));
  }

  /* ---------- Veterinario ↔ ganadero ---------- */
  async function crearInvitacion() {
    const { data, error } = await cliente().rpc('crear_invitacion');
    if (error) throw new Error(traducirError(error));
    return data;
  }

  async function canjearInvitacion(codigo) {
    const { data, error } = await cliente().rpc('canjear_invitacion', { codigo_in: codigo });
    if (error) throw new Error(traducirError(error));
    return data;
  }

  // Lista de las personas vinculadas: para el ganadero, sus veterinarios; para el veterinario, sus ganaderos
  async function vinculos() {
    const { data, error } = await cliente().from('vinculos').select('*');
    if (error) throw new Error(traducirError(error));
    const otros = data.map((v) => (v.ganadero_id === miId ? v.veterinario_id : v.ganadero_id));
    if (!otros.length) return [];
    const { data: perfiles, error: e2 } = await cliente().from('perfiles').select('*').in('id', otros);
    if (e2) throw new Error(traducirError(e2));
    const porId = new Map(perfiles.map((p) => [p.id, perfilApp(p)]));
    return data.map((v) => {
      const otro = v.ganadero_id === miId ? v.veterinario_id : v.ganadero_id;
      return { ...(porId.get(otro) || { id: otro, usuario: 'Cuenta', especies: ['bovino'], tipoExplotacion: 'bovino' }),
        rol: v.ganadero_id === miId ? 'veterinario' : 'ganadero', desde: v.created_at };
    }).sort((a, b) => String(a.usuario).localeCompare(String(b.usuario), 'es'));
  }

  async function desvincular(otroId) {
    const { error } = await cliente().from('vinculos').delete()
      .or(`and(ganadero_id.eq.${miId},veterinario_id.eq.${otroId}),and(veterinario_id.eq.${miId},ganadero_id.eq.${otroId})`);
    if (error) throw new Error(traducirError(error));
  }

  async function invitacionesPendientes() {
    const { data, error } = await cliente().from('invitaciones').select('*').is('usada_en', null).gt('caduca', new Date().toISOString());
    if (error) throw new Error(traducirError(error));
    return data;
  }

  /* ---------- Fotos (directas a la nube; no se guardan en el navegador) ---------- */
  async function fotosDe(animalId) {
    const { data, error } = await cliente().from('fotos').select('id, imagen, created_at').eq('animal_id', animalId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(traducirError(error));
    return data;
  }
  async function subirFoto(animalId, imagen) {
    const { data, error } = await cliente().from('fotos').insert({ user_id: ownerId, animal_id: animalId, imagen })
      .select('id, imagen, created_at').single();
    if (error) throw new Error(traducirError(error));
    return data;
  }
  async function borrarFoto(id) {
    const { error } = await cliente().from('fotos').delete().eq('id', id);
    if (error) throw new Error(traducirError(error));
  }

  /* ---------- Conversión app ↔ base de datos ---------- */
  function aFilas(estado, owner) {
    const filas = Object.fromEntries(TABLAS.map((t) => [t, []]));
    (estado.fincas || []).forEach((x) => filas.fincas.push({
      id: x.id, user_id: owner, nombre: x.nombre, ubicacion: nul(x.ubicacion), lote: nul(x.lote),
      hectareas: numONull(x.hectareas), poligono: x.poligono || null, punto: x.punto || null
    }));
    (estado.cebaderos || []).forEach((x) => filas.cebaderos.push({
      id: x.id, user_id: owner, nombre: x.nombre, ubicacion: nul(x.ubicacion), capacidad: numONull(x.capacidad)
    }));
    const animal = (a) => {
      const b = a.baja || null;
      filas.animales.push({
        id: a.id, user_id: owner, especie: a.especie || 'bovino', sexo: a.sexo === 'M' ? 'M' : 'H', crotal: a.crotal,
        nombre: nul(a.nombre), raza: nul(a.raza), nacimiento: nul(a.nacimiento), estado: a.estado, lote: nul(a.lote),
        finca_id: nul(a.fincaId), madre_id: nul(a.madreId), padre_id: nul(a.padreId), padre_externo: nul(a.padreExterno),
        fecha_cubricion: nul(a.fechaCubricion), fecha_parto: nul(a.fechaParto),
        baja_fecha: b ? nul(b.fecha) : null, baja_motivo: b ? nul(b.motivo) : null, baja_detalle: b ? nul(b.detalle) : null,
        baja_documento: b ? nul(b.documento) : null, baja_finca: b ? nul(b.finca) : null, baja_lote: b ? nul(b.lote) : null
      });
      (a.tratamientos || []).forEach((t) => filas.tratamientos.push({
        id: t.id, user_id: owner, animal_id: a.id, fecha: t.fecha, tipo: t.tipo,
        veterinario: nul(t.veterinario), observaciones: nul(t.observaciones), creado: numONull(t.creado),
        retirada_carne: numONull(t.retiradaCarne), retirada_leche: numONull(t.retiradaLeche)
      }));
      (a.movimientos || []).forEach((m) => filas.movimientos.push({
        id: m.id, user_id: owner, animal_id: a.id, fecha: m.fecha, campo: m.campo,
        desde: nul(m.desde), hasta: nul(m.hasta), creado: numONull(m.creado)
      }));
    };
    (estado.vacas || []).forEach(animal);
    (estado.bajas || []).forEach(animal);
    (estado.cebos || []).forEach((r) => filas.cebos.push({
      id: r.id, user_id: owner, cebadero_id: r.cebaderoId, animal_id: r.animalId, entrada: r.entrada,
      peso_entrada: numONull(r.pesoEntrada), salida: nul(r.salida), peso_salida: numONull(r.pesoSalida), observaciones: nul(r.observaciones)
    }));
    (estado.economia || []).forEach((m) => filas.economia.push({
      id: m.id, user_id: owner, fecha: m.fecha, tipo: m.tipo, categoria: m.categoria, concepto: nul(m.concepto),
      importe: numONull(m.importe), animal_id: nul(m.animalId), origen: nul(m.origen), cebadero_id: nul(m.cebaderoId)
    }));
    (estado.pesajes || []).forEach((x) => filas.pesajes.push({
      id: x.id, user_id: owner, animal_id: x.animalId, fecha: x.fecha, peso: numONull(x.peso), observaciones: nul(x.observaciones)
    }));
    return filas;
  }

  function aEstado(filas) {
    const porAnimal = (lista) => {
      const m = new Map();
      lista.forEach((x) => { if (!m.has(x.animal_id)) m.set(x.animal_id, []); m.get(x.animal_id).push(x); });
      return m;
    };
    const trats = porAnimal(filas.tratamientos || []);
    const movs = porAnimal(filas.movimientos || []);
    const ms = (iso) => (iso ? Date.parse(iso) || null : null);
    const fincas = (filas.fincas || []).map((x) => ({
      id: x.id, nombre: x.nombre, ubicacion: txt(x.ubicacion), lote: txt(x.lote),
      hectareas: x.hectareas === null || x.hectareas === undefined ? '' : Number(x.hectareas), poligono: x.poligono || null, punto: x.punto || null
    }));
    const vacas = [];
    const bajas = [];
    (filas.animales || []).forEach((x) => {
      const a = {
        id: x.id, especie: x.especie, sexo: x.sexo, crotal: x.crotal, nombre: txt(x.nombre), raza: txt(x.raza),
        nacimiento: txt(x.nacimiento), estado: x.estado, lote: txt(x.lote), fincaId: txt(x.finca_id),
        madreId: txt(x.madre_id), padreId: txt(x.padre_id), padreExterno: txt(x.padre_externo),
        fechaCubricion: txt(x.fecha_cubricion), fechaParto: txt(x.fecha_parto),
        tratamientos: (trats.get(x.id) || []).map((t) => ({
          id: t.id, fecha: t.fecha, tipo: t.tipo, veterinario: txt(t.veterinario), observaciones: txt(t.observaciones),
          creado: t.creado === null || t.creado === undefined ? ms(t.created_at) : Number(t.creado),
          creadoPor: t.creado_por || null,
          retiradaCarne: t.retirada_carne === null || t.retirada_carne === undefined ? null : Number(t.retirada_carne),
          retiradaLeche: t.retirada_leche === null || t.retirada_leche === undefined ? null : Number(t.retirada_leche)
        })),
        movimientos: (movs.get(x.id) || []).map((m) => ({
          id: m.id, fecha: m.fecha, campo: m.campo, desde: txt(m.desde), hasta: txt(m.hasta),
          creado: m.creado === null || m.creado === undefined ? ms(m.created_at) : Number(m.creado)
        }))
      };
      if (x.baja_fecha) {
        a.baja = { fecha: x.baja_fecha, motivo: x.baja_motivo, detalle: txt(x.baja_detalle), documento: txt(x.baja_documento),
          finca: txt(x.baja_finca), lote: txt(x.baja_lote), registrado: ms(x.baja_fecha) };
        bajas.push(a);
      } else {
        vacas.push(a);
      }
    });
    const cebaderos = (filas.cebaderos || []).map((x) => ({ id: x.id, nombre: x.nombre, ubicacion: txt(x.ubicacion), capacidad: x.capacidad === null || x.capacidad === undefined ? null : Number(x.capacidad) }));
    const cebos = (filas.cebos || []).map((x) => ({
      id: x.id, cebaderoId: x.cebadero_id, animalId: x.animal_id, entrada: x.entrada,
      pesoEntrada: x.peso_entrada === null || x.peso_entrada === undefined ? null : Number(x.peso_entrada),
      salida: txt(x.salida), pesoSalida: x.peso_salida === null || x.peso_salida === undefined ? null : Number(x.peso_salida),
      observaciones: txt(x.observaciones)
    }));
    const economia = (filas.economia || []).map((x) => ({
      id: x.id, fecha: x.fecha, tipo: x.tipo, categoria: x.categoria, concepto: txt(x.concepto),
      importe: x.importe === null || x.importe === undefined ? 0 : Number(x.importe), animalId: txt(x.animal_id), origen: txt(x.origen),
      cebaderoId: txt(x.cebadero_id)
    }));
    const pesajes = (filas.pesajes || []).map((x) => ({
      id: x.id, animalId: x.animal_id, fecha: x.fecha, peso: Number(x.peso), observaciones: txt(x.observaciones)
    }));
    return { fincas, vacas, bajas, cebaderos, cebos, economia, pesajes };
  }

  // Ids que no son UUID (datos antiguos del navegador) se cambian por UUID nuevos, con todas sus referencias
  function normalizarIds(datos) {
    const mapa = new Map();
    const nuevo = (id) => {
      if (!id) return id;
      if (esUuid(id)) return id;
      if (!mapa.has(id)) mapa.set(id, (crypto.randomUUID ? crypto.randomUUID() : uuidAleatorio()));
      return mapa.get(id);
    };
    const r = (id) => (id ? (mapa.get(id) || (esUuid(id) ? id : nuevo(id))) : id);
    const fincas = (datos.fincas || []).map((f) => ({ ...f, id: nuevo(f.id) }));
    const cebaderos = (datos.cebaderos || []).map((c) => ({ ...c, id: nuevo(c.id) }));
    const animales = [...(datos.vacas || []), ...(datos.bajas || [])];
    animales.forEach((a) => nuevo(a.id));
    const conv = (a) => ({
      ...a, id: r(a.id), fincaId: r(a.fincaId), madreId: r(a.madreId), padreId: r(a.padreId),
      tratamientos: (a.tratamientos || []).map((t) => ({ ...t, id: nuevo(t.id) })),
      movimientos: (a.movimientos || []).map((m) => ({ ...m, id: nuevo(m.id) }))
    });
    return {
      fincas, cebaderos,
      vacas: (datos.vacas || []).map(conv),
      bajas: (datos.bajas || []).map(conv),
      cebos: (datos.cebos || []).map((c) => ({ ...c, id: nuevo(c.id), animalId: r(c.animalId), cebaderoId: r(c.cebaderoId) })),
      economia: (datos.economia || []).map((m) => ({ ...m, id: nuevo(m.id), animalId: r(m.animalId), cebaderoId: r(m.cebaderoId) })),
      pesajes: (datos.pesajes || []).map((x) => ({ ...x, id: nuevo(x.id), animalId: r(x.animalId) }))
    };
  }
  function uuidAleatorio() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // Animales con su madre / padre antes que ellos (para no romper las claves foráneas al subir por partes)
  function ordenarPadresPrimero(filas) {
    const ids = new Set(filas.map((f) => f.id));
    const hechos = new Set();
    const out = [];
    let pendientes = filas;
    while (pendientes.length) {
      const siguiente = [];
      pendientes.forEach((f) => {
        const ok = [f.madre_id, f.padre_id].every((p) => !p || !ids.has(p) || hechos.has(p));
        if (ok) { out.push(f); hechos.add(f.id); } else siguiente.push(f);
      });
      if (siguiente.length === pendientes.length) { out.push(...siguiente); break; } // ciclo: se sube tal cual
      pendientes = siguiente;
    }
    return out;
  }

  /* ---------- Descarga ---------- */
  async function leerTabla(tabla, owner) {
    const out = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await cliente().from(tabla).select('*').eq('user_id', owner)
        .order('created_at', { ascending: true }).order('id', { ascending: true }).range(desde, desde + PAGINA - 1);
      if (error) {
        // Base de datos sin la migración de economía: la app funciona igual, sin esa parte en la nube
        if (OPCIONALES.includes(tabla) && /PGRST205|schema cache|does not exist/i.test(String(error.message || error.code || ''))) {
          ausentes.add(tabla);
          return [];
        }
        throw error;
      }
      out.push(...data);
      if (data.length < PAGINA) break;
    }
    return out;
  }

  async function leerAnimalesVeterinario(owner) {
    const out = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await cliente().rpc('animales_para_veterinario', { ganadero: owner }).range(desde, desde + PAGINA - 1);
      if (error) {
        // Base de datos sin la migración 02: se leen de la tabla y se quita la localización aquí
        if (/animales_para_veterinario|PGRST202/i.test(String(error.message || error.code || ''))) {
          return (await leerTabla('animales', owner)).map((a) => ({ ...a, finca_id: null, lote: null, baja_finca: null, baja_lote: null }));
        }
        throw error;
      }
      out.push(...data);
      if (data.length < PAGINA) break;
    }
    return out;
  }

  const claveSync = (owner) => `gg_sync_${owner}`;
  function leerMarcaSync(owner) {
    try { return JSON.parse(localStorage.getItem(claveSync(owner)) || 'null'); } catch { return null; }
  }
  function guardarMarcaSync(owner, pendiente) {
    try {
      const conocidos = Object.fromEntries(TABLAS.map((t) => [t, [...snapshot[t].keys()]]));
      localStorage.setItem(claveSync(owner), JSON.stringify({ pendiente, conocidos }));
    } catch { /* almacenamiento lleno: no es grave */ }
  }

  /**
   * Descarga la explotación de `owner`. Si en este navegador quedaron cambios sin subir (estadoLocal + marca pendiente),
   * los combina: se conserva lo local, se añade lo nuevo de la nube y se programa la subida.
   * Devuelve { estado, combinado }.
   */
  async function descargar(owner, estadoLocal) {
    const filasNube = {};
    ausentes.clear();
    for (const t of TABLAS) {
      // El veterinario solo recibe animales (sin finca ni lote) y tratamientos: nada de localización
      if (soloTratamientos && t !== 'animales' && t !== 'tratamientos') { filasNube[t] = []; continue; }
      filasNube[t] = soloTratamientos && t === 'animales' ? await leerAnimalesVeterinario(owner) : await leerTabla(t, owner);
    }
    ownerId = owner;
    // La foto de la nube se normaliza pasando por la app (así no hay falsas diferencias de formato)
    const estadoNube = aEstado(filasNube);
    const normal = aFilas(estadoNube, owner);
    snapshot = vacio();
    creadores = new Map();
    TABLAS.forEach((t) => normal[t].forEach((fila) => snapshot[t].set(fila.id, JSON.stringify(fila))));
    filasNube.tratamientos.forEach((tr) => creadores.set(tr.id, tr.creado_por));

    const marca = leerMarcaSync(owner);
    if (marca && marca.pendiente && estadoLocal && !soloTratamientos) {
      const locales = aFilas(estadoLocal, owner);
      const conocidos = Object.fromEntries(TABLAS.map((t) => [t, new Set((marca.conocidos || {})[t] || [])]));
      // Lo que está en la nube, no en local y no se conocía en la última subida, es nuevo de otra persona: se añade
      const mezcla = {};
      TABLAS.forEach((t) => {
        const ids = new Set(locales[t].map((f) => f.id));
        const nuevasNube = filasNube[t].filter((f) => !ids.has(f.id) && !conocidos[t].has(f.id));
        mezcla[t] = [...locales[t], ...nuevasNube];
      });
      const estado = aEstado(mezcla);
      return { estado, combinado: true };
    }
    guardarMarcaSync(owner, false);
    return { estado: estadoNube, combinado: false };
  }

  /* ---------- Subida de cambios ---------- */
  function diferencias(estado) {
    const filas = aFilas(estado, ownerId);
    const out = {};
    TABLAS.forEach((t) => {
      const actuales = new Map(filas[t].map((f) => [f.id, f]));
      let subir = filas[t].filter((f) => snapshot[t].get(f.id) !== JSON.stringify(f));
      let borrar = [...snapshot[t].keys()].filter((id) => !actuales.has(id));
      // Sin la tabla de economía en Supabase, la economía se queda solo en este navegador
      if (ausentes.has(t)) { subir = []; borrar = []; }
      // El ganadero no sube tratamientos: la sanidad la registra solo el veterinario
      if (!soloTratamientos && t === 'tratamientos') { subir = []; borrar = []; }
      if (soloTratamientos) {
        if (t !== 'tratamientos') { subir = []; borrar = []; } else {
          // El veterinario solo crea los suyos y solo cambia o borra los que registró él
          subir = subir.filter((f) => !snapshot[t].has(f.id) || creadores.get(f.id) === miId);
          borrar = borrar.filter((id) => creadores.get(id) === miId);
        }
      }
      if (t === 'animales') subir = ordenarPadresPrimero(subir);
      out[t] = { subir, borrar };
    });
    return out;
  }

  function hayCambios(dif) { return TABLAS.some((t) => dif[t].subir.length || dif[t].borrar.length); }

  function ponerEstado(estado, mensaje = '') {
    estadoSync = { estado, mensaje };
    try { alCambiarEstadoSync(estadoSync); } catch { /* interfaz */ }
  }

  async function sincronizar() {
    if (!ownerId || !obtenerEstado) return;
    if (enCurso) { otraVez = true; return; }
    enCurso = true;
    clearTimeout(reintento);
    try {
      const dif = diferencias(obtenerEstado());
      if (!hayCambios(dif)) { guardarMarcaSync(ownerId, false); ponerEstado('guardado'); return; }
      guardarMarcaSync(ownerId, true);
      ponerEstado('guardando');
      for (const t of TABLAS) {
        const lista = dif[t].subir;
        for (let i = 0; i < lista.length; i += LOTE_SUBIDA) {
          const trozo = lista.slice(i, i + LOTE_SUBIDA);
          const { error } = await cliente().from(t).upsert(trozo, { onConflict: 'id' });
          if (error && OPCIONALES.includes(t) && faltaTabla(error, t)) { ausentes.add(t); break; }
          if (error) throw error;
          trozo.forEach((f) => {
            snapshot[t].set(f.id, JSON.stringify(f));
            if (t === 'tratamientos' && !creadores.has(f.id)) creadores.set(f.id, miId);
          });
        }
      }
      for (const t of ORDEN_BORRADO) {
        const ids = dif[t].borrar;
        for (let i = 0; i < ids.length; i += LOTE_BORRADO) {
          const trozo = ids.slice(i, i + LOTE_BORRADO);
          const { error } = await cliente().from(t).delete().in('id', trozo);
          if (error && OPCIONALES.includes(t) && faltaTabla(error, t)) { ausentes.add(t); break; }
          if (error) throw error;
          trozo.forEach((id) => { snapshot[t].delete(id); creadores.delete(id); });
        }
      }
      guardarMarcaSync(ownerId, false);
      ponerEstado('guardado');
    } catch (err) {
      guardarMarcaSync(ownerId, true);
      if (esErrorDeRed(err)) {
        ponerEstado('sin-conexion', 'Sin conexión: los cambios se subirán cuando vuelva internet.');
        reintento = setTimeout(sincronizar, 30000);
      } else {
        ponerEstado('error', 'No se pudo guardar en la nube: ' + traducirError(err));
        reintento = setTimeout(sincronizar, 120000);
      }
    } finally {
      enCurso = false;
      if (otraVez) { otraVez = false; programar(); }
    }
  }

  function programar(ms = 400) {
    if (!ownerId) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(sincronizar, ms);
  }

  function detenerSync() {
    clearTimeout(temporizador);
    clearTimeout(reintento);
    ownerId = null;
  }

  const hayPendientes = () => {
    if (!ownerId || !obtenerEstado) return false;
    return enCurso || hayCambios(diferencias(obtenerEstado()));
  };

  function configurar(opciones) {
    obtenerEstado = opciones.obtenerEstado;
    alCambiarEstadoSync = opciones.alCambiarEstadoSync || (() => {});
  }

  function ponerModo({ veterinario }) { soloTratamientos = !!veterinario; }

  window.addEventListener('online', () => programar(500));

  window.Nube = {
    disponible, sesion, miPerfil, entrar, registrar, salir, actualizarPerfil, cambiarEmail, cambiarPassword, recuperarPassword, fijarPassword,
    alCambiarAuth, crearInvitacion, canjearInvitacion, vinculos, desvincular, invitacionesPendientes,
    fotosDe, subirFoto, borrarFoto,
    descargar, programar, sincronizar, hayPendientes, configurar, ponerModo, normalizarIds,
    estado: () => estadoSync, miId: () => miId, economiaEnNube: () => !ausentes.has('economia'), tablaEnNube: (t) => !ausentes.has(t), explotacion: () => ownerId, traducirError,
    // Solo para pruebas
    _int: { aFilas, aEstado, diferencias, ordenarPadresPrimero, set snapshotDesde(estado) {
      const n = aFilas(estado, ownerId); snapshot = vacio(); TABLAS.forEach((t) => n[t].forEach((f) => snapshot[t].set(f.id, JSON.stringify(f))));
    }, set ids({ owner, yo }) { ownerId = owner; miId = yo; }, set cliente(c) { sb = c; }, creadores: () => creadores }
  };
})();
