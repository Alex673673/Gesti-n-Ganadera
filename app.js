/* ============================================================
   Gestión Ganadera — lógica de la aplicación
   - Datos en localStorage del navegador.
   - Mapa satélite (Esri World Imagery) con Leaflet + Leaflet.draw.
   ============================================================ */

// Cada cuenta registrada guarda su explotación en claves propias (gg_vacas_<id>, gg_fincas_<id>, gg_bajas_<id>).
// No hay usuarios predeterminados: todas las cuentas se crean desde «Crear cuenta».
let usuarioActual = null; // { id, usuario, perfil, tipoExplotacion, especies }
const KEYS = {
  get vacas() { return claveDatos('vacas'); },
  get fincas() { return claveDatos('fincas'); },
  get bajas() { return claveDatos('bajas'); },
  get cebaderos() { return claveDatos('cebaderos'); },
  get cebos() { return claveDatos('cebos'); },
  get economia() { return claveDatos('economia'); }, // gastos e ingresos (solo ganadero)
  get pesajes() { return claveDatos('pesajes'); },   // pesos de los animales (solo ganadero) // registro de entradas y salidas de animales en cebaderos
  sesion: 'gg_sesion',
  usuarios: 'gg_usuarios'
};

let ganaderoVista = null; // veterinario: ganadero cuya explotación está viendo ({ id, usuario, especies, tipoExplotacion })
let vinculosCuenta = [];  // personas vinculadas: veterinarios del ganadero o ganaderos del veterinario
// Explotación cuyos datos se muestran: la propia o, para un veterinario, la del ganadero elegido
const idExplotacion = () => (ganaderoVista ? ganaderoVista.id : usuarioActual.id);

function claveDatos(tipo) {
  return `gg_${tipo}_${idExplotacion()}`;
}

/* ---------- Perfiles, especies y vocabulario ----------
   La cuenta guarda su perfil (ganadero / veterinario) y las especies de la explotación.
   Los textos de la interfaz salen del vocabulario de la especie activa (o uno genérico si es mixta). */
const PERFILES = { ganadero: 'Ganadero', veterinario: 'Veterinario' };

const TIPOS_EXPLOTACION = {
  bovino: 'Bovino (Vacas)',
  porcino: 'Porcino (Cerdos)',
  ovino: 'Ovino / Caprino (Ovejas / Cabras)',
  avicola: 'Avícola (Pollos / Aves)',
  mixta: 'Mixta'
};

const ESPECIES = {
  bovino: {
    corto: 'Bovino', emoji: '🐄', gestacion: true, diasGestacion: 283, animalGestante: 'una vaca',
    estadosH: ['En lactación', 'Gestante', 'Seca', 'Novilla', 'Ternera', 'En tratamiento'],
    estadosM: ['Ternero', 'Añojo', 'Cebo', 'Semental', 'En tratamiento'],
    noMadre: ['Ternera', 'Novilla'], noPadre: ['Ternero', 'Añojo', 'Cebo'],
    estadoCria: { H: 'Ternera', M: 'Ternero' }, estadoParto: 'En lactación',
    razas: ['Rubia gallega', 'Cachena', 'Limiana', 'Limusina'],
    tratamientos: ['Vacuna Lengua Azul', 'Vacuna IBR', 'Vacuna Carbunco', 'Vacuna Neumoenteritis', 'Desparasitación', 'Antibiótico', 'Antiinflamatorio', 'Vitaminas / minerales', 'Revisión veterinaria'],
    v: { animal: 'vaca', animales: 'vacas', art: 'una', este: 'esta', emoji: '🐄', crotal: 'Crotal / ID',
         crotalPh: 'ES0012345678', nombrePh: 'Pinta', razaPh: 'Rubia gallega' }
  },
  porcino: {
    corto: 'Porcino', emoji: '🐖', gestacion: true, diasGestacion: 114, animalGestante: 'una cerda',
    estadosH: ['Reproductora', 'Gestante', 'Lactante', 'Cebo', 'Lechón', 'En tratamiento'],
    estadosM: ['Verraco', 'Cebo', 'Lechón', 'En tratamiento'],
    noMadre: ['Lechón', 'Cebo'], noPadre: ['Lechón', 'Cebo'],
    estadoCria: { H: 'Lechón', M: 'Lechón' }, estadoParto: 'Lactante',
    razas: ['Large White', 'Landrace', 'Duroc', 'Pietrain', 'Ibérico', 'Celta', 'Cruce industrial'],
    tratamientos: ['Vacuna Parvovirus / Mal rojo', 'Vacuna PRRS', 'Vacuna Circovirus', 'Vacuna Aujeszky', 'Desparasitación', 'Antibiótico', 'Antiinflamatorio', 'Vitaminas / hierro', 'Revisión veterinaria'],
    v: { animal: 'cerdo', animales: 'cerdos', art: 'un', este: 'este', emoji: '🐖', crotal: 'Crotal / Matrícula',
         crotalPh: 'ES370123456789', nombrePh: 'Cerda 12', razaPh: 'Large White' }
  },
  ovino: {
    corto: 'Ovino / Caprino', emoji: '🐑', gestacion: true, diasGestacion: 150, animalGestante: 'una oveja o cabra',
    estadosH: ['En lactación', 'Gestante', 'Seca', 'Recría', 'Cordero / Cabrito', 'En tratamiento'],
    estadosM: ['Macho reproductor', 'Recría', 'Cordero / Cabrito', 'En tratamiento'],
    noMadre: ['Cordero / Cabrito', 'Recría'], noPadre: ['Cordero / Cabrito', 'Recría'],
    estadoCria: { H: 'Cordero / Cabrito', M: 'Cordero / Cabrito' }, estadoParto: 'En lactación',
    razas: ['Churra', 'Lacaune', 'Assaf', 'Merina', 'Latxa', 'Segureña', 'Cabra Murciano-Granadina', 'Cabra Saanen', 'Cabra Payoya'],
    tratamientos: ['Vacuna Lengua Azul', 'Vacuna Enterotoxemia', 'Vacuna Clamidia / Toxoplasma', 'Desparasitación', 'Antibiótico', 'Antiinflamatorio', 'Vitaminas / minerales', 'Revisión veterinaria'],
    v: { animal: 'oveja / cabra', animales: 'ovejas / cabras', art: 'una', este: 'esta', emoji: '🐑', crotal: 'Crotal / Identificador',
         crotalPh: 'ES012345678901', nombrePh: 'Lucera', razaPh: 'Churra' }
  },
  avicola: {
    corto: 'Avícola', emoji: '🐔', gestacion: false, diasGestacion: null, animalGestante: 'un ave',
    estadosH: ['Ponedora', 'Reproductora', 'Pollo de engorde', 'Pollito', 'En tratamiento'],
    estadosM: ['Gallo', 'Pollo de engorde', 'Pollito', 'En tratamiento'],
    noMadre: ['Pollito', 'Pollo de engorde'], noPadre: ['Pollito', 'Pollo de engorde'],
    estadoCria: { H: 'Pollito', M: 'Pollito' }, estadoParto: 'Ponedora',
    razas: ['Castellana negra', 'Pita pinta asturiana', 'Leghorn', 'Rhode Island', 'Sussex', 'Broiler (Ross / Cobb)', 'Codorniz'],
    tratamientos: ['Vacuna Newcastle', 'Vacuna Gumboro', 'Vacuna Bronquitis infecciosa', 'Vacuna Marek', 'Desparasitación', 'Antibiótico', 'Vitaminas / electrolitos', 'Revisión veterinaria'],
    v: { animal: 'ave', animales: 'aves', art: 'un', este: 'esta', emoji: '🐔', crotal: 'Anilla / Identificador',
         crotalPh: 'A-000123', nombrePh: 'Gallina 01', razaPh: 'Castellana negra' }
  }
};

// Lista completa de estados de cada especie (hembras + machos, sin repetir): filtros, resúmenes y schema.sql
Object.values(ESPECIES).forEach((e) => { e.estados = [...new Set([...e.estadosH, ...e.estadosM])]; });

/* ---------- Sexo ----------
   Cada animal guarda sexo 'H' (hembra) o 'M' (macho). Los estados que se ofrecen dependen de especie y sexo.
   Solo las hembras pueden ser madre y solo los machos pueden ser padre. */
const SEXOS = { H: 'Hembra', M: 'Macho' };
const SIMBOLO_SEXO = { H: '♀', M: '♂' };
// Registros anteriores al campo sexo: se deduce del estado que tenían
const ESTADOS_MACHO_ANTIGUOS = ['Toro', 'Verraco', 'Macho reproductor', 'Gallo', 'Ternero', 'Añojo', 'Semental'];
const sexoDe = (a) => (a && (a.sexo === 'H' || a.sexo === 'M') ? a.sexo
  : (a && ESTADOS_MACHO_ANTIGUOS.includes(a.estado) ? 'M' : 'H'));

// Vocabulario neutro para explotaciones mixtas (varias especies)
const VOCAB_GENERICO = {
  animal: 'animal', animales: 'animales', art: 'un', este: 'este', emoji: '', crotal: 'Crotal / Anilla / ID',
  crotalPh: 'ES0012345678', nombrePh: 'Nombre o apodo', razaPh: 'Rubia gallega, Large White, Churra…'
};

const ESTADO_CLASE = {
  'En lactación': 'bg-green-100 text-green-800',
  'Gestante': 'bg-purple-100 text-purple-800',
  'Seca': 'bg-amber-100 text-amber-800',
  'Novilla': 'bg-sky-100 text-sky-800',
  'Ternera': 'bg-pink-100 text-pink-800',
  'Ternero': 'bg-pink-100 text-pink-800',
  'Añojo': 'bg-sky-100 text-sky-800',
  'Semental': 'bg-sky-100 text-sky-800',
  'En tratamiento': 'bg-red-100 text-red-800',
  'Reproductora': 'bg-green-100 text-green-800',
  'Lactante': 'bg-green-100 text-green-800',
  'Cebo': 'bg-amber-100 text-amber-800',
  'Lechón': 'bg-pink-100 text-pink-800',
  'Verraco': 'bg-sky-100 text-sky-800',
  'Recría': 'bg-sky-100 text-sky-800',
  'Cordero / Cabrito': 'bg-pink-100 text-pink-800',
  'Macho reproductor': 'bg-sky-100 text-sky-800',
  'Ponedora': 'bg-green-100 text-green-800',
  'Pollo de engorde': 'bg-amber-100 text-amber-800',
  'Pollito': 'bg-pink-100 text-pink-800',
  'Gallo': 'bg-sky-100 text-sky-800'
};

// Estados que ofrece la cuenta activa (unión de los de sus especies); se recalcula al iniciar sesión
let ESTADOS = ESPECIES.bovino.estados;

function especiesCuenta() {
  const c = ganaderoVista || usuarioActual; // el veterinario usa las especies del ganadero que está viendo
  const lista = c && Array.isArray(c.especies) ? c.especies.filter((e) => ESPECIES[e]) : [];
  return lista.length ? lista : ['bovino'];
}
const esMixta = () => especiesCuenta().length > 1;
// En explotaciones mixtas el «emoji» son los de sus especies juntos (🐄🐖), no un icono genérico
const vocab = () => (esMixta()
  ? { ...VOCAB_GENERICO, emoji: especiesCuenta().map((e) => ESPECIES[e].emoji).join('') }
  : ESPECIES[especiesCuenta()[0]].v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const crotalCorto = () => vocab().crotal.split(' / ')[0];
// Especie de un animal (los registros antiguos sin especie toman la primera de la cuenta)
const especieDe = (a) => (a && ESPECIES[a.especie] ? a.especie : especiesCuenta()[0]);
// Estados de una especie; con sexo, solo los de ese sexo
const estadosDe = (esp, sexo) => (sexo ? ESPECIES[esp]['estados' + sexo] : ESPECIES[esp].estados);
const estadosCuenta = () => [...new Set(especiesCuenta().flatMap((e) => ESPECIES[e].estados))];
const emojiAnimal = (a) => ESPECIES[especieDe(a)].emoji;
const esVeterinario = () => !!usuarioActual && usuarioActual.perfil === 'veterinario';

/* ---------- Imágenes incrustadas (PNG en base64) ----------
   Iconos de cada especie para la cabecera y copia del logotipo que se usa si no se encuentra logo.png.
   Al ir dentro de app.js no dependen de ninguna ruta de archivo. */
const ICONOS_ESPECIE = {
  bovino: 'data:image/png;base64,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',
  porcino: 'data:image/png;base64,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',
  ovino: 'data:image/png;base64,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',
  avicola: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAFxGAABcRgEUlENBAAAQcUlEQVR42u1dC3gU1RUe67OtVqsS7ffZ2lrQTQIE2PiiUpRWS7IbQCBB0I+ACSGbgCAK8lDSImJeO7vxgU2yjyQELCvJLmDx2WJ9VRC1vrEiohJAsApVqQghPWc2wGbmzO7MvjIze8/33Y+QzNyZuee/55x77jnnchwjRowYMWLEiBEjRowYMWLEiBEjRowYMWLEiBEjRowYMVJJ+b78k21rc8fa/NaGMr9lc5nf+m/4+RX42QMtt2Lj8FPYKBmUytbmjbYFrNvKAtYuuQZ/f6t0bd5VbLSMRF3cSTC77TDbj4Zjfkj7HqUEGzijzHy/1amQ8Sckgd962ObPHcpGTwc0o82SBaJ7sS1gaYG2ChhYZWu3Dq+oqPhBWXtegVrmh6iDDwo3Dj+DjbBGafp6S7+ygOUp+VlseQeYuFeGuW/AvZXl/pGzy9pzq5DZdD+WW9lIa5BwhgOD9kczs0sDlr8A0yeGNltbzmRg9vsEiF5lo60xKg2MugxE/dfRiXbLi2LmHweB33KX5HowHG2PW37KRl1LFn3AuiVK5h8Bw26mHACEFrB+Sty7CQD3Z7j/ZmYT9Lboh+WZDIN3AXPd5X7rckqUC6Lfb3kzLPOx+S3PRVgd7C4PWG5inOitJR1l9K21fGpbM7LouChvz70FxPlrUnFuWRERAO2WdQpXCIsYN5LNfF/+mTADv5Mwo926RMLIttzpAIJ9IcbcvuntOdMUSACPInUCtkFpuzWHcSWZxh+4aAkrfZ8cM5Hh5YJayHUrYn73PaHAieQ2Rl8D40yyAOC3TiLE+mYljFXTjgEHZnkz+gjK/ZZqAMXLFAjKAznZjDPJ0//TpLMw99l4A4Bqpf6cSaB+3iUAeIduBjCj0X5uutthS3fxpZfUV56tuxVAwDqV0P8bkwGA4BLRspJQA7W6GDxT84PnZbgdO6B1BRvf0d/FZ+ttO5cQw2/3JgDgdzX6mP0ux5wTzO9uLsfBdDdfoBcATA+MypDOQMtXKJ4phk3wTZk1rHlBc7Z3yQtZnqptAz01uwa6q3fBzx9mN937/LCWhS1jHy2eqxQAoG42ERJgjj4A4OaflgBAAAF/FFTCQj18w8wNI08Hhh+UrgRy5oUyauSq2dWDPPdvJb+XaAPcNXuuaV7QWugbWyTvJgYPImwRS5+tgy3ji3z2H+JsDzcIYBss0qsjCEDhRSblry68bZBn2ZtKGS9u/d21B65tmd8orDZCmA/exUng/XuDWIJ26CKEDJibo2wQ+PnaB4D1dkIML76uZW5Jpqv2QLTMD22DPfe9PsVXUHyM+WD9PyPjB1isE/3POxQPQCNfqOVvKfLdcC4M/I4QJuzI9i4dB+D9Lh7MP64WPDUdt/gmzQvGDZDM/ww9k7oAAEiAFwmR/yptEzgOmjz8EK2DAHz2NmxXt1SMgHf+n6xqczn+hZIt02W/Lt3j7JfVUJlpbl46Ost7/7IB7upNcE2n3L1m79IjJf4x5K5i2drckfpZ/7v4L8Qfd2nDA7+Cfx+m7QH+k0vra8/X+nehLwOYu13GuP040+20Ruojs6nu13BtMxrDVD/DVyzs0rXzp3+j8wKCwd9y6MPu6joJ/t8iA4I1OpBsD8hIsefQ6aWqL489F1ZDX1H9jVtdfHwDCNzCs3XlPUPRRwzQa8f+frG34gz48M0y4nOMZr+r0ZEOs/aI9J35zQNban4clbMMVB/0sV/c5yBvVVeJf9TnuhL7IR9VTOj/1h7od9VcDL/fR0iBzy5zVZ2lUbXmIsT+AfyWiPfmZ5yWVpxdBW1X2rTsDmiV+LvgWDjGUJNhkLtyPqdHAh15OzGzeeK68TLitEpr35TldZxDW/12RboZGQ6tS9QqQ7ymq4kxe1+XAIAXv5v4mCW0TuXXEtd+AyI1TWNu7SkEWPeZ6+t/pAgAwZnfEwDF5t3H7SZvrYlaHWS67Vk6BAC/TKnDJ6Pe+QtkODG4Ndoy/vg2JVItjAToIACwU/SMjcQz2jManTOETTSf72TdOoFMbsfsMCqjmpICWloWAnP2SGZnI/8bFQCQqoDi7PtFE2dWBGfRfrhmPaodTQMCXvJPhBH4R7nrkdEwwF8TtoAmdr1QSlHOqwxfxWmK+0AjMAiCDrERGBI7cYVK76E2AYEii3jZhyPYDbVaNYLoZS3/SiKCZ2J0J2sDELjfTzDzsXD3DHDzl9AuUuc1WjQAYaBXJUh9Honj/oIACFS/ap1UsTpMrg3nCAojBf5GfMQjGlBpswgJ4EgQ2CRb6CaXfQPlLFLZdiQNBLiEIxw830daMsF1Ewng7ET3cS+7fxcRAFga7+fA+JxK2E6Hhe8HcY5iHcV7UMyrBwQAqSyZzqDtasV5xkMPnUntsvV2HCEOXDIGkzI2QSp+Lr4OPaU4WWBSvadZAKCOjCb4AxD/hJoVRLIim3sGtyZGnGZ6HH8gxuxl4R281RfCzyUgeTZEGYewI6l2ADDtNmqfXMF9NmqnTTPh7fh+CRpIcvksbJrxL4eLIQjTOvFeGPe5GKGd1AET9v6J/W6Ty9k//Baps1+sa269AqGb0TFa/iAdglKiBKWG5qKClGz0UF43U6Pz+l73B4CIhtm0OxFi9TKv45dyASIKl3urcPmtqZ1UWpzzByINWgb6v4mP7C0QYBSQEAhCSrTYDavy9jzriNa536ic6R3wPsszXfwNWpGOpItXJnbuvrBWNzouZHQaoNyOASXJeH9clqW7nUWiWR93ABSumbAn08NTIWZfiZbS7wkbbeAy7u2lsRrPVh0xcP8Nt90b1LP8J/JBl/w26PdmLkFp0n1X1P1EWPpBjF/4vAZ4x1hVADByaPM9h0ix/khVv6AU5ctNDbWXcnokUz3/M8q7Fck1nOmp/Tl8+NthGQB7BRh8Eg8Lt29d3enBGD2HR2Z7Wrw0fQJjH7mYA02q5sqA/E7OKIT75nTkjzNfQRTO0wqYcRiu+wd67GBW/l5JMAkCLN3l/J3g5QOrmdyNpGf918LWdowiuAsKT+WsnDUGAj4ka/rB3mVHkqXmkmgL8HsJHbc34uwFMS+EmIWJw5cJ0YaMHX4rzKQX4N5nsAlrahTrEVLW5Pt0rB7QUHdRtIYepnVhK2uzjJ+4cuI4zA8kjLuum3yFXViWjjMS4WyPxYjqjsj9azwzcRQC6SgwPmBqrDNzsdUO3nmiclje/sHeynep512/8s7uIlR5ozmjEclAl+Mudc4S5zXBGR31mllRE+L1BQO2LiMe3w4zf88xAIxonUc+M7tpadd0/+juyqLWcsMBAPSnV6pTnUVReuT6Qn+VYF98FDemux3/wYwdkDZjMbuZi2/18GZkrHXVDPLZA901h6a2F+gzE0iFr3u9ZNA9fMyiTnAfQxQSMLAJ+nwdQHFIofdss5CiBcsssOgHcgmsvoXFJsf7igQdT0jBwwW+KVtENQBmGk8FgKVOAGBYQtby7ro+KL5NLsfVuDLAZmqwX4VgGbB8edLr8Jrrq4ZALQBSbV3bOr8RZvxHolzAXAOqAOneQKanzvAHJKBjSXBeEcwf0TJvK9QCeFCcCVzadmOaESWAZLcLZ6XRAQDf6SSzgFvnY84/VRv4CaMOxD+ly0DH1UZmPmb2BB1VPb/7iqYlXVCAijw7CHwAgw0KAKlXD7dYjQyAdI/jMcLZc3BK24S95MFRActkA4tC3kc4ggxbBr073+8olVBa3j7mPGB4BbSXhLMI/NYmw878kD2Beml9IOcMwwLeZScyfvn9uM3MpSKBBLgnlgRLHa56niLE/9NcqhIV9w+DtM7AgHcbeptXLeGGCjEjthtYArQSm0s3pywAsI4OtSTq9ejVJKoASCnP41KZqFqBuPmitp8LiodYQ1KtRyXr/fFZx56L7xBBBXSoDYs3vh1AxQi6HI2qGQHVNY4VWuhTnP3dBSXm6xL97sDwEfgsuQofnDgIhojZT9kVQMhScAyZ/6Yylz0UAN3VNvanlVyeMK9in2nZQ4VnhCnxwkVI81KSGWV4wgxhKugSd+vU9HN+8eUFwJDOUIbA7Pw2rcQc9zqD2KfQd0/AdeI7hIl9eJBY8TRxjITBWUMAoC0KNTCHKL12FJhTd3Fh7KdtYh/Yl9Cn5Dnm27kwod4A8k+Jbyxg3BcSP+w3kpG9kB6t3igzL6IYBCJ7BwBkIlfBqQ/ygHvwXqEPGmALw/v/+WGU/sdtYcZ9JND3ZNJFFMZg0DgzFwFTvieYBUAwbwdGLrhw+hURY/vwGmRun2Lzx1Rf+Ax8loKVzjpi/b+BMb5HTJ9jASUFMPo3KhCUmK8EBm0jGXei4fLtSbhueXfFrsrun58k6/j1ZP42fAanJHqZSOWGXcEJjOucqOw6UVIeiyVGm3Rx3q1DzwJjrRZm/KEIQFDccNmHfWLf0cY9ordzeEXFKYzrEkeJ/Q6ZzNeYQqLTpmZfAqK/QWK5q2P8t9gH9hXLXkc8vsewFCwbLw3rxrMFYk3EQDq7MOscMOZKgZHrlYChm+nr8R68V51/A6qf09lPHyutJ5ySJBRhJJI8sGw8JpbG7UEVw0+5sGhwep8Scz40Gxh6dwkNf4bf4d/wmqgkGRS3Ch4TQ+YasNO+FXgHH5KJ3X8nHhm4iZZiYVLWHmXc5RSeMejmt8hk474XbUJmognLscAM/7vc+UGYm8C4q5CQyTBwu2TqAOxWU5k7ScWi+mL1U7kUciHTiJE6woKQcocoYboXHjerhd00yGe8BaucyMz8I1o+90gfIHDzX4bJ2n2jt6QBxviDqno2TMWSQ3gMDuNizEZh7WBcBURI7nw8WSVkhRq9Ln5FuGKNuMNp9ByHpJ89KFT3iJzS/SqeUhbvhM9M9wOTsUoXvIOSTOMPELSMa/E2tKD+HZZFI+MIqd1E4fBGxwKTi7fg6Zxqgkzw+uA5B3w19LVJRU2BJvQDMG4lWCVg3n80ZVOBQR8iQ4NFqDEzqbtBMUoA10tY6k1hPQFx31uVHBPLKF4ExRvQ+pZLs05Ww/A1UA0zUz62j+u9kLJT8bh5KtM4sY3fAuXhJmM9QcYFTkOp15BahmI+0QBgo62DTFyhxjBEFQVrA0pjDSIUgPwS7n1eKGrZaJ/EAGCMncZxopCzd4R6hdCwOBUw+7dYg5farmUAMMYu460iN+0KFcEdDAAGAMDdIjFfyQCQWunoj4gkwEwGgNRKRF0XbRIqA4AhElF77tcDIK5kAEitFLQe5djVRBYxAHAG8Bj23L7tVBObzwCgd/EvPYZ1l0oDkgFAz4QVSMVxAwwAqVWSbrzICxhgAEgpJxA/S8TEhxkAUksCVIuCSRcyAKSWE2ilSAVMYQBILSfQc7EcPs0AwOnzZA7hMGW3Y7FwAJTocCqlfgCIMh4iqWUI/bIcfy0RFJEIVuOwT8UgkO5jZjsjnAH4BV5LMRPD0OFvc6C9Fc39jLhkhoI5rWI3bxQHQgrMxJwC3DRSEnrOwKAd/b6zNyODqUhhFiKuDQB0CqpAUAmgGuDYOMEmwP+riBFEaYBSAbePFd8P78Q4k0QVIBRiFsQwvwGNPmRUuDp8KKYjMhP1P9gBVFGKiPczAOiHkJnBFG++A+sR4b9qgkVCwRC0ReB+pgIYMWLEiBEjRowY6Y3+D8U6gSMhPs3TAAAAAElFTkSuQmCC',
};
const LOGO_RESPALDO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAFACAMAAAD6TlWYAAAC0FBMVEVMaXH9/f39/f34+Pj////+/v7+//7+/v7////////a4uH///+Fppjn7uz+/v7///////////7+/f7+/v3//v////39//7+//7+/v/7/Pv9/fz8/f4TWDwSVjqDtFT9/fyBs1X6/f0VX0L9//8UXEASUzmEtVYPUTcXWT8SXkCAs1L7//8NVjgQWz0TWj0DRCiTmJoOWDwzm5g1n52QlZgvmZYYXUEWYUQ0oaA5oZ8CSSwFSy8xnZw3nZsulZMMTjQJUzYCQCV+sFT8//0ifoB+sVD///sGTzP5+/r3//8skI4lg4UHRy2OkpQXVTwZY0YLSjA6pKKFt1v2/PsfeXvk7Oru9PMCPB83lpUoiopSlZF8rU6KjpGAsVUacG+Xm501kI7d6eZWnJf0+PeBsFPn8u/8/vi3y8O80Mnu/PsVa2mwxr55mZcRYEZWoqDu+PdqkIDg9PTS4dwbdHZ5p081pKTX5eJbhXXx/v7Y7+9El5V/oJLC1M5hmJNfp6ZwlIiIvGPm+Pi94OBprKt9qVaov7ZjinkUTTRonJq02dgQXEPN3dcSZUyRrqOJrmUnX0mFi4zQ6+tCdGCXyMikzc12l4tzsrFXgG1MnZwkVj9+tWRPfGpLdmOYsqdKjIkzaVRDm5qMqZ4/kY+GpZktY04gXESiu7F2pUqJv748hIKbt64vhISr1NMWaVV4sGt+urr5/fEeTzXI2NM7blmgo6UCNRjj7tXy+OiRwcGCrFwuenl4nJCrra9vqHAOQyeiwIXM4+PF5uYwXkbDxcaQs2+1zp23uLnF2LDY5sgZclusx5FekYuauXvX2Nnr8986Zk7g4eHO0NHt7u7N37txp2M1ekeAnpwpb0BallZEbVlDg0t8qqlNjFIZaUyjwsBvoqIWRyvC29kcYze906iBs7NmoFsKX12Ns7GHk5Nkmmg9moQwd1tZpnmMs42guaRJl3ZzESNSAAAADnRSTlMA6fwmJun8AgNdXV7p+oxB10oAAAAJcEhZcwAACxIAAAsSAdLdfvwAACAASURBVHja7L35c1Nnlj4+6Znumfl8vnVvXV/JV7qSKEtXsmRrK0EhgQRIssGyQSUrNrbDUFB4jBdwOXaAwSTQMUmw3Zit4oQ4xiZuwpaQQLMUWaBCOlRSoZl8w1RDPgnp0J2lk/5Op5d/4fuc92q58kJip+fzU98QwFjWcu553/ec5zznOf/wD3+//n79/fr79ffr79ffr79ff7/+fv39+ttc//wv/6PXP/8PP//UF/wbPc3fPeP/kv/9w7/86//+1//B63/9r3/9v3v9TV7vf//rv/zDP39PA/7Tj/n/uct49O6tY/W8xP/fuTh+38CtgWb8+UOvH//T9zfgA9xPCq4f/Yh+wx8/Un9T/yh8CPtP+0X2yvy4+jzVPzlzOZ1uOv6T6vw3s0/6k2ku9YV+lPnpH2medPLjNC/zk/wz/+gnzaNNzqZbjT+Z5ucKX/5Hhf+efTr15X/0E+6Bf/rBHshx7EZOezMV7UNmut2SxLdcSoR8zhOtxaIkKcr3dySOfs18KdP8APN3/vjlWrvr8ineKHLTvS9u2n8VJnkxPWROBuSm/yzq2+Puu3Km+XFONvIdDo/D6Yx28G2SQX0Ex9//uaaajuPvb86sTRRelA3jfrvZEu/l693i1OfJGXrSdwRh6ueZqwHVd8tx2Q87/S3L33X1oTkrF/qJlT8aNzudZv9h8ojs4+9rEPXVc+9iWlfM/kvmsZl3KBkMHN8wmvD5zNGJVrdpihOw58o/74yfSv34D/zj7AzI5W5+7m1lby031T257Dc0HzZrmPzjJFPNADNgdLSVZwY0GLLrc7r7wuX9JPOY6e9f9nZlX1nO3BqDke9Merw+i+vzDt4oaDw6+w7lnAm5+90+bq4emNt9Cl6Bm/ajclzBsuCm2QtF5YnrSbPHE7DHj+IDiZzC3WevyC2AKfacfsPg+Zwrqe9FUUSlN2wO2M0hP16v8EmyuxD33ee4+pDZeqB2685br8COM7xSbgPkJhub47dcSFosgUCtf5yXRYWfcROa1mhaf+am2ykzt5nMotfTDeP3nfR6A96yUKyPl7U7n9boM9wYzQbDzWUP5LRPnlvDkxZQ9tNPXbjTrgoT3xlxkgHtntQ+3pjZiSTNtjl19+E1v2k2zOzTcwWrMrvesTMIvAE2uxqxBQJee8gzVs/Lmo2Gzy3bjMm5qceL+lRydlOdiwdqzkBumhUzJWrhZlhaWcc18kf9ZngEvCICl1AkzpQ/nWZYO/LMLl+4gXC5P+gycAYJDngh4DWbfXabd6JBs7vkTf4d53/243NzWcKT7092Q+KmjaJyDq/Z7QsiGGYMfqffywzoLXNd5E2KKEozBmccX2CR6UPQ7N3NnXUwOCcKBvprZTU/Eg8GzGYzDFi7nd0KjtccvTOf6tkbolnBcz1EuBk31WnCiO/8N74nzKxXZg8lxmpMJk4vCILC3S+W/D6hJjclDFZgxmp+17Wow2J2ectsZcGLuU3weyeBc0/lfsxPvVHfFSjlbieXXbCIRpVJcZfSG/EODXkDZXafq+kYX20ScSkz+iCXj6CyfqAXpouhcm9Uzj5ekq3WmpGwM+pwJuw2W8jVCQPKuZ05955FYebMR3vJs/XAXOCXD6RniiByZsuFEYKem2TATGZgHUl4y7z3vo0FzRbntX18tczpc3dGmbyHZ319uoOamxyrTQrGxapq5Vja5XBED41hCYcs/eSB2lv93Yc/r9k65DkcIpN2PD2vv0+qOuWdTMmG6E0bx2BAz4m9FywOZyo53m21cpKOE74rgRO+31rmZPY21fdp5NuvOcwWV/x4f8RsszlO8bJumh+e/Da5vwka8+NJm53qDZnXUrSukncSThM2qu9sigkVMmDA6wnuONxkcToc/h631cTpCFPAkyqTs9288+kzLyWoxhQKIwH1C8IKOPZNQc/Oq+bRpNmSil54pD9pcdmdZ3ijbpq7rH2X+d1Hs4ozX8lzMODk2yHc/7if9NCpHggrmUYiloDnQmvrraQD+3vTTt6Yt5tuxjha+1T6GR5kYFuHPuNVMt94N+yzWFxNB/hTSUfK5zzFWxWO4+Z+jMzCgP/4QD6I4QoXsFIIHOVDm++1hHEK++F5n2/hOz4fdDoslsvIsFggQx6oM3zXtjDDUUM+R9uuICI7ZC8tcy0j4aA5EIyP1LiPwoDmwX7eWpSPSriZ32ZBTvgDTuHCUESfWxszBpuTbllmcSiFq/Jwk9PpaNql8FcvuzwesydNQJ2k3hqO+74RTOEHJcPpmQkpgRPYemvsDdstlmDiVoPVvdOfcpkdHSzzKci91bc4jQmnzaN+/EPjQEGYVRiV2zE1i9PIH2tyRp1Np/jz9WNxr8dr86aPuUVZYe9Z0W4Vwsybx3TvQ1CXusDWjZVvvRu2eQMeT+oiX+3uhQEtri280cB935jvb3CITAPmMVPoCu/TlMhaUI+Ead4jdiAr3+lPRx3xw/z5ysaxSKhsKGTzD9TzVlF9LoGeU1DvP9YbVqU+s8kLqonoyXWqvTi8SlE2fRPZ+5MqpSrRbbXy+ybCQa/X5kt34p513w27XM4TDXh0JSeop1XmSYVJd0OTm2QCL0mP56UX18/VA6ei5sp975xE70uZIXE2ITlNOh3x8coqrLJxf20ZshL/+BbeVG2C8SQpf0iwA1fK2EyhLVi7IZABheL8KWPIuDsnWuuV+qOpdNAXcFmStD/wW1xOlys9Xq/IuE1qHC7oswacYQss/FI/BwNm0h6F7hh9BkX9JJm/zqo4of6mIwPK7tbrfofFfx1wKix4Kx7yAhuMpHbia2ulIiGHJYTVwOnUj8gVA6vRsZec9FlpxcOsJj4b5tD+LKBmgCrcSDzqspjtTtgPyQffH/aZfeE+vt4q5o8OddtV6OPovtOAaoQ1pyXMzMdLymz2Pon8fsquLBkkk2KtqRnxmy3RdDuQLZFv7En4sNWbo/HRU/W8TpY5A30mWpzwYlGWKfSlP0zsDYhiBpeQrSZgiUVGoyxnokeFZb9WkVe293wed+ByRQY78SIwYG/YZrb7T/H1xewzUdyuZkrsvX7nXshWPI/TaU5ggp5ln8Is9l5BXcbTPVhSiq38Ab/P4glfBTgNqxYfvZZ2OZ0Ws79pvL8Rj7FWGxFaw7lkFcVS3Oon5IxW+I/ImYxG1Zi8282+X2+0FhOeKBuxWHnrlp0XmtLRqMORil/vIAya45tdMbvPdxJgTJF6Tk2uBd73bBT0ipLx/jntger2yeAN1eW/R6AmTGtAdX828rtSAW8gdqKVwCV82Zlqcng8Hos5khg+3tGYMRdl+PXb+49d7Rno6Tt+tKPZqvGI1n34Rl9Pz+HjZy42Yo9BOsi+Uf1f/QMnk9EUjnmL4/Ld7byxiNcZ+QNNZXZ7eEQFEjLeiqhHye5I3ORzZJIB2V7JCXMOY+6XAU+7Bc7or7QLsrqw3WOLHOBp9YlGfvuYP+HyBby2slgkdX38aue+hsZ6pXvX4Vsno5FwMoIrmjp0d+Doxe0NDc1b2neOX08NJsORWCwRSY9eH+lvqKlpad2+6+jA3UPRRCBodjgtqWSyr1upZi5Xfynss9n9DEqY9qMIBQac/t3PdQmrqaeaayq5A0K5TxVaUZSZquXqv6PQHQ7G7IGTrfSkRVw1Zz11yG9B0BbwWdLxpsuXm1wTwyMTTU3+hMdlTqUAh5o9CT++MXjypOMavp+MOlwuH74HpMV/+fLo2PilQ59fbopHYj671+KwuJLxsV280ciZZBNcPJLw2Mjj8XI6JZdKUfpDIZny3cV9OgOkOXngDEe8MvWUv9/uWFjrkPntgwFPWa3/Kl9NqalobOOb+wb9ATvK346Uy+UyO9ORcDRYW2uz2e0uu90OswSDQZcrFXU6Uy76G/41aHelkAriS08ySSYN2mxBO3BaX7jp+pluvtoom0yy1d09DP8OYc818tL9t3Luu9gCszPgDM6mLbjMja9j5Hvidq/Nc2ELgYGcKFa1IVQb+Dwa85H1zGQe2AuGqw2FyDHLYJmgz0y2pStldtG3Ax4nzE0Ps4VgTPwg/j1kC3ii14828iYjS3vlev64n54SFSz5e0IHev3fDs4S9FPi9CmYTyYA0/qiNg2fnFLq8N3tKeyCFv9YvRWQPo5WPYVnzQeGHVhsOC/BI0jBF4OuWCJ2cmJi4pAzkkw7VeuR91mi2BhdJyZOjKaTUXutzVfmMwO2TzmiybBzoqe9BXEOImYFC7ia77jmdDhdycO8LNyXTZHHTUT9TNWtWRlQmIFkM0MtWviOWoj2eygsxWmn9x8nuoooIh0rNuHfW3YdGz/pDNrsPjNgPIc/eelq567tDc372g/03rrQ1BRPRrC2403J6+M7T+3a3rz9YvvxYVfYY2M/gWccvdTX2YBVwwIgiS8S602t16+lnM70hWYVKvw+0JVemOl7s/ZANe3VT1umzZlD0M9MiJi+jibzDdcJande6+er4XxAOTkdxwAFY8OZEOyBRZf0j3V2537E3b2v//jA8MS3wyN9R9sbrLSzFNPuX7/vqithC9KJ4h9o6EZomA0T4YLGlppexNTOwcvHsHHQhq6bCnnnwbjvBM/meAoXsk847Z8qIDQdtqCpw0850yQjfyqeApqavraLr1afTeKqEApXi41jnpDNF7QkL3W6EQ0imhZF5BuqUeTqajUcNMmyURZlk1xEcXJfKuGiIznV724xyhmDIJ3hjO4evyPqTDWN1LTJ4kyYX/aI+w6SxyyLSg9MQvK0xVqNnWQlm8VPH4pOQVoFgluwNQ00IdlKpQ9tocOR7TyChMyscdgftHu9sZMHGhGGFCkM2MaubkD2ZjRhZzMgrTMC1snGbhLlvrtO+F0pi8s52M5Xc3K2QGKircLlcDrS15uVtio9oC7d9IWcQtNNu4S5uXBj8FN4xxo63iSeBY/CvyzmIkRJQryeJ7Zx03CS8COCochgsrpbb8URxaWihy4C5dRRFZwvkqtrBppcZnttYhQlXFlXhDQfrpR/SbGA36Hmv+SXfMOI32VJudJ0sBs4lUcJJuLxOI7flOMa2bWoqMigENgjCXmWWe6dchqChV6Y3lXlObOz8iVSXstRwZv/8EabUKxoDChwBQ+erugPtMVksoJjlHZGLa7YaDsvm9jzGaqVA3S4BGOjxJrJBlGZ59BsHZOeVOGMUk2PH7422HSr1V0pswcYBffVNM6WlOvyTr66ssgACEFiBpTUnZDT7OjcjARBLp+EzqmsachTHzQ3ir6WuCK57e3TN1+r4sXsZxWEPB+TL+R3qDslJxUXs/AMXrPr87TLErB5okcr+Qzr4+LnaRSLoyf3qSAAN6XAXrCXaP5qkpUBeLTT1dQD0wM0lWW+FRgMgp6gv483VrrJf4EHcWQ9Xbb+Pvlpp4UW8szIORAsOU1lRHv32RuQq25vW7vt4FfnCRbOQAAFJ9qUI1ghBM9QROAzLNj5uQNFH3sgQgx6IycV1Qz7gWw5gHRVF+dPbF7D9eK4yRw3SsU4In01XkoGLRbLBWwJJquRL+4AEztoD9aGe6y4XxQqkTeIYgHJQVOK5e5LrVN/au7cmKkcR664surDd7etLVm354MbApUasC6kYg0hMPszFDnTtqIoBgbssQurGEnqoBP0BLMvcuhoCxBp/kDcHvMFmw5jx+JmYOJMh9axYEvmt4wCgglGeiur6wF79zictXZfsNY/YJJRIpBw9BiNVvxP24W6UiabjbtPcMjNjSPNFdx8zQauEFu87b3Ta1eUl5ese/O986BZqd+SJ+8qXAa25CrpzWffFv6OVdZxMgLgHVTB5K3+FpTBHXaPPXK3xV3JqVkrN+m1M3zcgugoG/RZ+VMRn9k1dA0ganPP5xEzEpqgK9nTwqDCbAyjuK31AL9ElcOlod1M5mjnAg4Wa8x+D6S6cP58n4ariwX84cG1K1aUz5tXV7fng9dYOZbKQAUhS47zYjRW4o+a1ubtW7Zsb27opo8Nn9tyKVxrB/vMlY4Pd/YlXeZAAFU0xLzKJH/XslSmgmT4VwMw1bFI0BVMDm8HpOo46TL7aj2pA0a5mpWbuhvwynjp1nqgLwBtJ6Vv989PuEwCNbvCuqw1Yb4WnX1Jueq90ytgwJLSefNKKw6+36bSoooKUQb1oeR61u39h0cmRi9cGLwwemus71hHK2gefONhf8xnQaHYnLyWtljwB5gKoiJPR981aGhfk76vQzSKM+ga8mSQsZqSyBOdjmB8FHE6MP6G9uMD4ydSg59/fmH0bu/VzuYavCc5z0mZht9e+CrZSGzOe2AeQshZReJfP7i2vKK8fF7JvNJ5pSV7br5ehfo4wq38qwrqz+Fuuy/uHL6QjvsjUQBSTsCkYafrUC9SNY4/MwqmAjB9l8XhsDj81xuI4lKkm8aAxNjNN5VoPzIzrSTzh+NBPIsToR/C50h87L8QIDScGTvpiIQTMaeTvbQ/nh4dP7qdET7RIpBL7gptWGDA/Ck8e2pHPiMrfMt4Z7f3lM4rKaFf8/BbxekPXgMsZSoqyvyEjlGRUBfi+Mb+sXQ84rAzIA+BRdAWqq0NeRPhiQNwwy096bgFiD5DVJIgehgodhYySUs+JxQNwvRxmoAzDIU1HVLsE9EUYAhCFVEROdNCmfLJcMJLL2cjyItdFmfan+rtaOFFYEHZVJ5TlOkQGE7TSiLP0oAypwkiNUcxi+j0hraba0vJcnStW7dxbcW2g7AgZVtcnltngvd1n7oUiXhDNtDZAOClgOoBwwPrG2Bpwn/iaANf33H3st8COMVndly4LchSNp4UMo5muH+SCjBMAkNOV8nV/CcOJcJlUsnPe5rxxCMpYDWgIwZ8BMsi3bOY6Zcv6Ak7x/ursZABBgl0YsmcMkNXm+Z0+eHUjpwBRf7Dd9fC9eaVl6/buA4G3Lhi47Z3X6tCWTID0BDEIlv57jPDsVhZqMwLiMWBBYQL1QxgpIBK8aESyVunavCg0UFs+r5g4tN3b1eJYLpM0ysmzFw2y6y3R353pcsLR/M5rt3tqARGOxi3hEIgp9rKArFEOEyvnXaacf/w8mWx6Fi7wlnBrZMkZWqlbjqgay78QE3EoNcUXTj+9pvlZMB5JesqKtYhlqnYqFpQyFb9RT3w9Pbr8ViIzFdblohGrw+PDPT09AyMTfiYVeELlmTTyHa3sqk3HPR5vV/umbfn/SqDIGneebaerp82y9fryEGRF5n4R1/Y+sqvhkJlNvPJzhrdjmPXmrAbuoK1IU/Cc2i8t6evZ6B3/ISDlkPIBpTbHomPbOetlcUKP7XUyU3HCZ8lva0QUBayJmQfx1D1Hh0gtIbL19FVXlFRUb72g9f5bO2fir4tfdeSNp8n4O2KhV1jxzq2N7JSLl/f3HFsLBV22NHzBZrH6KmaxkuJoDfk+XR3aemer6o4+ky57gpGVZjxUg8Byeh+5+XVa9Zc6QKcaLN8wTf0xpFrR4FjR8KXdrZvaVSjwO7mi0d7D4UTNhsVnxxNF9qVauAlUz0w33yjiczmYsBCxmSWNinx599eV8ockHZA1YQl5aXb3mOrT3VSmTArn91XZos1ndy5hfqsFJNVNlUyVrd1X99gU5SVkaLJ4x0Ws62s7Ms7dfNgwffaCOGaXHOe3gMZHwF0fGXvldVrVq155WyXzVYb2blvOO1KEb087qd6PQWKXCXCKTJTZfOZ4WTYY8HJFYwMXsxu9t/RIzVHlv5UjJ5xr7AFHtyo2q+cDEhWLFlXWlr65g1E1ALbA0XEZRanxefzpC8dQ4+LgjMPCTQniZJoYmHYlsOjfoQvFpThggFbMOT9CA6IqHLPzfM4cIVckqA6tTiDAfGoYqvyxZWtq1atWrNm8xC54L1gLAhyaio5ONJeQ9QQE3mSJDMcAwGusX1gEA1nFnNtHOhDrlqiKIWrluMKC3VzIhdNLXIoCj7ejTfhcSVI5ErUkxjhIIsHsYg5lcgq8+1RAFY+z8ljjcD6ZF7DzdMRQooYd3tPklhAPht4grZQbOdXCI3mlZeevnm+SgSNypD5LOxPw8xr2KQ8+fLqVcuXr1p+5aUTKI/igA/ZLWZnfHyXFbisbECkg3VqUNS0RURg7+4Yc3gs3lB4gOe+d3Hxx3PolSugrTHkj/B3kX9/T8m6jRUrNlas21iyjllwHjlP3Z73qlhIRSWOhgvpqCXoH+CtLBeVBMQaBlrgOnTWIOQ2nhdr2q830anotYVCIfOuqvcoNiov3/beeRzolAoqGkaiMgVzQqyOF5P5p19e/cqq5au2XtnrHgmbXWW47Lb0tZ2b+GoUXYqJE8gTiq0wAp0O0G09v+Wk02y2+Y/x8mS6SgFzXUuHnJVmgsbvckxTiR0NtBaqvto2T1285RvJfFh6WMD025uvscJ7kWyt5/uakKNFBy8yeI+Ca4NiYE5Au6BUZJDbACbf9WNHR1hYGxhu5Nve2zOvfMXaFdveQxED2DFfLE1vwHyRXxH5R17eumbVqle2vvyFWzmehEfDCWsTE7sAVlOkxzHaIcepxEyBIkejdUdv0uwwx64386JUWAIv9MjMi9NPzdaAk6jOjKcJ8MiA7FJuu7ltHjneOtoDS+tKStnmRf9vuwnf4Yp0EmdUmi+ACmgOj7fgaOGEXLMOhzgH77IYCI1oFKqPRwNlCAxrEwPYz6u+2lO+du3aFaffr2qTOIYTFLJFCpibVKnk3Jt+SvvfK6tfeJqvV9oR6fnM3tpwbyPhtAIllPoqQZE0TBiBCSkgbbbAAY168fsw9nD4zK1bU+L1hcU5cPQ44/m3YUB2dmAbrNi2W/U+CqzXHvywSkZGZ+CK65VjTZaAxRfZSScd0XPovYL3ZxAzuBRH5D++3+ks84LrcZxEANre2wYPXLH2TcoMOSlPii3kdeJAoVNGz3Mm9+/X0/mx/OXtfI3V3TyKdM7lTF+tplI6gmw9ko0qQYNbcUSO6EALjtPpv96omLIQkkr95aYGSbh9sJ++cm5gwhSiGrxLlmHAErIdXXVvfvk1WZCMiNgQkXBbsU5nKHZb3QjvQmh2Th9lNQ6U1wT1EBJyMYpAFmz/PFFba09fxEkr6s9/cJot4g9er5Lumx+oWayJf3X96uWr1qx6+Ze8XEyVzMsWSyJ9BpZlKxYWQzuekOkWxc8YqIWkeSKBpM55uRPNelgs30m3VWuUP54rwVKhcpYuuxMagCyrHkg+iNW7++Mvz1EAAnABRl379vm2ymIcnVT/3eVEHFjmjZ9hChOZNwMnNrDamJIly1y8FI1Fj8MAiiAzoJsW8c3zcrZvP4eZTKEXc/yjq7cuxwF85Qtehj8aixvGrqWvd6plFr0aJlI3HsdQDp0BJoT9bnlspDrQx2OrxafjvrPNVJhzLsw40qwemFvJhEbf3JY7fEt3fxZTIziKCjeuAKhgUlvQ4VHH0WxQZg+kzxALko5MiZyAtnWlmM+Q5Y3VfOOpnZ1WThFEyWSseu0g7LdixZ7b+mxpTtGehdnsgDZWvtL9s/UUwKx/g3BY0OWMld27Ohr46rYMysLr9EJm/8XBryvSKdWwX6TWBhGAsRYJR5WERFDJdBHM2JMq/AAwgWfwEpdtLaDDpI0MWKKCWTDg111ln+xmWQnyuo17bleBBsA+MpDAAX8IHePO5NV6xYg3yoo6eKcGyuDpLBZQv63v7+nZRT6j6FG0q267vYeg7op3X1c3EIXj8wT3fIhBaBkW8BVmv5/VVKqsP6W68mLPyPFWxvzi2L4mqDaXyAmLgIPvOhFBMhwKHALpV2As83wRcSqnMcuwn+sSntyGKtKxVl313rZ5zIB0cNTdCXXVHqkrp0N548aSbe9VZXkU6OdvGYv4wFhGY0MzoOlKusMCzhJDpkNIRI6wbyzt90PEo01yQ+dFlHF7Ts8rX1dHiaFqNkEtoeu0IgMSyxYfeQER9KrVLzzKyxJZFLDqrmtxf/xEv1sBQ1BtCM6iekVgiehqDgwm7BCh8KL6Z9TyF++nyjT3ZsPpGkNQAq96f1tpOcs+6DrycZf3s90r1lUgn9tYuvbtNkHzqq13mwgzMDMevhuMNqxUfZaWAa9r2OlALeNk/Hpjlex2GyjZEl9/d20pfPvga3zO+VQDKtrWY2pIemPrK6uQgHzBmwxUw1YUIz8Adog9fXlgu5tDBA+4KtNkKiF8Nri3jDdZ7GavLeDszMmgcN9Bi1EyH2Xu2lk69e5LSgbgMlbdeJOQaDV0mbf7o8DQx0fWAZ/BEi5d8fb5PCRuQEJy67KZeLdp/zjxrYhmbyLyKG3zyvZjJyJoKDKnkqMkaWDCPoVeD+HGm2TAPTerdNpwItcAK7ENAl8/ghRu1ar1v+FxlqJmT0QPZTwKqqs5FR/duQWPENlL4RetCuu+wxdAArH4bE70r5uUAqUH/v6aFj/UgHiOTDxPGbnw+rsl2dh5XjlOkSHLJ3UryiksLN1I+XCGPQH6jFVpHW8CFYu6g5OXdl6sz9/Yhv5eIO5BcCoB5sOAVZl+LzSbv7eHMmu4oJhHcTUSLFkZKYSAlAGjiUtXJSqUtsju8YQ9gPqUIxo+2dPZqmhe7lRvyp+2OGIQnnLsynYeapg8kwyoTEa3HvhBS5jLrCaWyynnb25kzkf2m1f3SWwo8NGRFVjCwLRKsPlnu96wAclWpf74NTTXoJXBEY4Pnhg42tmxq6Pz1NXhVDjsIfP57MyAAtuzWMzGv/7uRuwNSGsyrVmZVZxzF0kNYa5QBLP+twz5QOcXYfP8WAJgHwoIZpcnkhgdvnqms6OjvfPUznFXJOJBRcSZwlog9gg3bZf1fZxwjqkcKxtK6vsm1p3IbsdXG+epFkToUvq1OTDk+7q0opyOldJ3P+SJR0WAAWfAakXvX/uE34nINeCzoZYEUD9BvycsPjMj9IKQ6mNLmNoLyWACoRWl89ZVHPyQr+TUTTBTtMhxdRQcwW9QCLP1RJoOnQAAIABJREFUhW7m65WVoJboZGUsYUd9lEjTKF8FQO+P+wnORyEhFPTSi8UvHG2RqiVNxVtbY9d4TT5H/qFLmCymqGVzA+uLFPkbB8vZHlhCwfOdLwNdsU/r2JlSRwbkMkgn4GR6a+g+Pf553OnwBNCA6gNvPGAuA7HZE3OyKg8MaI6MblGhzUyP4esHN+K593zFizq1Hat4MtIp8Zte2Lpq9fL1zwA6U7KUbtENLBVVTX/C4oK1POSLqJoC2EXJAMGzJXkZ7tcGLo4gCQL3XX1XivYUfmAODdfZPlXanYrkIrFI4jJl4Q8qShmiin1vxZsfB2oDXx6hgxnIwrsM2JeoKcOETFMBs8do5f/fgZQ/4a0N2VXZGOQnMKMjnYQQFGqR4PZhVelyoZ7Iv7etdONGxIKIiSiRgAE1GlfoRcQfX2xdDQd8+RFFRmiFnzWg8qmrn0gj7Dy0cyIdBtMGfkh3CMpFaAwIgckUvdtfXVwtA9MVqfMuL5mmYaJwauip/q4JrmdpQDHbxEwoLmBJNPaZRFCrZBCauSIURdgSXrduRfmKuk9j+7u8dxgqU1dOhwhdaHlDnE+vjoO1mlO27JxwRmKsKBxCVS5kT8TjoxNRrGyLinqBsZv3hdcOAuopR1TeJmRXmKxhyogo+/1mM7bA9b+vscqSqFM/Kirph3BOhCd+3d3ZcyjtT1MZFVctuk4CkcSJns4WglgRAhQxxEMoJN9MR87n5ih/Z5IExuXTZFFVMKIaVSEUfu3NUtX/ytetqPvMs3+/B9kIZcSIAxHQqtkWChkGFRHTg0bJt7YfHnZcw44Uj/v91wYnBo4+PRCGi+By+tspL8gvHRSeS4Ap3ES2WqTjJksK6EEi6X5hK47grU/yVsQ/fFbcDHCM2RIGtshxDacGJj5viuPCLpgcnOg50wxylpGScWgriEVsh9GpT22YqUNNo3E2u0DaRBRvYFBtr7924/b7uG7f+PB8FYmL6CixM1S9vXbeihWsnrSx7pPA/v3eT3eTS9atRSaSif4LNmaFibq0bGk/1tc70tt3oH1LK1o3WWnCQqlKPwILUXPzb+9Zu7aCoWOyvqA1nhXd0aa4FyjCqq0v7JCzrD+iWoL6iuPKP2Y1EQyuNO7rPNDTOzLSc7x/X6ta6mJ9y0VFMCCqNAbGiOII4wWwyk2vaJFlFczOA2VRqDr/2u33Pjj45p5tp+nac/CDr147z2f5yiiLkAHpEKn7umz//q5MTejN9/XI2g2TVoVAjVacXNAudJ7vb3LSPk8lRgLXdTkDSpyA0v3aFWu3IbOWRa1moHpyAgV7bv3y5a+sfwlAT6WUfR1kcoMen8/fi4gaoEdhd43IgneD6lVikbHaCtTDJFeiAiaIoijchyw/6yWMMKbttfffPrjt9DaASxUV+Ci4tm178+0b5ylMxtFw/iaAO+yAZMA7tfv37//4CFUlKQGTi7RSg4YMEEwgKKohSEWMxupqY3ULv+9a1O7xRNPgFVkiPfk6Fh3GVciI8cqnAe7L3CSSDiPDbnp5NcFYTyOjyGp+Ikfi+9PoWoRCq0yLUyfSS9GLVaMyx0RvWShLVJrqXByI7m2xaJqyFVfAkZylAatu3HwXhA1CCDYSxlJB+Cnss+7gzQ/pWQ0ywU6U/64rn4dsGAasvVNXXopE5LwkMqI8Z1CpBcIk/Q2BVpwoEqzkt3t9jqarJ6MuX2zYnVVGIqhFbkO+TbDg2+cBOKjeLORL7FiK78ABly//t3qVAJmhdgKr99thwKOsG5kXDDp6M6Iuv5lklgU8uLX9QN/A1aMd2C6N6IznDDOcIDkAbXYGBGRKBbKNK5BggPtClXMyYF3dxoO320SkmEZ8wnIYF/FgxoBfUySI0E1mNsoaLtfvLrAKpZC5t9X8dkTXHrvN39c9EUFwc7I5kwGqhQPggm8CFjyNWNpkECeHaQAN/kBp3NaXKFrQNioM+H1eD04kq6AGhgIFAvDGIkRgUk6/gePrj33ujyRisci1UQg2oNdi0iGS3/tyBfLZsbNu70FeVo5QjOxHQAvKwFS7RHy7573zWFdy2/mb20pXEKigGjD0SR2cER+YkFFuGsk1pjDEGkx4wcg3n0AbETqvL7UqY37oI0b6M80NLARHye78u6excey5IYjZo9BgYM+Bj2qQVST1yi4qfVBgxfwQbnUp4vV5HPsInyaOrKTuYDhy4YimDEmTQKIRfwxauDYQdKJNE+2U8Gir61yBsOPs+YHYAxEpE/EKBqyA/TauY+gLi1NKS7bdJNhernr9g211JSoeQwb8rG5F6dqbejXlmxoQsJOZRf8K1ImbL0VcTg/kkPfV8IdR2rzn36kakKBP0WAC5EObYDm4MrKAWIr9KNsUUFvBXyiIQRqX0/VkfWFGfksqFvAlJn49WfWLM2CfAzKDIIIYZC3jiXtdZWUhCklttR7nMauoUNFRyKhQcJr4OsdQmJUBFf6rPStgvAoWqRBMoAIHVMesqDj9VZuRGh1ef3tPHR29R8iAZZ/VrV1BdWGdLkPh0vbRAQzj1ICDInO+/VDMRnIdyU6+BU3l9qHa2EhG/FlWH4Qt4vSKinIACiZeFdWC4RgkzjqiHr0CA67/ab2OKSmzjZ7g5lNpp8UeGZkiqyiZELVA0MJqrCZ2x/E4SG/sspE4Y1m4T4GzUviKu69TdToMBfJXs/ZAFHfWMgsyAyJFowt1N7BRcSojQyDshD9/cw+ZFUs41FX26bq1p2+iezqn8KIxIEPOAWdjISGkrj8ejYW8AbsTyiTVKPKcjHlD3hPNDLyiB2AJYxO8sYeQ/Q/OC2KuQo1VTMooOIRZHrf+N6pKSjZMqUYztwVo1c4sWKppkLJa3ST1AdtY+e2HhrxlXWXejz/+0hMIdQ3t3w8NByMRThBAUaBLPZHi5C662Rmwuuqr0xtVA24Eb+jIkXN3zh3ZvXt3Kfu3bUhSq4DIE5cAWyMw6a6Q99N1p1FRojKNwPOTlHKy7QgcWjL5feN+0APLQmQ/VEqE+t4wRE5jyEUkdkCTlSUT3cJSho7le/XJhkTRMPHP0iG8+Q2KfXRqQx2WhIx+GwTlcGujqJHPpFeuNiitHWeOHT/auWUTfyxRO9RV9uUnR47c+eTLwP4uRLFB5OKIsKzWSomtIGhI6SdV6GZlQJ2x6vV3T6sGxOlb8umXX9Z+/PFHn35yp64Ua3jjaWxNEknhVN0+uJZA/a4u36cVp+GYKIerBsTxmydUZZBELCC+oWcwGUSxrjaB9ko5o0MBc0Ygr0/ZI3Yr2s848fwHaymu/FBlQudiWyJRy8obLBF+ltdIuXPV/L7PwdCPXmig6FvU1nLQidNzglrdI9GTl44PB7qGbGo5e/e5j7ywX1lsrDsDIYishobFIgqFZZJZ4YE6k4wltHYt2/6wgI988lEZbtSQt/bTr4/UVWzcdvB1Qv14RKAfvr3nzpdDNpv5M1BaQCcgRaaM4FSBAUGLQnDWfeACAGozeJfhS/sQoajpgwP0rMilxmJrJgc0YB8SqmiHrXuTVUYySgbYX6lhkBPdv99MS3gXr5kwgIrl8SYfWuHHUO9FKqoxoMyfuoYmAcDiTmciEgkMDZV5PkLqubGkvG73Z2X7uwIh/wF+e/+BMx3I+ExcvjWbm6sAI8Up722rYMVziv927/6amXD/kO2jr4+UonpJ5iOIQTj//jnzkH3I9xloaW3A5SVuOkYz6xdqPHWrKU3Ux6AlPvBr3gT8iQSdWidiNjQsdajFSDWqMxTpAezDgDfwMgrTM2NurNAvU83v4IGrr/xS7abLfNSimrtJs9Nx+S98G/Lxqhz1Hv53NBkIUvMSCnJggg0N+XyJT+tWUG0WFvwoAGaw51JvKhmPRw/1YTFbC6RA52TASpHCFFpDZECKYMiEXjJhV+ijO7vf/OB8RoOuqK2qwzUUHAr8GeFhlSAWKwWqaJluEVivetfOibif6hUAUJuOu9EcQ+epBC/qg9qkJX4YWjm0BRJmhk8tfMUMeBtni1qfLS4GQYJ2SZOh5mfMgNsZF4zLsET4fQ7gf9Q2jFBfpFM1y304lS4bIv1vNJZhty0bAr6aQNRVzoLbunNfBsqGbJ6IJQQJC08kdbwe7WbyFOHE2UqAItsBZlVXmmUOIec98snH5IVn93/8yZGDN3iWbRiK0HkZ6AoNhXDnCKRU7zsjdWEpYL9iHfscZDmikOUADh11ppN3O3iTmK35m/j2JBqW0qMNipHTZ1pN4MfvMwO+z4uq3oHAqvF6AWyWovqfrUc9+GX05UjqTAgmm3osXFtm94+7rdRuJ2WbQNDENBiqRcji8XxptqBHABsu7PXpbjIgMMx1uz/xDJWBYgeUF70DPmeyp8ak8j0KmHWzrQsTdfHGQdV8peVEw1qxou7IZ7VdZ8/+6lf3Pr3zVZVBRAcuYA3+auJeaOgSSWMw71EkNWNAuGEy0jGBRq+BC2h5YUC0L9o0ipb+aoqYWQM0DtCWWxEL2n2PguxDYCcr8WYMWPE+2ylUH5TUkhJXtOOnzICtpCUvFqklBL5lOAG1Hj+YOMWIQog7iPWOLMXdG7sH63g++vrO1598+mXMY+saKkMZjIpgtIhLjnwEC5Z1UVQNuqe9lqAhUaVjMFKzxCgus6+JQJr09kFikwOzqijH4btibcWROx91wYC/uvfxn9tgIz0crBLqQPe6Ar1WHTXJiAa1q9qAwJ8lUr/uODB2MknyJChLgE3pv7CzGSptpuI8ac/I74Qscip5iwrv+Sa222TAPe/rISxIjBLUg1XXBrEmZ8BK6qMmDQVEix1OL1E2mnn6ASET3aD6ucXlpTDrk911pSV1dXc++zI21NXl/fhICS0ryljhgggjuoY8HhgX9EwvCfUIeVY4pYXKLONAOkCJCHkDdPJydDGsA6pARsSe+8m9e7Dg2W9BiMJ9ltv4Xemh/bWJnVSqpsVaJFIJgKpAVjT69U44UIYz+1BPgmybJ3GyZwtDkDhyEUmtViK0vYA2OpI3sHJZLo/I8nEYUJCxPotRA2KYHes9VnaoS5g04HTwekLLRL4HmqK1iT7VY1WFEElBu8+ZSKCrFuQJuMJG4CJ1dz71eMtinxF+yTxwXt2RL71dQzHfR5989rEHuyT4mdg38tnM7OltD7AboKeN+bUP1mL9rqhYUV6RoQQidNoPC+7/VbNCaHq10uPv2l+LMVMmVno3GpnturecOjwMmbUEbTrYvbF+Y+Ho3WPbqVdSBI0AHkUxN24tV2lVeuLE/+h1mxjkILAzAUzsktJt7wvgioBjKuGAypYadTW/20oGfFSR1T50Hb63PRUA1drJ8IWMARVJwXP3hQO2LtZEsY4iWyyjTz7+mNmvVG1WgwvGYhYcjXV1Rz71hEK1gShKNIKQp6SRa8xNN0bkX39vDzpby1cQcaNEteCRT+/96uyvhgZQz8EN3uJMDN0LXILkEopdCuukaT8wcP3zeFOECMusDIfUM+I/SbpMBMXRiQqZS/YGWeQHzii0aS1UHRbVhhRCHb4iEt2223pZUgqU0aE47f4N0QIRxkCZF9ACtkGatIHTwTNcz0tSHkkugkZIr99nKyO8FzUclt9jLz+i4ucqqayk5MjXn3x9pITyht0feVGBglqZrBJh8wIwszagKpMui203PgAyTaQ9xJ3l2Hk3lpzDRnj27BAxPKv53sjQ0L3EGRwLeKWWLf07xw8541Bqoj5WpwdL1+NJJCLXhtFZyDp1cTorUqVIPEuJzqEi9E26u+/6EcJFjqm4NKtm66kluWTbDRKaZlEgaP5ZioLye0rl1u/l2wxZAkTraAQqhIiHjTk6EivGWkHd95IBS8srAG8SQlexokRFR1RqAD5UOeqxK6jnoKTuzpehWq/nUgt0PkQpa0BlzgaU0OKjP3/j7YN70OFfQT1xFXsOvvte5wQsODSyyYoYJo391zsBgT5rQ+fOS5+nEzH0fYCzQdU2V9AMFoLzRO/RLdXwNjkjYcX8TiLiJhkdKgr1CHVBm/dcasz0I+PTA89C1WXPa8gMDHkNXJ0ambzBcuFnmQfiNgBHOHrZBxWQQ63Z5CQj0C+asDcCcMESriAD0lqCzVaoBGV2waC0sIlZQXzHj8ru1dZ27QMmKynZ/W/OBpSI0iy36ds+vP3VzQ/effeDD95+7/0br7fxnbVnAUJ/4a5uPgEyylDsQM2+AyMXIuEYMDZqXCizB0NBlzMZTx8aP97+a5kyOUbPyCob00LLtGUaTGCpNow6YYBEP890IfCAKtClcXK9+SGVWA15VIKOaRP/2wyYgJAZGyAkGWrG/eZAbRjVENhYUS9WlkZ4iOY4m+czsHfw38bycnUrP3Lu3Fvqde6ImvSXq5Tlz7z7a0NDoA/qib0w50YbITfpQCli5DB92/nXX3/9PNU29W3V3cNwwcAB9yao8oKx4eobS8X9sYCN4n30udgR0Tc1XbswvrOzuZ5oZyBDqWBlhmoqKYJkKGLzqFgsBFnBsM0Tig0rrLULoHbV6wcJkgYaY+BEjd6ZasAviFi0+fduJN8iadMq+xxpR8A3iCMkw4Vi1SOdwUA9UwEY8GOYaQUhw6CQ7T731p/+9Nc/Zq6//vVPMGJpCWVdpfPqvkbQMxSA9D5iyB9kwJyAMRIK+gyZfIB2HJSERhJdXYleqBr7PJjShTbSGCOgUKrphb5p6sTdkZ0dDfXUYggIS5XYEtRAmDIYQFSASQUDETcQLyiULnhjZTYkxCZ6IYMKZqzd9vZ5k5vjJlcs+GYqym3+6Y5KI3tD1e6dOMZ9kfH6DAtTq4vVOpEIUvJ7JIuMnPvTH/84f/7CzLVs2bINf/zrn84dqWPnct3XvqGhrsAZiqiUHML/AxquVV4UbVcQRaDCjEQ1H/5w2O5LfAsA0xNg9CDGQrEHzbFI5NBwz5mOhmqyGBQygAWjERtRFYRI5Sy6D+agUMTAPwbyGwjL7A0P2Wr9TCsRPU0MkV4BbkKVkRGLC0hUkKAGpL96PRFjRJTeZK71RAQkouSZPG+XY2I76iSsJIThA4nPdrOY760//XH+gkULlmQsuEw14so//ukcIu3S8pKsAU1EhteM1Pnx7PdADTWvoGtOQlHoaiSEnvOYzaPSqyxEhIo2NQ2e6Du1r4VtWUjjqDpSZChSqcpkt01P79375CMmbGsSp1K/M4L2MGB/EistRscIuaZMNREY8H29zGsIpKoRDVwNIunVW0HuFdVUpt/vQIPwoWbFpJXZMtCATZn21zLACNgGd5P3MfMtgQGXLSP3WzZ/PhmRTIh1vKLkEzMZkDbjTGvLXCm+Qn4eA/V9oBYIVXaGJoFvBX8Jeb1DlICTzi7EHCJJ/4WRA/u6i1VpHVkqVvFPnaSoFCWRq9n71PM/X/rzh3+BcjinkF2LSXuRFD4gGtF6IgYRVDMF5EBUq1CVwxLGIVylZ4IdGq6IjqOy5vLVq9HeUETmh/s2QZIwPsBXF+HtafSaSJSimj+DCjTD8D/50x8XLlmyYBGuJQtXrlGvlQvnLyFLrnzlr+dK1oLpg0xvCG9DYXJqEjfX6a7akriBV0lSahsv1BKV4QgZEOeF1wsdiWjYObyzvTUDm5LcEgV5BiZKgtVLtRCT6YnnVi6ht75o4Yuv1liLid6jiKK61KjWeBhgSiBxFbMdqOz8GtsCCdEXOUN+HpxK+USDw+bVq5ev/lkNQkNkIc0X0o5o1I/AVFQ4rU4LnMhQZHRjvVC227X+jwvnz5+/ZNGChct+/vhzLz3z7LPPvvH7xx9buYzcceXKVX99qwLIAsAGlKllhj9mqxH8D5rmwFEbMHW6IuKn7QjpRxBCEnTgApx0+JsO9XV0E225Wua0im/MeQW1NOve8dyaBYtw+2n1PLbXbUUknRtLxhExqN1pK/NhDbtRfpT1tAWuO/12m07KattmmetKMVg0j6yGAVe98gjPmt/6myD8lhzFj2KBsCpoTnRB0GEPqe7x19YO7X9lKS3WJfOXPfbUs09317CIwF2z6elnH1+5Zhk55PIrbwFer+0KDNcXSwbt55fnrtqhVbAqKiJZTmBUhxMhAqeAAQ2F0+NHG4oRqRhNRdyUK8Ol5azKs2sWLFn0Hw8u+o9FSxYtff5RxShOUsdqnSDONJJZY1VV1fm3T6Mot+0rvax6qHZsnIihcYBUV69es/VZdeAAmhvMpH5XT+0OugJumPqX+oF44OwG9dxYueG5dzapbCOjUdX02rT34eWwH3omXv420NVVG4bqoK5Av2t2+oEPTOo9zthRh61fJHXh7j6GS6IyNBQ70bfPykttRnCyeElLQtH8OFa+8sTDK5dg7fz8+YfghQ+uIVqVqG2q5yhlgBnovZtk/WsHkX3PI6J+XodPpIWAU0OHDBd1ORhw9eNMFKD+Fo40H61gjgmEThrajGRZsv7h2w2LF2IBL9vw1Ds1xBRTmctwWMov+U3PvLycDHjlLHbAgPMLPksK4/g51YWnTKjLGEWUkDXsAy0ICtle7FgTB5qpi55j2IrITZk1zDg++GYl/+QG2G/+U08+/cxjC5csXvZwN9zJoCVRAHlvClqCybs1VqtMncMryje+fV7HZUYGMF4quL2MbiyaFPRZ4xOjyxXOse8k4EbovUugISNkNeSF01RoVydW17zz/PwlSxZi9b66A2pobGWwLcYgUKUZ1fYn0fZEdJH9Q/uTvdhhqkjXL/vfHE5hrXPkfBkhq7Hm1AU/ybzY7OGTxxvApKJyLtXNxUqO18wSz/3GUHj+WTjgkp+/w5tqXlq5ZMHC5xkUxecVPhWI5aSimKMySAMPX/8ASSuaZ3kZNA9dUSY2Qb8ADZOUCU10/2Y9ZCZWv0FyqWcSmIAbGWCiYjqt0BsVvsicsvL0Y/T6i1Y+/DRmBjE7Z7mGEp2NoDW4n36BSS+s7xpy7lKslaKuKK8SOqfJhnzB4FSVgVKttA7EI4AJENo7DzdkSJOqJXQa/egpzCIy4KKFDz9ibXTvXTl/0cLHHuXl/PxY8jGp2n3X7zIHL5/iW/S3t5WD8nBQbZmQZabSRAQhajsyqsvviytkwJ9uEkz81ZjNF0r087JG17igJOh+4t9XLsDpu/KpR3iryW1itgErXSSBYEYmwc7k/uUry9H5tPxs7CrPGK5aXvvcJ1xrdbgAFTVfv0zVVQiyj+xjRBZdVp+uKC+OOIWxjSotDLhgyUNPKtYdv1i5FB74iKIR4JTUaawQLjYHm/r4lrYPTm9E9/bNKsDbsJwmoIUCdzHiRJze9T+FVszyK6/yXPc4CpPUflk4xjkvP2yt+cWaJQhflj3VjWKWRDAhKYIKnFr3oMKXKAISepapB2weGu7cxORWOC19f44eOGmSwL7rfiY45E+dqQcOpahTB7mZhElyPeci/+RDOEKWPf/sk7/YsHDB4mWPb1IMgqAZQi+B9NfeZDEH/Xer25AHI49jNWHCZYiofbujna6Ofa81NFay1OBZEptY/e87+O0nfTZbAnkwxynTKGjLRvfeDTg/lix7/BFoHxBnkM0Yo+SIb2w/00kEQYkcveZhsuDW/bHweLuJUbY158js+0QmibRyYEW2pyKwn8XivwW8zKqdnzzl79lkMKPOxD/x8LIFdAZuWLlwyYIFCx56pobOdS4/egeRzvZBp8+VHm2turkN9YNtIPyfV3G0N+/c+fq/M9dbb/35L+03kGt3v0Arbv2rfH8MalixHl7mCpawxFIBalB+5OGVyxbOX/j80+whBiUbmoAPdykaSUPhg+ZuIiD/JWLL5av3d9kT0b5GwmMMee3d2cqesMFZhpwYqkjM+M7BQMgXcyYHd2Jih5UpshDYmR98XtgzpTEgNqpnV+EQXLJ0/lKEMQsWLX7ojRrS+s5AfSgKccZKzMOEkNHglg8PAjVZseer2zc/OLhnz55t2/bsuXPnDqA7WO+tO+yv5/78VcNLW1+hykjNsXDIZ7OcIYKhmHkvhszUM9YnVPOLlYgA5294kjdpAjtq4qwfj5eVBcKUd6g9Rb/fvHzr6rM4IIfCd5sxVCjTtQbG56zDGC47xyY7oA72czBWlZ9Eu9pEGfLWkqpfqhEN5Ca3fGf5FchEVi1dDMstXvTggwsWL34QFkTNMFe1qcIJr/TGoUsb7XgfrBhA7GgQqGC8uiNvvklW++8sAkrXW3fO/flluOCara/u9IcsPidNCssN+BGErBAHjtu9FEHPX/OSYtQcbiw47hiEqAMkQ4gQx4KlR17YvHn9WYDCodrIoXbi/kpU1pztUKoHst1PSi4aB4LVP+gJIXaOTGyngTEyiRBwqtbADFr+7FNkDWi1PvGLNcsWLH7wwcXLlj64mCz4DJA+FM7U0XtSMU6Rw8j6vZ4/v72RwM2SCqImAsN7E0WgI+SAzITnstdbb/11NQ7iVY+NJUhCdEuW509jSomNhCyZgivaPID+rXx8U7FsyOsAsxTwDMHBXhsiIBgQeixW9yOv/v7lRKyWRPsSadCORVZZEubSrUliQ5KiLk0F3LFTSQ8V2MIjrdQgrpByhGbS0nQNe0KmWZ9nhDtTzY69jz/20EOPPfzMcw+pFnzWzaklOHooRN35o5EhIHef7i5h9bLSDMVzD1vB+T3wLWa9O3fOvfUyDLjmCiGS0QutfLZZkRSH2L2j2qxc88xKwq5efCcbcuryEFV/0uzxohLQQ2N6KTOyQlir+7djgHbRqxhF+48sSBlc5YHZSj+pXaWM9coZqPAYQ+5hCw+0sDsNeFRS2aFcgUQxN/3caBpcI1r5HU9/8cUvn+C7f/HQg2TCh/YSp58erRdloCZA38vsxDzL1GxLIeuzDR0+b99876v3O3DhGO7/y1/+zKxH15+WMwNi+Gjy0A5JLPR+ge6Kyf3oY8uWLFi68hlKqYsl7VIBL+x6EtudPU3gFa+vwswCE+XG1Wdc6JoNBB0O1IcldazXHPsIofLDAAAgAElEQVSFmWQHCLLIEtAKDjJ9TzUvq1UNkAVU8gQnZQyoZA8QIT+ZSMf6AJGKGChWFTN3vualhx5csODBpY89ncsZimijvmjBlhSAAcn/6kr2UHvUjddeP9+mmfsi1Tc2X+z/M/bAc++eexmb4BXQvVz+YaVSZLcio3bI+ImcRCHg/IULlj38BN1FSdQaEAh557V4Ihw/RqIV+GEYUISoV7WRVMLtPlAUJlozQppzNGAGDEMTH2aXeTzORI9Vl5u0oAgavX6ilaq3VZSn7oGYQ0D4Oks6kaqKQs1zyxZjP6RwkBhuJC5PNc4tdmbAI8RmQsP127fRoKdncCLJyKOYLGeEliu7t/T/GRb805VVr6xH37ErzkbvZadYZgft4J2/swFg3/w1e1m5L2c89jCqOF3smRjupGmUkvpORWN1FT3slxMe9JTa0EElzkm1IyMbJFEbGQ/wCGoXUY/dP9bCy7kCmcJYGKzGCyCQRve0tLSY+IzOUuHADsrE1CNZYGMB+CceX7Z48QI6ik2SosrI423/1yFAjAHwflasPX3wqw+r6J2DblpEOJaBlfXg0JSJEIx4/vaf77z1MhrmoGRnj5N4mcQUUdHJlaFlCMhBnoMDLl3zeI2JiX1qJKIhY2hQVKgCT0eafKzwL2CmYvv/GRk7QUSR2nvhU7Q9Kvxswxg5Jz7GiVX1bnRQUdHrUmueU5uZfk6hl1ht4rsvHugZGR8e7+07gxq6ZMqFE4qq3WKi8zZ78yXBpDz68Hy44OKfv6NYFRrsxfiEzRPEpPl4z4pte96D+UA2FyqBMWMciKLp/IOvIngC3vT6++f+egUGTJmDEKOUBb0kFbSVwT5Pv0hH8IYnqVjCK1PlgEUrfI408ggGg8MWN/9hLHUNGgHowiELek408iosPeslnAnjDQAQOgc9NIcL1BWTKgeV2fJUyrfRyLceHR9MxsOJBAY2xk729nfzKqEFS9bEmgsxW1SV28nI+EHO48nHKChc+PgTBE5nAuAGGNALD1z75o22qjb0sJvkYqx5pNk6RdM6CTMZKUWrqnrtz99egQf6QvGrVIDXZ25Sts25yP3SSoSAK5/bYRUL5lsr+XFbCvU3kE4jmBP89t98m4gESIOQ1JLpgsKMlWZBz20PRK8eHGT7BfAfMV3sIt8iMiVGrdwACHibjl8AAdBnh0g5NaSXxWK3oMuCPEgy1hdrslJTJvelUi6G5T5DixjHo7taFjPBeMaAew6+BoGpNr4FZV6jyaRO0Mn4L/EvDWg2UepNQnVbVctvYECMvmhCLMweWKiz9ejzSOEWvvikG0KBorbvgo4bgddlAw1OhEot3/ibzd+AwA+OIGREa9UreopixDmUNYWsE5rYBoie6FPoHpk84I42hy3DTWmSj7CYyenRQgVB1OTOeniIlXe37jpz9T//s+9Y+3ZMELbKVBSVKJvHT256fP7ipUvmP/+Iu02fGd7UfAKxZuDjczewLZmsB27dPbxFsRpzdFu2QlHjMJrqO0eGx8FKN0qbfnY2YGeDSIwGSZIK8h/O/QwS8CXkgAbYy8AJBSGWkA8Uit3F9TVfXPlm89mhoSEQfW0+ZwzddB5fZLR5jnPl1NHCZKAzTYFoNNXUi/S3Uiw2EKkgm7HpKUA8GbZjh7R4nNEEEYsY09gbHoB4c31730Q6SQLm6M/oPdPAjheEhBI5gIl/8sWlS5cu3vCMW1bnWaPhPAUepudjdL0jee6EZEn8wrF6nsuSrViFVAcaQ8NAMhyLX2+m6T/bTziDPjsKItVYh5IqEaUaEpnZ8wsX0A6ISp9Aqvsc0+yClyqClBPTgwEhfFSv/Pabb9Zv7hrqGhry+JucJ4bHxoeHJ0Yu8pmwY85FpYbrCYiHJA81FFtNhH4bBM20IMQBqRh03c3mSHJw9MTExElLIoDqJDK+3u72Yeg+OEg0g+mxx06A3CvnYJoiGdEgcJn5D7PSml6iJxv0eMyx4V9TSzffG3dZ7M74SGPhYAVijR8KQxamNtnPZoBfRUXJHB8DUmrIwJFE6GcPfGbl4gULVj5VY2DhuqLyfTLBlTbYB5rL/3YI9iMHHAoc6uv/orXG7a6p71bYEaKbMzOBozETTKEE64XNQ4KKnZQrl6Iii7ZB9I1a/BMHLjbUKDUNu3YeQgwasAejJ5KYdcEEd5jQic0ba0oh5BJJkg6LrAhJAhxkwYJlz/KMroFcvzMNA0b6KHJA729TKgbrN423wPXgPmovIHUdjaZrgYkHYUAjKvL7PscgA2QiqGkS7SSjr0pzojc9vwzPDwcUCbJVq0RsTp3CGXJLndnSxHd8883mzZv3IzUOTDRnAx2UYCp5g8rOeGBuBgRzFttSKNyjWItIxgQRRTGnjr1gG2APoCSM9RlE2zKnuE1sIxtIOqCrY476SAOHGkOI4Ws3exxBZ/q4lR0ICtECrTVvrFywYPHCp3Yw0iTAhKN+S8ATOUpRlJXvaEq7fL5ALc4HmSB/rkhNeerHErWYphv0jzZAdgzl0BMeuyN9oRU8GdzbrEQyFbL3PrRg6YJlj9czL9Jrs0wlRyFktX+ssytkv81dUAyIDXeD0yMTAZQVDtmDTLMFVDMOLvIDqBjaaEY5tJXApUKyA9RCrKQRT6A1tkdtwC08qQ5G58BEEez9nPsAFq5FnXSbitIGiP6qGJ0zCO2RS7PoVSkuQjD42PzFi5c+9o46dAuMGzScxyDtZyX4xn30GgZcQN2NRGXYJHWWykDrA8OEbcHwBdZrhzsxkghZnJ8DjRGVjM6gmp9vemo+0p0Nr+YkG2e6JM79U6zfzZvP3gt4zT4HJosxQrukBdV/PBcDIr33l/kCIeLeUjomESIJRqmRmkfxphpBr7Tb2CgkdDQjKUFrvQgN6aN+TO+g6SER53DfmfaO9lN9l5LpIEFH6M0VqY3DTckx/4tlyImX/cJNKnUyqf9hoTto3iFXSfP7xiNBuBrUTlkwIzEIqnU0il016OhroGCQmHHghKBDaRdTakWLF0cMCkzjcDMHnP94tyqFOa0BM4J+/G9V+3323+Dq2RNjm6xM3a3AgHPoE4FeDj8WDgUC0Qm2keuxesE6Rv2K57sxnrZ/1/FkLWhPwDKrCVkAvAAvlcAI5PvigDIc6Whve3ZIa2v/RDgYoPLjAd5qoLoiehBQKXlwwdKlzz8BrX1q0R0II4pMbaG+zWIol/HdIwlou8XvNuqzukZWvj+esgRCaajWykzUG/S1cK3XR20CxQysYjsdvPGJp3AEL9jwrKpifR8PRA/klc3r8d+3R4586cGOBJpcNaksaFGRuZCLkJChkZJkMBBMEjbI3I9UYzuugkmeTkfNaFy1Qym6WshoZguSDIUHU3HjXcwabBptx/ZjrKZcBMFcY1+ERKzMgziPTGKxSEHSE4/Pp0jmSTQOU9bdmzWgiLZdA5NWiLkcbLMrUrUXSUTbBbm3MTZGABsjAikyoD3azqqaJHRNCRBnUvauwRGPMHMGiC2vmQXK9Tdb4YC/OldS90nEHrCxt1DEVUp6kZv7hGtQb6nHAvsYiJ9UpFcI9BSrK2vOXIfsaZROWF8QndInGigNzeQJOsa2wuq7O5gaIeFUVqvF2qYK8oEouOf2yK1uKDqp3AD+jZVL5y9e+YZC5AaZPNAbG6SuO6bEiDt4IOlyJK+3qp3VrEni6GWMs/5cHfqNmI6qof5aH3mgrGT1eotkwAiPr1o8f8HKN5gktzCdAdUSDt7XppfJAc/+9+51FUc+jiHmCo/XW7Os3LkZsEgNYbafxIx3H9JBWWLsLAUfacv4ZeoLx2Wh7M2GqCOXP5GMJKcGJS0Xt5gU4hnjyKaec4EOiQNJn8PhajrAt2WLE0++OH/+0mVP7YB+GF6vL2xD1yGyT0MuCr3QNHi5RyW8kPy0SWkebYJGalbjAx5uHfDXmtlJg9ZHHV4OG3WRVXln1bKl8+e/+Gg2ipwC8vI5xa2OzbQDfnsEJQS0OaAXsZb2Ga0C3uyln9QW8KOQww/GhluoOqJXbdp5AWOjU2xmvA/CaDAgsWEzSa5eyqhkMESLhlrCZyXWVEO9XbJ7JI7BZZG73ZVqUCYiWV22dKkaSxOhPoyYnVThDRksA2PSb10gCWAhc7bi4Om4OzqCqN5AoQpo10rj9XTQY8EccNLPwQ2DAXECAUhdNn/pyl/UsLKaBuWdTJqAAX9DR8jZ/66j+gEa52rRKXKCWu4KgPbZ1oUhSmrddAm6TEEAtkZOnSKAMkw6jcFtLnQw+P3JZCRmTlzYnpe3EFRsmrkhNajL2jId3IffN5h2OqLQMJVV4qqy6SnwFBY/9ku6RSLfnobaamS8RdVJ0NEYU6W7uZ6BCYhAseMRF7O+td5tLVZrbnC7jiZIEEZHW7JELhjZZHQ//RhKwfNffFKRpxl6lq15Y4oxfqj7ZTLgxB1WgKk78nHZva57icMkrZ4fkDZrchEwOiQGNPnYObhdracSNfpUwu5yOlzReGrs8IGjx/vGR0f783fTwGc4rOoHkSbX6kjsPo5wENpM1YwhVGwF3gQDojhC3QsgjkAKz+xUxRTU3QxlHhprSiOujTQbHORL5NFWREGVNF4DKd+YP5hyxXvVLVClExuNNS+tWbhw6QbACETL0+vFyeNW2UOLTMRPeJpO4G8+O6I26O++8+X+2lqvBdQBwoAzn2C25CKsOpFGeQctBJYDcRSqMLeX73CU1drswWTq8L5N7HkbtzQoGvY3A7oKypyFBkTkPQhWOpskw4s4mo38sxsWgenxLMQ+afb1QMRssRPT3MiqgVTlgXhYoQeJJCaGhLLYwKqFnX4K2Zv6WZrNRLphdWSJYJDDAd1W6qsQhcJ50zlNIkSOlfyz38CAtIKphlpasvtTb21ZKIzgM2NAbg6yJ8AzrBhK43QBxupkmsECZF8bDoEHbgvFx7coQhvpogGK5kVl+okw0wUNsg5NG3ZzYqJ9F+kHEhYLXBUGfMltgLFIfQ2tOrZEbz0pTjPpTCqANG7f1X/g+M7Dh3ce6LzY0MLqQeSUNLZ+1yGPF4n39cYMuYD9ssIBqRLy1Caria2eKqFQij8v9Y7A6PeUxZ29U1rBOr9KcY50QS8UsVOlTrOGZqedBX1MAFWXUylz8lajCX3QxC7jBxIh9ExH+4wkpInN2kCMX17UTtvOVzmniAsTKUpWehO2gBf8EAeGXJJW9tMETAOxw0sUyXz9rQQxX8PD+7KS5a1o2B69gB4GgGURjKdzXLjV85eLjWoKpnQfS3lQLQwl0WQoa/i4QPKBRL+yl3h+iEf0Gr6qhi7MU1KPiQbfsCCwFA5I1cB1cMGQnehyRl5L8Z0tIo0zEUPjXfHDBPWy5ppdqRCA7sRORZYNyCUQ9IlE4DFIk6ZBTyNrnd25rfzhiA3JC3BnZyTu6r3INzw/H4jT45sgeVKMA7EzWYvv2SKpgf5duzpOXR07EW1KQiiFJJpYT34AwzHjjone4/3Qoz5wKQ7cAqNwx6jbNks54OSa51YuBZL/+I4aUZSmEUfNuapOh4rZT7MGVCcsrKv7xNtlr8UxYtUO9p61ARkg57OQaj8apEXqikbAGoqNVHNqyUkhhJd+qUNNOH4SvXK6uRIksAAPtJOGtD3kjaT+zyOPI45Z+fAT7szm3ucPkVByOt6UBBYbDieYKDT1QoEX4WMNUS67ByNiw2EMa/VTOBq0IHOQJcY0Uem4ezegGQBsIuhPoA2cqsECP2lzySR3OpN1x7+RAb89l5kUWlFRgjXcVRvrrVFrk5kgd/Yz1lsvhe1B56EGhMNsX264kAT06+ygdip9Tlp/uh2PmzreSVWzFChxDQVU+WhsdjDh8L8/hHDt4UeUSoYs8Y0jcSewdFYj8PkIBfM4SWgVggYxTLnF9FZ8V1VSxl1wOaM4teN/YS1euuxLPfLwkv9YsmDl71FKchezIRSqevK0G7O7hiEx5IFsTiNimTuQYqoNjHUbuDkP5pOR6O86CSlm7Oeoy6KijSy+yZEKJsfzlUFOy2LNzYLl+JmU1Vlv+r5RfziZhgcFbFAfCdkiQxuWzl+JjJUo5IIi67p74mkXRi74mLya3RukBjyoJUJL3hmFNk7EacdaRo8PCbD5XC5H/BCVsFhnnI4Rc2t+sew/Fi2aDxq2qWAjzk94zgpTstbPmp99s379+l+dq1uXaWlHs01Z7b2hsW4GeyrSXPQDSYyvP4r5WAlKu0CABdZ0+HLK4br8/9HNVkFuhS9UWs7/JUcNmKKJCwC5Z+TwgWNXMeQSJCifx+fsehGk/Ud4pvqFLLat5syheAQK+0Sc8pZ5wuH0ybGe4ySK39F59GrvhBM68qoHlgHVijdhFm414zyzsKQY1NUNwKEfBAxjyiQh+TnLnLbaz75AgfUpZkCEMesyamEQA7t3b6jXKsuajpPZz5W7GkNxL0VBbWUxKMTukctI4ZoQ1OinhATTLOQpHaqZ+lcGBoakx6nrfg+aZc2xsz9HdZiVagl3ovb9A9fjTTGfByLknnv/eWZXc72mDti4vePAiA+Fq4DHFounxzvcJmBPRUwbF8eqCTj04kVLwBqpmX5ua+EgeESV/EtkwM2f7S6vUA1Y93Xo3v57gT4WvuU+2OyUi1DVNY2hWuQF1ML6HlFhudQEveJrF0nhampOrg2b9TOhRzqyIElNymy8ZuPRQxGfJWAPrF9KBiRlRZzuRTTYubH9+Mk0zY0M1B4nmUrZqAryVlNgaO0YB5sD3cmx8QP7kC+bKkH+IJ6GQv705Ib5ixYsWoo2ABMDmzVkfa5wZCg7R8Q2/tnN68kF32K5MGKZ3R/BAe9Ry7D2Q85S9gT010sx0uRqUXnFbqV+Ig4A6xq0/EWDMoUOyFaGoA5WF2YYqSxktnlUlYgahyh6y/UkGJW2rleeIgNW6Vmui6oBiXJ3XIi6sIa9ftdA/76W3JM0Xjww7GcC6MEklQdkK1K3IoOhmAJ65IpPvgg225LFL76qzmrnNHAAl+NQ5/+VZiP+kuwHOPUcLFhRAj03OOD+rpPNGYvPSYARN3rfIQSoCaSYDBUr5q3DcYxUvrYL049I+0GnzvrkZlrC04/XQYqYGXYGaMDawl8cBRXB1rX/qU0CFXEkatFlDbPQme4YjGIJoOISiZwc7j187OiZo8cO9w6noMgfBOZguTzSAu+j7BGkNAbjo9Lw6gZQERYt2vCGm/uOUQ15ceHGlzdvJRf89mvSmDz3We09GDDZx8tzHU76jw9Y3d07U/TRbPc6Cegl2TRkxggbIHBFMwfZndRld0GDZmncR5Ke4TV4Ij1c2M1ohYROhIjJ8NMakvRQCPJhQ7JZ20jHaALj7M1QYIhFwklgP/gfcWGwDGJ7rqi/B/FBZkAkOmJNSJGtO156ZRk6uh5c9twOjfDlpOB50hvFiNPfkQGRzdV+9Nlnn34cukc7IPYuUdHyb2dlQKVh+DKG26I+7gkfVymGkG5tCrqCTSO0tU5uyDBMR4+euQjGslDcAETg1l5YMBRG0IpksVjKkDj0VIABdjuWQFEOvBwKly1MNN5MEaG91uYf7XcbjcQWVOMBCHeA4PzUcnCJAMJgR+CU7/TAjKqGzP9282oy4Ob91FO8n+zXhcqcbND86KyYCf/4403DTS6oISBetZGWjcxeBiJ1QZcH4l4iU6HIpMBgTMpZziVxanWZ6Vu6zDifIkHL3+fYTYWLZab9yUT999rDw4h51XOdge8iE1OW+ZYDo03hmJNZz0zzaBgFxx5IpnvRhECjl1mtjmMtZzv2Pr+GJBDmr3n8EY3BGK2Q4ycvktycCtzJ7Ve2Uk1k81l2kUZi4g+KtVgvZYRYdbM24NUmFNWQA6D+GrKD/84kbRuvJ2w+GyGNUq7fQt0nRMqLVR1mvSBpprHqdLlNstAhlGJVUgWY/SGMD4ig7qzuOGhzl1QAk8yLASGHrw/6k9EoNHxQq7B5wcAJJx1jHQzDkNDxzutRMkZBwP3kUxtQX8EF+ykmPSP7qkojuYEMXGELlZIdUO/+N7hg1oD3zu4POABYgiqh6JmP6ulvszqF0TaZSqXSqUNOaF/V0nxWnvDi4+jHQBEONT8rdmyJTXrlWw8Pn3KzZDOr8pPbOejOK6yew+nULzhVo5mJAbLHcUr9cAKzDyMdfHVW7lhlt2eGz0l8S8fxgYkU+vOiJIKaOnm3BygOk+CiITbqdD9+xzvPbSAAkHqhXtpUjLnWSjYUwP8gBxu0SsA67e0kUeDffrN6K7bBb0jQdyjW1ftF/t3wWeWI2ZzCp0DHSCWHdzUfc3nsISbIRAvqv3Aum+0W5ykckqRqDVwTvVL+RHwn6Q4zkT0U8yXFoGpd0YjqIkVl2+oEdQ0pisqM4Zm8EB0jyggNFfFTmww6JEnSoiin0kHnDbVN1rdu6eg/c/Tomf72i9sb3RRLSqrKO8WMvPuRvc89tHDRAgAwS1e++OoOq5GyTxoLqhqQns6k6CQhSy7SaTxQ0RFD4sp6CFNvfeHls/vPjl3tqCcsVZ9Vc+ZV4anZGPD/wV7jdG3hrQqwk5D30H+xFgwTfyweAncT43ubFb6YyAmNR09itq0NZSCOBJCLFeTMUCnKCCGjjETwgI7mmnOZwSdSnnlI8jBudCclAbXEek7tIgFdat8Rlex2pafQEbiptWD9WyEWLBUjbWaCC/WPvvrcwzAfst9FCx5a8/DT0JTDcWQoEqRc72jjF9utGacTNP1nGQJ8Ecq3v/sGEgzrn9r0aPOj3ZWqRNrk83A2S/gwcJDocHdLo/tUGKDTSXUTlLjq3rANOSp6NQc6tzds7z98KB7FkHmI2gy08kzSqFjVDadRtAaZJjFhtnoRU0QElspOhmwTB5xQh5PEWj8cIaQqFoke6sGMYUhbVjEOMUPTERyipI4iG+HTEKIhlBooJN0l1qyy4+lnnnpo5cqFTAhm0ZJlzz+zCYONuWJcBhbVs5Xzy5e3rv9dPafMEGFhHDf/BRQYVq/GeBLINVQbDerYCb2g0TETZueBIFaNXkR3+UDYFWQhEZuwzjcOx6C3a3E5m5Kp0Qv+pqgLJQz0xoQiJ860kths/cVjPf1WOAcEizCkWSHBc8TkpzC2Ayg2JygZHSRFYv1ESqXSeiJtBrM8FCrz+Af7mvn64mwBQ6FmR4VOfFhEzIJRCqnKFCs1O5745d43Hn8IbZhADhaQnMCyn7/0KPZGrliFFdgUiCI2whRNrFB6EyfNrmbzOah0icRn07+RDs3mP7iJlpVRnsmpLzI+7ayWcCeG5rmiE/27rqadrqBzuEVgo2Yhdf2HiA16zC7XSTDX8C0amkU4MZQPExMjfTv7hlP+ZBxFaVk0Krt6xw9sIjwYE1VTl3buU/hKlSRAKxma/0S8s2KMFE4qGz1JMORKHurP9VFI1BKtMEYisyDsImRyxZpH9z7z3MOPoXN2weJF6P9cunTBEjKfGwGCpOZrxUXMfMR7+dlWakn8jTaIyXCu6WxjI5yNyjPkgtCScpv0+kkhKy/M2oDNh5yoXvrjaTAkLUHIORozFejthzDcDhJZdh8s5zKnUkF7zBmjjhSbHapZkUjYaXH9/+29+1dV9do3PPa9x76f+36eMeYck7UW6wQOlxMFXSCKCiInkQQWcVIEEUlQBCULRA2BFAXUJFMhECmT0LTw0I0lpRYjNc3aHvLQvd2Vba1de9t4f3j+hvdzXd8515qLg22o9x33D829KzOEta71PVyHzyHzm2oV0h4bvv8g+QOiQa7MnJ8zMy5y8uYtbpKHToWTNfMaLNyTLXiNCH8zp8ZMCk6CwHTmW27ihVEWkkp48kAmD9KEONAkDj1Pe0dXdykLDkVFzeJnTmJhd3+9augcQOfHZmJ1j4JVG2Hd8vSSomof91QcEWaFHNjpznI7PdCwoFOwD3DjAK+3t8HVPXVseeDe5OigyUgdssMmB72Uu0EfeJW9MQ9i4GFpccG0+LKzJyNFO7vz46SZULCmkQWQCvhjmW9Uu6HM+NYH2WFJYFmAZUcyW2HhkbmH1qqsMWJiQgftI3OKvPO9yWH7j2dH4sPC2g5K/tjNXRTc0RoXAFJvZky5rBUY/HpqTrf0JjJlO540iPCPORkZ0NGpQWZjIJNg3kVLEMVJEVnfkIu9F+MhKhA2/FOpCqR5Wbq7j6SQ4PMnSwbspZH2NJap3J9cbyTDhTCMAByTSd6ZWBoqwVFzQqJz5h3cFhYaF5eWmRz5/aGdBbK6DpBlYgQggIhqWOTBPPh2QNp4cnZQGERn878P/RvUGENiQuJyoeHrtLOElI5SBmJ8y56VK7fsPZSZmwNP9hjUjg4iYEN8y2z1yS46XIHuptau7sKoRXjQsKKlF5W4LKO3q/NSpapi+KEY+mpYs850p7v1BCk1gtj+9JLLvgAieFzsMCoxgIhkdhsyGWE27uIfaJF1w0lFto6jnZX/RnL4zDCS9V66153ntIIqhCldJqC1OWkg4NWeJHe49Sc35MmoQWGz/FpyEuYY0MKFlTACaMcW3rs0OCyGoNXy4PeAgERPR1cA9zfI7i6nhbaQdkjrPY88eJhOIjh6EtlZWK0BdABZfN07tb6jCskykpW5EEB6AcHLyCit6j9dQ41TQNGc/lRbQGXlmgdI70giipQQOr0BtBKUjsh3TP4KcBLrKV0GWZ347/pOx/lokYVspImz6TF2pMsOvxn2UtLk44cgoWKie8kJRwQQMkKCj9Ua/E6cYP4D1CuvfHv92WP79+8H3YEC6HAD2zpvckjOvPtUj9VCB35ecAjaANNDk49toQmGarDudNoxMMaMvGB96FRSPyAt7UCrT/NH5fD1FUJtAeJbEF+D2FohxMM6WtubYLFidgSoOkFc/7YBLEb0Ed0MCCEHsM9wi5gJKqLiPOjoqAfMxuwMcChw26WFepr7sGi7WUn/m1e1wrymMc5EAtC5XLdzXUfjCIMAACAASURBVG26AiEmUpmSt3wfSp0lwCPtNmoQO8heB3Bf6O3Y01PQas+vzd+zHzVg5BvVBIlfeTwNfFGQKE3UYV63+aVIIM8xk4x7aS/lOVQD8MhCZatBVA5g6h4JjZkUFD1vGwAZwgUXrT64miEV6QDgfi5t29iExMTelvOn2ws87O/lcgo/ek0bU3RN7QFyXmvPsxBpxPoj5wyIU3T5+nvofanuyssdVYWJGd1Q4jEHQMdW/gkyKsueeuTh+TJGoYo11UoqP06xtsdqTqpxkuDwloqryo58LTM4PDqHsGeStw6iowY/xO5A9umAfVn1N5mooffnExrJc3ZeTM7824TOdea55bwtBz/JDAubGRwWPG99GROtEUIqWa26jBs6KuuBFw8KgiGDQ+jRsCuDmtfZnRH/AtcaczIKobxWyT8ccCMT7A7QyzcFsuBsCrWIiPkml3WuWoHAUXb8bE/rKUgSrWh023x9obz2jsajwL9FJUBKgevCALn2BGRUnj5xCQkjt5qslgpChNBfAZJlzPjAVBMVEsi9UkkfxA19i7DQ0Jy09arG2NUtkyEBK9jAKA8qIHoN+Cjw3mQYCgZESAjzS2w2OELJrjVnI+eD/hAyCSQchjdrxuN0RfFwnsQm4fcaAuYgIVYDeVvChK+xMJ6i98LcxNLu/ssUPZxaVrH96SKwp3BnQtU5XnkPT6yAUjeFb8WzW2uaOIDddXC5EDz8ps6WBhynCbHAoGe01Dn5N8USzFjyk5vV0ZG6Qwbyy8+vX7/++ZcEVRuPQbMGooPOs3oAgkXBYUkH8yySHj0rqQRjM7tsgW7VAtWNFKE9RAJsdhIkiJwUEoZGA7mE4JDDCKR672vQu59Kk4IyG1nSs1ajpPNOhC0BENC5t93UfwoUDmuVVRl07yJ8hS2na9wgmDhSCB0Ioy6TpgBY2VRTU19f315fX9NU19R59FnWEUMIn/3ofJ6z8ihSwY09TW63CWC5yua+qsIEkhxAAo6RdGOl2KNOlHyQYKB8h5vjpKL5475Nm0h04Mczqco4lYus9O7y5JNAloZmJx0TAitebr9JCNexBxLw+0Q1Qttz/rF7jA9+DeCuuDfLoRSITQowDQ652s1x0PmMyEne5XahyJUdTC1SNPUYQM1qYc8aEpxNwiBO1u0GefzoCyQ1k1jY3wxMHf4YJR7i56t5TZdPd/R1NVZ1d/fS013V2HiUVp8I34oH9aorr64IXthLemogO+aua23pjYJ0yCKSD6EAJlZVmvVm79Ylp06dglMTTgabxaTAenA5ifBNW73j4rkxrsBUUXNxsxeos/e/T8qG4hMNhfE7MLzQhMNk+56dawpklv3kSWX5a6EhUMGgLYhBcmY2TC7QPkxhc0HGOKV/jPwoYnoYPDvSGXlmsoBzwzdoIA4Dl/tQJpLyOJrE2Ox23ta1R4kPBtk/Nx1GQJXik6AuaNOl0+dbqnoLEwsLC0lYkZSNoxIhnKOtvo0bd19yY4Rq9+ymAJ6od+e526nvtYif2KjEwoSEOaSmYNP8Njs3IoAbV3mI9CKZYFlGfg8TyLh7x8Uz4yMbkqQzFBOOxYWhrQ6sb7qkmDWJCNmCKu2NT3I/+XSNMENy0DYA6eVlGHKAJgBoQ2b25Ozc2+VWQp4FkGsFVpx6cnI4OjqhuUQH0ghEPFDnPjQmL4DQRcw/u/7FNQWqUABz95UWZlS11hHQgFY/rpW6pmbUcwhcwlyW/8BamkUbMiFjCa8+pCMbex7Xwk0ENuUueD/Ajf1UvbuysxDKNbG8AKO6G8+3RCVAEAoTVUnwkmogIHCKPQ6QeMABGLLIiycuYOfuHV/9aexbWAjPOmyug/PQRp0M0yOYTvHJaOU+R0rBq8khQdPjCCBvYlw09ujxmYCzpB3Mq0h3FNwGIDps6VuEvNAVVdnCFt3G4Nxj5UKZgXjvQi9WIvLdziS0K2C6tDT39lsbSNvRZKo7/VMHZOtctN9xXHlqWvuqSpdloBKm2OFvWKEcvqinN4rEeeOKnoflRMdDEwLii10UwI/aK/tLE2Lj8admIRHqvFTt6Z8TGxXFeh6sXuBUH9ASRDWCNMhkubhg8TNTLly9fpMCufrimC8RHSkJRFpmDDZd8hvVdgg+kRwiNe5pJrk3MiZoOtCNb6gOWWRiIJ/GhaEZlvmxG5PdIx8ETQ5OAovNrjXRkZdYQZVZmo18e6kXOkHTOUhH4zanIVPodPSCQlAVhqYdv19AwmpODEHRZ7Hgug2Uq1v7qwoLo+JBdk+YRUJIL8zloiRjWWHCUxQ+VLTPnuiohlAo+VkHWpGCIYBwc77cXxpLja85GQ04TfF6PF1zsHQbK0XL2pRqV1s/QgA/2u2BRp587irgvs9cP1dx7voFBHDfl+PZwmLFLEWvJSYJaHzq9ULQzCz6aWRGG00ItJmvFfg0N/OPJU2fPjk7eZsnL6X6NjwaspMPuVMcuqi6WU7Jc22OREIdpJFlvLA0mGeaSfk+LBywDWIZ50xK+3SLzDgQEscEv87T3tedQfpRvPJoJ6KZ1VvV2NLV1dXXtYTjt+TZE+erZb0rBuS1Xf2JA1hVCurcrITS7vPoe9EY2tMSvyghqqXOjPYQxPtTK9w1PdjDp3ra6UAkBbRnYGsHc659sFne98UYAZbofSIbQke+dn84KPCT+MxC0moSwwKYBtjcFEC8UwqgpjcOIDVQcIha9gfb3Hnyzk8wXQnKPEImH0LrDv4hLmf5m7loLsC9B+8CJZMoSEATM2FsUIuBFkaX0QSGjcnJzSVtaByf9CV5WENPY/ALISKKXkJhYW8V6rlLNdV5njpP/dEVtPxWPPsAHRW7TWDEiCBud3dxRyuDb93S/nq3yhmuXNcIFE1Ul4eFrh0WqFx4HuAeXnaqlXL6Dy8Ab7n4Q9TyX+4DaGasAVQoBUOl5lJ3QVs3ZNK8I2TfKbPFm0WXnnorE/3pydG5Z10mDXwcYLar65cS1zUbEc/L24x7ZHoExlAQfzezsSh2KpmQAFwVcXyPzGrxfiaY7sPff/LJ999HJtPHNj1nMgwk01NoAuhq7u9FB5Uml1hIqEh6uzqaa1gMWlKc7sqeZ7luW9HpAabbC2tDy8IptvDTdM9EHe2sQwJlIzVnU1NVQuzcxD5WZ3JgBaaCM4A9XHrqMdkFfrlv9cQJqz87I6f+eGHi6tX7PhwjPpDRGykuOKVAcDYnbXMKEkINamPR9+PKY/PQv0ri7Ebk3QEB6YH5x3Oz0XDNPIAPb8NxTH2jIwgDblJtlK9Q0mzybJ4/aSaVNTgFraneIt8cEIgNt3Lt+xv2vL3+WNp06njnvrdHzpMw9u3qnTMXuLUoyt1KGxr7mptcmoodY68f/PMpWn+oxFz2FE6P9FGmSX6wZNlTTy+D+N6shFZI+Dq53EP7oBfnQGIHA1RgRJia6lDre06Vlp56BJ1kKfXm8sVQjrv52cV9i4E8vzlWjDRJDQHS/P4nANiGROynDFoiexazxWBZ+f43aKnuPylLurqJIyUPXJrsYLS9MlGPEFlsUsT0SeHz9qLqYlZ1gBDuy4Y9QDCEaHgJUgPaxPc7MswU7fQtP3I8KRqQzsjbZbK7vj9xDhXD8bT2jjZ2XK4T80qruNwd6g8ruKNcVAMZb1JdlU2Bqt7Ykh+hRnt6WSwIKbFoXJug4sv07tO4VGILTzOwIRXT+VRHYN4jBLC0qJ728Fc7Fj/zzBTIPwLytnjHj38amxC3BUcSWOOebyKj4beFFp2T0Bpe9J+uMF+w7uROuHuZ9FYR7ti9yeBxhuTEvYbL10n8wRwgrKamrQfML51qEixkqznvm7SIYEIq2X34QiIkUY1jdxEHBJHdsj8XHfGYyCOVHd0Z7CCAcm5Zb39zk0clt2ofyM4Gozm6fntQeICkho+EGVPCOsfkJpnypzOE5F4VdKRpzm52qP2QpGC6PCtokrOJU378VGnp0RM/0B10Bu6oq4l7s2DBlAVXz40tgGz1i8PqSDLBeijjUBT9stT7vugBkJU54ANOk+RV1Fj70uSgmTgzPwVpleTm8nZhFAqMTdqxk2jvQxmNnFepaAa6FyQoMSoDSK/gThnxKZDTBohaEYICl95LigYh/t1GauJDR/6F+MKqzhqPO4W2oUnRYJLwzpBPc+8AKTDMX1S2kDTpTgJWS+VRkhnMoLsb3bCjXbhkA8xIiKoS0RuDnLCDAHImEvXCqlyCAJ7CCA9oqi+vbhKg6YmbdnwxdppDIObNG7Jz0UKY90a1PNSylXVwsO+oMahSWq2Bo8uPkUweyDhlMDi10NSobFdcDplmJCV/+lZtnr75N3wPzbX57xXouLNbWW0l+SL3kIRkUqoDEMHJQMS8u2LOC/FkIoBmQms1Ub1SUqFfI7M+AmlLKCZ11Qqkyiseo1WJTwC7xyISdHEE1pwioctukjujdLuw4bQbnoLypQaciqD4sGwN05zxui59VFragFsEa9gqf3lzxwUK4KarX8jK2CVA7a7KQ+S1FYrBut02RK1S0qBAiqZyw1KtxPiNJBUUwGmwHax8DMhl6yMhBDQ5ODtz6XuH3lq3YWV+fn7tujDM4KbDAcjBIqJlWW0z2gbsVq1RRlcNq/Zvmw8TwBVRL6B+QDXcWimrIsbWAFIgM5s1Ff5aKuA29lSDFCdZTJosJpNviSJ6iWQan+qo6WsopQBC+LGjjqSnIHgRm9HpdqQKJA3rcxQUnTp69NQjt8T768ur/71v34V9n5+zOMdqRoAeJc2FUAKHMd3VTMe9NhS0sFEYA6jI0Z2cV1SWoMKdkwvw2dR5pMquqIGqmAe5juRmYgIfjBlfZmbocXT+9x8nk9wgYtKmW7kPWJw1e0bxHW8bnzGcdEs9DxPFP2fAAWJZ9+lK1ZQi6JPCn8OG1DKQG1F9ZHj9bAcd1OiFmwU/HeegiZ1OO5fA6uKpViCQwK3FVbxoUWF/pVzTiD09q+Ey1afE+5RJLhVgSwTwRFElgWkdqfey2tp+bvu/OJ4tY97CuKWwzcANjrxdbfUhrmSzPJRbyG+IAgguyfpIHFpp0KgwsSuqWZM3Wns7OZcE0Il1BL4MSUSFAz4SQ3oc/McLZmTNmFF8RWYzEMG+Q+6sePrghPrunzMWzWnoq3G7U4Yyf7VqXW5YgfbBR7rKle8lQmUZpMmuJSj0TrXLLndlB21bNCASW5o6SMh1TktlSqpBJ12Sf0IAj/bgGk61uuQ7bVlZs9uuMd97zDLIIIaguRma+xIZcXOv1+ynayn7mbjjDrM6qI4LC5oJPrVTNVI3AYJ7a//SSPC0p7NKQHR0CAukRX9wmNQs8CXpA8UzSoqv6WRAXMMpAZiqdZX+mSB7ywpb2iHU7QzU3Em9PxSLjCYm5XB2eHrjKrdJs2MV4C/u8kvOwMqip2BWU9RE03Z0txOhwxwLKfVuJJQQlaEF6FXCw1t4SAE8wQ0Zu3y3bXbWbHyupnE42gRAYQnk3WC0112qajCnGqLay2Nnm3Y1rCX/9HmbVUlDdWohD8Toc+WRTz9JTgqLpgFyNGsFzJy39FCego4JvqN9MIsDqOokGAdqoPbGjEVLCDJ6ougx+tcqqzpa/FUAJXMgzGE/wtxo4098pVsMnzIGJIHgPSCJzniqSzXxcVnTlUEldCwBQqIKu2sqKixeNjEhkU6fQABRzKXTiXStbcbsGVm3xqxkjgBiLPvxvODwsNxP81WT9/QbJnvsheBI3Ps8QnIUuTuN3vEa2R8Iteo1B94kv03sYCKvhh7ftbNMNdmoMS2nUwCzrmnseioM8jzNDYko/d999/k3t94/sEZmxI8KJoRiPEUC6Aj84SNcIuhCGWV8wZrAAW012T0/ETbmKRoLm8gipO58KZKZBC6Ml3WgXU5yWvpugVwUB/A0dYrs8mDxbETw3jhWIO66lcDeAuiCTaZJxakjqV5YeAXyX1ghu1D6JqEf7zAH+EhCZsrAbS66PtNr1xw+sAsz+W1Hdr5fzd8EAykUIQUlFEA6A4XWHQhfp0tJfD92xcuHnrv/3HPP1RJ0wyKkVr1b2Cz6Ra3owzy1osPISwDNnwfjDnc9m1zoyA5yFD/dEMXtw4REyGc6TWYDIh4TLD2AwCykD+Bqyxooo9H6WAfrTvlk5iTYo9wGzkWWZFV9Iv/DIsT/PQex6eMAaCUhOutQSDy2pdjqNsntVvmesgqEdbp8q3g2XupdL6PSifjNIfhLadEDxO/+/ef2likO4RNqwI9TALHtsALRRuhQKxTf5hYOseCud9ECXNLi0aAfuFFVaMNT/GaVwl3MaVa8dHb63t4AoqN1rwSvCgfLOBQsUYMdgvHZJBqwSf4BNIC1JT8PaCDJ3kgLCp53yG13opQ3WGWYTJKAPuMQIogkvNfB1keTD1qWgP/ZbQUlCODsrHt6gxBHUSnh7RMSjzbnHaYVeP/AOrJyDRx6efGvLyGAS1Y8dlMAvWKrpI4LfdJW3C+4YVppcANQHaycHen4dKIohBnnPS4i9yiaqQ5kIdTLJ0r5DLQj1b6VhQ1MucHYz0DcbO+Fgzr+EsBAZr+zxbiTjbYN6MgT/hKKEgdRjzqJRWDYGgqwfZo8JxUwFihG4EpUCMSKJn3ZQNsM3HaD+jek+KFzDM550WW3mk87+LnnttVq5ZDZ73OjLGklrcAVu5kgHeB7fYrFFdhETknLllR54FHLJB4FPbp0Tyevwaij0AQQzp3CEhUBbKcVeELITl+hAM6+M54AAsmRiR5A3Bsu2Toyb3WIlCq5yCOA4dB/OAi0icQmiMO+zuxlZ9Cs4F4BdcGcBbcQP0oX7uC41Q6iQkLBJLADEgS8+BDctjedkcaEuvCSFsQaryYM1sZTTTRwskq+TAdc4AeE18j4qBnVfapCgECkPgpuqI5SGghENbS77SimbPrbsruxhRuomyBhQVzLKimZXXJPfK5jDeDh5OiImEhmOKjDrg9piBoVS/siDTwLa2bQ64TIoiwN2WzGixu9/8EZJdeuXLlyraS4Dft3Rts1iz2Aqi+n3N4NJAIo51X17nSAU9S3D9ASPLCFtwJkERW/FAAd06JnheE1WBGBkqRvEzTt6QZ+OuOpn9xO8qu28OwIRZ7J6aFWDPLAlkpJd4CUSA9ZbqYA9lyiiqZsYEbJjKzB9PEw1qmMwx0S9/YQxp3/1WFRvGBECwVwSxAEV9Cptz+Z4MeD9HSkCFlZxXhw09FZPVBGFXAgjlJodKP1t4gcfGATiTeV/9zHFMEjBexPY/xMOIAu+TxB01Y8wieHCb7XYl3xPKD4Pf1UEcEmgdOE2D4B2+nzUypb0ItBmtShsjGUxA44SKRbKYBoCOKn3Jk9YwbdIY5xSMGTAiDkeKEpZ9IgsT6PL11iR9spqpB9pY/s4PyciJzI/0s5lOoz3RumfoLDKUC+hxeHD5gehA+dBMxVSPfKBQu/xEWIXxQcuLjRA7j1mm2I3/1t64Sml3dZi5Eyrsv6j4B+WbLxB6iWmYTBCash/ESuS0/ToNchXHNYH0+QySCsQABh8kMgu0thXEP9LArgbupayFeKKYB3NV38sQZwfXLI9IiXeNcoQxzOJCHmavFBjhU1hRxHIqHCHYJ7h+FmoxE36cvxiu+J4IkIFrcNIn4YOAHVDOcbdJ7JQk1XYjC5q9/iTfxcuQwYnG+Goh0jEIF6BCDvUxt3Q+jJzPwI/shrT/H6A1bDqQwlQCq6CnNhSx46gYpAGCop8sMTDd1HH7hNtEd4b+Rrm3DsK3B6EGmeuFIUs+Z17BVGMBspKDi50UsGoG9NdmgOEIGbDboT0ghHIPO86OadTSsQyUtxcdvALRONNlIAK4V/CnCUc3G8i3oG5xUmHu+LJbiTcHNmm9eDSBFHMTLBJYRH2NiBvIUSJgogenunqI21osNtN1l9PHA+v0kT2M1zYtJWcDDo2EYfjvy4tLe7p5NqjztUhRQP2Em8eMzOhgyTCgqOBO3dFCjmDpJNh756z0BCZxHAOB0J2Mr1meRlPjV7D484fV4Ow+5wlUeOFMCSkpKBgcFrV+7ApISc3rCBPc1gTGNu2dBMMh6cf0NmzOHeSxE88Fw+0DF4o17iL/Nh6LZ4tJEAunTbShbVzOYCct2jJfgtYIUckN8UnDPhskPtHptThXwm4RogHYchJ5QH2QqSauHd5XQgXStGANuuML13HAHci15gNnr5LhIyMNMbUXTPbK+jCO4uoNvwq+o9L2YvnTw5fFIOydUqurim3z1CpD/9dNK2MIo3R1k6VdH2QELLQ9kCDmYQvUqA9K5DbFGGCKJfwHt4G81mlGGFuEq5NOFQNxblwa7OJAzXoB/zoGfVDyiLCG2q8kxCtdroXVhV9uRobuAxSUsTZYM00SLoZeejB7WYLiplqC6xP+4II5KxSj+RSd5kAhWg1kEASQ4T/8cna2IDWraa0DxY6mrXfXzotcgkDDiDcubtcll9brbM+tKMnkm514TTwIa3Y8Xs6VYxBfAW7gnydBaOmY48N0TDCDba70HvT/Snsb+AcXXvpCX43P1yuliGkrrhJgUFsaeegj8wpPoIdKB5PrvKy7isZBQwK+2LHhf+Tog8MtZBCEt/AkGMMHrY6fhoy1wAVKG6bKMrZCDdOnZ73D9SAMvfS4LSDSQS7DSb4SsXCQDSSzJ8olOP0638NdtuQyo6c3J0GBhgQZEHWSXabJAURAAt3u1LoCf2OHXYB+mKQ6NDNLopxbVhqt7MDmZQggp0idKFVzxZz6zkWwRdGe8d4gsgKYOCrIWm6gmgiwPFQJhFdajyVUSlBiqk8OAxB+iqMXJ5YwKhQ5a11HhcUoA4nNBcgFS20zHYVlJCdZxD6zSNqaWvAGwK5azQYEjUO6CIY+bkH85lplQTIcyZS1G+5a2Dx5dGxoVCUwhoDHRucj/OY9K5VfYlMBqvXpDboZyIT9oJmuyVNuoeDPhmP3QCeuBzA8f4xIZ2awVqBm8AqZKWd/ImPlI9wv2OPDhFBqVm44o+TQZXu8OQGXt5+xhM4/Njy4yAAD2GzUdjY0knr7HdQ0BfM2WomHoCl5SfhRbv7Bn5QuFgbOakWIEp2MOfQMg9LPdt+g5m/rE2M/APxEfAobfh7fVvwn1lJiuqgWGUHRr5we01bsTIpiiGUtmma7PL0t3BwVt2cXDZr2RR8YEcS2Qq+Iis6Hh5OpZRCYwmSXqqpOHhZBYSpcqFs+kDe2TTcDk2QlfJTY93d+ap9OUyT5OwkoDO1uXDVG3nO8TEVtRuJhklHbHcM7pP1wmvF6LgEMIbnzB28CCAogFssTs2/UALVFzrDmVmY0IUtkb2KiAF0Ohb9rw/Y9fZ7NC4cKB/JpF7SMyk6WlxL316GH6R0EO2eZMXyU+Y525bcVbWwN38ewX37g5Q82U2ddr4khB7h0yAgZuPX9ZVl0cWLaoP8sVt1p3bUBIfOOwc0orR5mkCYiNpfSzvFeM1BkSE97y4eddOl+YzznegBW7Hy9BUANASM78mYk/BfjyFYP4DaFDSJ2x3agPvMV0iSE/S5S0vARc0KTxpL3Yku5EzuaP28DeffJA8LwkYNHinQJQiAiOi/Yde3JIusx5RgE9AS7iDa2+HL7Ws4jYcfVltiB8twTtInil3AO0vkHqfXRnsQQ0wM+0yW6CqaeUIH8eV1BZ87sBKmeUsvAeDVydWogG/w2jqa2xjEGwsMi3ug10ep0PXSFORd9bxtRWPxkJid19zfaWHH3ntzzNml8woKSAFcGkcPBEkRi71QHJOCFAZ8zZvKdDanPnr1r+WjBsjmiT9oL4UBAm/ya9uW7ehjEAHZEuOA98vd/GOMPCR4lAuodR5NlVvqD5QJPEJyfkc2m/NpcAORS3rhOxkoJZ2GsxlLerJjymA62T29rFYfG0i3qiC6SAZ210GgQkcAa+Fgs2X88FeHddJN3JAigctfphmsOPnnMLulv7+Pnp2737ufknboOyUTGPXUMUZCLAjREdejcyZ+nJMTlroN9uOvL3z8IHNx5JA1ISRJSS4WYkk7NNdb+9J58Ebla1Qb5esXok5X7VP4GjuDWnlGxfpWVRkmizC+gpfouZ1AYEQC9lJpyAeKZrOAqp8E3+HDdzWQkuB+LJ0SXvVZHXXJvpTXDTpe1vXXURleziORlkxobfzZGOlZEfuXpXBigFzCXgOA99E9HITEnpX7b6/UhZFzDiUzHnTlB+cDzXWmcGhcdCMzs2dFzd/ZnQQ9BDDgnOhFAHk5NlqRkbbvZtCYhrkCFpuJvmOFkDevVlZg/kkV8/Tec0lu7mQelgA+wg5XsWbThJAnZoT6Ye5KfM+jSjIx8fgXq6d0iZpNA0lCdqjMWTaOnN/vuxTtSO6pktuOg/7SEJ+EdSa9vNc/mUpZzfj1FBV+eAs27UUjsJAoYImDMhtzCTS7gzKTF762qu5oTCq+uRttSzdaTN7Q6Yoo3YRyrCBsYVn4wQsLqH72G7S6G1ijcDsEMugsM+t90q9p5zE81F8Bls+xk287W01xTKaLcPIsmecx70Vl0NGcdOPeS2GyFZQUFHk9r7ejMT4WDFrmsW4dUSSGpJeoOZY1dtoKIRP563v582cjnk4eIaTpkI6EnbGyZ/u2rly5WsQHQ/KBPoRR1+gt24bXUBVtQ/iVJ597c6tu7fu3CMdYM1MTutIyJcbQGWN721nETg29RGfvP4tMbvjTGb3fTLPUbzqU35ydl72z9AHzcrMEIyk/4ZmB9quKhlcKex7T0JyJtndfr6qNKOQ4xfLLCbObjQNJHXMplQOMUfCtbDh4EuZIPKTaGwIjKWyj61fgzcARdrkIILaH0xxBGAyOVQjZATrBCcFEKNfDaxA28iid8cIlNKfET83NvEnt0lVDHKixgGq5DxM9dwNUPEUkySp8lgeE8yhwmfOTNtP81GhD8SHLL9SK32zyvaOQgE+YifzQoSQwFt0ekDuYezwRcw0fwAAIABJREFUNhrQ2JBRqhtefOO1T5IhnZ907OCLJL8Bq7d0dW0SKpCwyG/KUh0mg5qlMsTdVb8IJRPaLxRAifijhFMlqp1OUCULvQZ0sWYVXvK2wA0R1IQHoWy9/uPdu2+cdKN0VqyBqlHaXda6MyOqnjGMy/X2oTdf/Tjf0AsxOiETnLkjI4Fx/I3nWzt/ApQrKn4RbHWpBYJG4di2sEW8foUUw3F81a59e+/enVtq6cLFuWsC6ezFzMnhwdHMfpWGTj98AdRiQJiJ/KwZjB9yiH6ipPgCblbpxc+NAubHE+CV27J5m2HiKldJSWs3Avgcn2Jm25A9zKY7XqUmvxgRMQOnRHp+wbAjRhUO0uYA+BcchaAwBk2d1cRgbEfPP3bRrN6acRjz/UEWnRDNAsNApnc6+VqHAvsnSaFJ02mILtlG/tQNwzEzpzHF1HpG7qIJpwl2Ep/jEIKprEqMhw1wq2zy19KT9AVDmQyAcjd2b916431xzinDf6KiD6n9AmhjrSeFLTqGHpCqMHKGDn0diEzwWkQnkgbXLrWmhViJiecJk2NJGSs2xtcNBR5Q2Ck4HCYNhYjNdHBpNKTAvt8iCCLec0R7H17AGJUwJDvEQ2rUICjOTbp1NpuXcfygoMVtGGjRKmjsE/VLUn26nTab6AZAoHcdBxCjLlXDKEjG45cU0kZcgdoOEQMRg8efyLAUchq2q5eF0WIn7SkW9r/cO2tRLI0WHKp1HGeg7GNa8J5UVUNhCbe5kGCSiU83y1oqgi6leSiEiyMLbpPsvMsZdPGgw9+7XgMQknlA/Jz4ORDuRPpHf0BEx+rTT6NJKWC5N7YigA9gWkp5oNX4OjmA6nDhXr1Y5o9Bu9wM81iz1u9wqn0ZAjDoZD4WPlhP3xw6EVtx/pjH6e5qRL9QU1zzvYMvC/z4pse9WaCazLoHIFteK4qmiyYa1nLZlSu38gvu3QL4ioZv6O8KcyTNoZHglGgEO91NVXCSJxNMyQD44jECvhMgIDxPCzC5m+5TBJ9b6Z+rGAfUslkeoVfjr/JKr1LR46cR79Wmbli0kbOJSyfnIrNCaQlTHDvZdo+dse53WljYmVJ8WKQgA+b5JHZ/ZiypIYAkfaeoWv15b4DGvuhqFHMBpyEofV1CapPBLQAGSDDypj6qKCREeSdDsoAUE+RA1LrIW2zQIPOcRAB3UyIjexemseIeNYB+R7Pi017UA5giX14Wv2hRVBVqqxRNdErBwYzmBmTqHaaUcVH+haynhkJQyZ+SNBQJkXsW3lfhx1Yy1sKAT6RPlq1b+dS2AaCI4g2lm1b+YsjvfTPimuJy1+Ryd8B/Jh6NfFeA5M3bvrz5Y6rAeAmfHIUGQWs5gA9V0zDFVvxos0/Yc+QiRRuEagHUDhtWoEIasAwZNGUtVrY0xGqwy/1g5hUeRXGppKjjCqBCowxZW+9apcadJViSxqQdcur2DZqIDsl/KlZxxvE0Hh0Y6vvNFt2XayJ+Flp4pOykCVli7lvXtYy0T0+rVB5TOwdfce4mfMIr+BIhfzdCX4D7XYtLZPfWvWSz5JsPjpK8+DvESJoOkVh4ZpFLq5p+ASbq/U+jgitsllPc9QVUN1ZDnuH0ssLEqIxWGCWYxmePi5OP8aCK8aPGct9wfH70pLT1wIdKRoSghZWiDQEczCrh1hUwHG3ovvjOe/7v+jIASqAbHZDEQtorDu5jKebU65sWL95x/Qzg6mSqHkhXsy1ALr9PAbxPMAZlKEBRVkdfelqWo2hRNMveACLLAq3O6W55GrVwd70stx6FCLBcv7uoGSdLYSI8uPEKA8YXQFJy1eC9ivhp1EF2qTAVDonOPUBJsZUszw2Df8YFiNcl20QAgXQvGbxSoOsKG29K7axszoD+KQRIUFfbtJnG55ugVTBl08VzikNMHG3cbEEmiFtka+0IJbcY+Y7in2nAMiqKf6h5E6TkNS6LSijEKVzdGJ9xWlb7li1rqYMxDgJ4Hn84YLwGzUNkZRVi90JREQah0Zmb5YoAmmBLfPfS5FOgKuikJL4ssPdcvd3i7gHKX92aVvFdf7qRcnxi/LIOd56DBrZkfwWS8wTIPUDt4Rw4gII7ykXbSU5k3teGZT6JSVLwsZpHW4eGKbJ2YAo5dZaroQBaqqsogKCvt3e/MOcnuawlESyw+gaUxBl9PAkcdwD9eRnssAlZp9ywsHmvllWYUiVpSEkgieyAoAF3aK5AIHcanRM0z6J434PN6IzXnzhrzqwMOGyS6Sv68tYzF1dPmTJhAtQeLiCCJllHuILRzrfIWoMXlvIEAfUha28UVXBM21NFAGF1fKn3hTldanUjhoP1NQ1k7tc3LprDaK+IB9bVr0LiKSl7D0HDtINF4WQCi8/BM3gIGzpknv0CoCjMG6A6B1E7K7dBFC/fE8R4Ja8RKqgwUCHBI1I0r0j9bNOUadjCE/C/TRfPpJq0QRC5iPMKfMgIEQJMWLQcRpFHTV+k4aSCIS4tVslKAYylFVjfjfJNdnUlJjZWYgXOwRmoOuXfKIDaq4G6CVn2RRKLfUj/CtcXZF1AP4PsyS20nkuyBu2+ITvgASwCL5S9xXczk5c8+ukwulaE+mlF6ocXlk+bOA17eMKUaVM2fVbhkLQVixqIA/jYrXBlMVr7ZSwPo6MDKxuXxcdGwZbD89Oyo5dwlZSe6lTFGdjpdqny+PLAIZg2TWBOYpNfLEF2jDBgkrFpr127m049B/zrLerdM/Ref6FeeVlKKHW5J2iWtTcsAiK/z81urTZHRcX1dxbiIdEbrMEJOz4XfokMxC3XizlJGR5AvTjWALujehMN8UmAXrXD0wJKeyzdwk0PW92S6mntrMSYKyoR3laAzsjmXxNAHyVOmAynuMtfy80OBZIDJu6qcCNQaFndmYGEZeDuvYL0gjvXipm6MFDmEwIU71mYQJjISE6b+LaWLpobT9RxhS2EsQD1AOL/JDnyoRxgEaIWcjVdwkWPqn1uDYp/FCWjbYgkGTttQ6ItGXzmOA9cRHmg08tEoMsN0ka99TKh5n9FACWjaZxm8Qj0W+hMEsOTuJ8qqAIMa0fGnFUyUNJGPL0ZhBwfQlsi/XLw3twQPYQ0IEh2JrkTkNRZeO1CqtVR8Rk0q/CsXj1tGnu9Xbh4RtYFPvN2FyGABECzSKIitPjoX4aJkiQNHy9Yhu53ve8NeTm5c9ksal6x+J0qKgZPy5yEeLBxAl0p6pjPQPMIRaU+eUP7qfzTpGjYms0/UE4tK1ZypQAWC+BuFgcPOxjwOiePbXzmUCppl0JDTGZRbcD9UuTzFMBeCPdRwR2gfLiPwreQ2OILkcpMwFX8I7UdbWawhV0PKIBbYfjDJYtkbAx6YYlGE5MhvV7jzhUjFypycE1cLuVauCnQlOJUxdtp74XqWWKfh1wcx3wGjhBAXwOdnF9zicgfM//Nk+WMuiLcm3xvdpuO2mXsRvEVaUj2QAge+KjcHRi8ZUPdxoRed/8cbGEcP3xGmuTP3pmI+MHfiCyOkM1MWbx435ekBU5ll5sCuAqZdAr56vgHcNiSk0bzMzFDIjnA6WeZ1lQ1ZxE3r+yk1I9k1Cl3JGK+if6MSZLGeYkY/TINB7MNGCP5xcwYmtTNj3vv4M4yBy5KGy6X/AFs3dkigDgNb3EHWBlCbXIAewdc7y3gTmjpBtZ1zQEsAAMw1rOUz1xdPgGqcwtJroACyNpfnzEE3Yry5vGNratWbb1EXSfy+5C0lofoNvsmvvoLH6ksoVGz6vGQJjP2K6tVYi32ZcSS2Xaly0G6HzaHAn+/WMZqO2TJIY9LP9CHM/W+Hr4LyK/Xvpkw5TNDooMjP/gY7jJO0r1W0+8OMncBbawBVG8myWpcIbrpJhJEwk24SDs1ValsRADJGY1V6OQvNk2YMG3atAWrF6xmw18K4MSrWII2QsnKj4tEAAn0kyq6L4rNovjlzZLsM5Hz54Xxv5vNTvfl/v7T+IlwfmB5CmyfSw0MMur0QFwEmqZAzcBf7QUI8zikcRg0j7x39ajyOynbFTkVys8hICcdW+l2WSFTSZhVe/7dK9euXbkLFQ6bw2QaMYOgDLt4wOkiZLTDWlM1J3YRWsEydf+wgzdREUJLcPU0iiDu4SkTLnxuwTeDa5p8smjVqlVFWIEprAjFwwRTgL/jy+gZjP4qyAA7sZH0u9mcB7BZcG8I6lZ4tNNjc8FfqLIPWm/oz1zSIJ1jdTaUfMvda9gq+bxvcQ6aXXv3zyfmeXDm2XI3hMlMThVUPqvRx002CL/6OCY8YCoeCMAKxODUXdMNUUTk0UTUwg6+uZySv4lYhHSRwLIW/zZh9U3UxOSKrT6+wQFUGZRLM3Ft7CRZDMa8fifO0JvXDEDr+QzK3TO6+y5XujUyKYJK6vJzSrva6+oqL7cQais2o1/jpoxXQ9XrpTjCx4i+4McUQBZKJVlrmwYzc5CipaSz/hWNzOcbkzuoww9uIdQ8cXLCjRqYhEQUIkhJTGgjLMSaw9bFLsZlQp6/z0C76sIXFjuQt5L6mFbgViggADorKAtqzenOdrdJl9wcWgIPW32UxvdlgIxHOvKFjX2nL9c3VUKHtamfPIVA4uzt6ofLBmI5izwrtY9lrCb1BpidNzM1mhJROQttrCTSJ/++lnRSwZzWUPyS79O2KHoX1ncfUZcGZ+A1xICYQ94AWhlZ88UFKuFQB09b/N3XixdiL8PzdzUKulS2dcEtTAGsF2N0BrG2NyaCFotUwCYPT/6k4e70dKI1LyP/NBb1RqpM0quNVY3d4AdA2QzIhAw0EchfCN/WZB3XCvQjZUoGnJ6sU0PRf2bV3uBoaG/kmQJSrJLuSe7rf1gU7wHKWGM2z6QuDRQS7gJQb6IzUA8gkhp0CH7cgXuDq+Dt3/79ddQiz5Dr70TqKWAPp+Y9QgApkQ7gAGITw415VnwGlDxt/oSqUdYfT01B6G6AkUs8BRGIHEij88MsYkziiOqNYBYebXU79XrmD79iKjeyY7oFnMfb0JmdnPs+OSFqQ2S/qSITIRmaBWd0chXHq8c1M8BIN4yILSRSLdMZODcDvEkk0mrq9QV08VIra/t3cf/YLoqR1RMX7PsyFRlaavVWCuCjMl1LSZWbGuMXzV2Ucd7tNP8CydH70hXo5dV0rFqWQXpSc/mJXTR3riYlOgvwNtKIy1gFh+eA8fgL/8FwEPvlVX7KTzYoy2STe9XZvHTWQzN+oZcjy+/yLmi3aCrY0yEfb6WCDxSRQYItEy4X5BpagVVNqAoDlDMXl0/kNsyUCdu/TvsWAaQ1iKR604cWu9NuKec7hCbDVMfh1krx9BE5cVb3Jb76tFcxROTBYEMrgIQwAYCUfhesNWZpAYyFupvwiKAgkskGHF7S7U5p7DwRuoWH9ixG2gxA8meCzpS5HiqzlI5a+bP1tfa9X3gri4YiVwr4uxZcoxlxyexbRGmiNksg6JkUwBorbh/LuavLJ3LqMgEBDM/5r8XTOJeZOO2drxQ74AK1PQhgz2OX/uFAObm+CosG13g1XVwW7coaopLhd6mQ5F6AwwUNS5i7YCvDV2jOrEWkNI//YfcmZpR2d3XWeyTGumtdiz+N+Qw0+lcPuYVJMEtS4YwZCW2oSEIdO9hsXchiGPvq1Hum0Qgqk7bZg1eQIs4uJpZh1jWWaEK4rSmg7iKAvfW4ieypX15dSAGkNbj964ipX2/nFbj6mYnvfG6hAG7hAD706u0FwBH3dCG0aBcl9pOHgdVq0ZTW1aEEUy/WQlVJNcpEKZCcV9Pcef6nlpbGWH0vJx5taW2HyYYKtD7kamxW0cT50zjgbbI0yomiklEEAngyMiw0G4xEO0SFGJZi03tfuq2iwrJEWVwbQ4iqjSo9XMFEpDdpKI9AYFMRwMLL+BzQytq3cBpHcAoF8Pm/bMc1QpfIhHd+tNitFfJDDuBa/WWRraFa11WI9UNCYi6tZzWCLbNhgsIzG43ilIIX6vbUXf4pgeX6F80qbGmuk7lEYftLm218K/CXzmLyxiSGMAUQljcOUPw4afYiWSTJ27W/N2O2aC4wPB/bGd2aO4KTqLCxYF8iWYQ0gxmqB5Crj+3/iHglBnt44gSyTaYAmlI9jymART+wILBozUrUNoGtwCxoSLhdqtE/bpQ2v9nbkzFZ0b7Ng0I3u20ggHOqTkMW2SlOPgj1gOdpkcZ7iYwmeSDU9CmA6ziAB0jJnFagwi1RHS9P0BaJXNHuts0Q43UtjJAKvOOzl0HX4zwH8DQYfxTA5XzvIpVZ/I+Iv0V8vZ2yQjybPldgU1f5qAe38FbSGbPqZRKrpODanDWnoVlNsWozGmW08aaYpojqA9UTsI7tLaVo/M2aC4HHrhrx4sVwgWUyTOM7A71crVEXILq4eybzLeyxM15CE7cUu8Uh2hx4I/aSYuoNllCDgW6T4hnXCnysVWQU8umM2Pj4xA54EtIZuJxTZ7EC//byd9snTOGWzCZcIk515VYEkBrShIAz2/QTztNXOov0VUtbZa6/1dEMevXeuqLzb1zups4GdjWdBShbs1tH5yjMjDf7zH/HLMDoP/Qf8nLMdIs4ndVv5mZPDsrdouNySZDZRkpOd3DE2QNpQqnxCosH8m9dG8DZNzB4BToidtX3Bp3EsIExXH+dSUpJPXdz+TStEU0BxCGIpYh+zOJNX8jwr99yo6ioqOexx+GtbFhs013ZsiwWKqHxUKeUnKxIYCUpUN+tNqQlSOsU+z9F9jS3YPJGiPLEZf016G6ZxTGkCAtQSR53HugfwCEhhJsPko486AWGBefEbWadDswXiZMLJNgt8BnuOsknA9Pbu1lZGq/QUXbv3r0ymjlJ/ilSfS/ZmzVWKimBqcgD0QycOO2ZidNoCz//19cXUz9r8WISFbe7H/YUYQV2uu2kcWkVAGti/yKZRDaItmLh+SYW38NVG6jqZClRVtkYzo79KxGAR/zZ9v6GRJamnrOsobMukKS5CLkt6QN7qxehPc6xpj6HGTo+JEtFQvomhU2HhzPkxqm2I3seqNEVzICiSdvgHXgupedfE7ORgTIIOGMIQg6ZjqE9Lg+49/GzMLxxWkypnyGAE2kJIoDhr7zy9//ezi3VKVfPgfxb+QABLNp6CQLUtgCbnpbAbhNsma6oRbFI5TKqmuvgrozftqjeVyrOPBrGK3S0MJwDzbOa8xCnJn19VG1QeHSRaJrJMtQGm5tEYw+gohhhx8pQ6Q2+pWx5h+aDfZP25krSiWeTOwTwTjExCdFRHRwcyGrj64PgCawtT+wuNhujBUFKLioB0PsTF8EYHRMx/MZXOyiAiOBCBDDn+an/2E5X8uLVFytwWazcivjhCDSRH5yiL2S8Q6yZJkpmUNrCYbjeHQj9Dl0PgDr/nCFYNNdNJwIOVwj4rCWikkNLIaq0qtUTyP1dxSL5QTEZCKVYf8Vg3fKEgTQ5fMfEzJwUfnYPzjWXi3p0jtSykjbWgsliVR1Whbmi62/RK7KZGAZkSaWqQSUMCDJhBLCD+B9oZ1HqTLt48dfhMc9HaAHc8SOxVtb0rMIReBIlaoBBHo6VLTGwgzIgRTA+o6qzSbDU9e3jFZMxk1AB6TxUNvdXUSWMZ1FUYQdIXbB/M1skyQ8hbFg3v3ILj9yexo9bPx8OLDnzX3qxXEMhuSqU/JI2ETgezWG2eUX1IeRkHSGqa35xfxgq41GNHiKPVFxcPuEZqt8ogM8/T3kM7WHMhuGvglYMAvgDDQMM8DarQJ1K7tMNGAOBbzKntIosG4Txo5P/zk6u3KwMdLvr6jsayZMYuTPEqXu7IDDqJMcY4a49HEtDNqBjpHrJfmefMqws1mSQnRCOnh8SMTUkNHn/gYcbNmxZW6467fK9QR4L8wNmHGlo+s/42KhZr7CooYIkIoEpGSYCttFI5JmFi7+bH/N8+HcigDeBFASug8qQ3dU2py1wWLeZLIwvNy6bEyW8hnv7W2vytN+HpbMXoe9paj/d1bAskdtYCF9CV7NHHy0psu5Lb8ATakb3v/0W1nVTJ4fmQNY9LCky6fjxsNDba2VXnjv91kAxMdSxi0swW/KxmLQUgbDUiknLQ5CFAJ41l2ABdOB/eWE1luCCaQhg0qSX53+3fRrNRH60oBH2UCuEjTmMV4IlkM1I+0u5pngBY6rCqv7OZjSbPW7trqpsqm/u7GvszchgW1h8WXwiFW6o6/kTFeM9iwYD9kIO1XFw5UY+BlRfYa7f8xYAzsLSwMDGA9ugoLDkTwvUPLQHHfl3rw0ODl65VWYQnDQzBl3grgEepl6HxJzXTqjRxSb20fc2Wa4DmoUzcOHib5Ninp+PjhZqEexgpJfUTF11gywMcBs4YMonmYSeCF1ggYS2dtU1N2bMIZ8bkGSAFylsqGrs6u/r6Ojo6yfzr0J2r0rAvZswa25UIRduYvyg6lJfikheFNWHGv5VAXyS9qLKLLI932TCEXIyiZWjslu6RSYHb341dv9y0Gw2tls1jCN7ALQ3YA8DT8ZcmQ/3ianc9m/n5zzPLcEpq69XkBz1VqqDH7uw+XkLk9oMJUVifcNPwErGGE2nWyA/GMsupkDNac1msbNfEJYQ8QnEZi0lZfkRRarUEYCa40xjRrh7JX/QInhuBXtf+yCJvHThvx79AZJCrhPIkEFmbR5dzk82+7NgzFaKtCnFYatsmcNyiGRzaEq9vnAKEpmFi/8yPyYaAVy4cALMABxKwQPEr6poLSfK5sAAMKDSU4GMST1z5hyeMxWpDjAhgBupbIX5yCy20Y0VJl6wg/U+5MIEBeSGng4IdbgMRF1jw2b4UTXuFTjCbF8y1imEFJJXvvjpJ5mZSbA7I3HtdMk2GqhMlYcAgSTiDQMHlQg9xMJOOs0Z3wtDqAmv/3XmpOikb7cvX/jORV6APBF+pB2pMJ1KVSq+/OLzzy5evHnz6tWrN6+fg7xnACCeVqi+nyfrKrb94mfuC4YIxvY2rNq6bY3H4aPaj6AWqfoH8A+/CcByWFlJ9JEUV7pNLlh7+MVX4YpN/C+XL0SKoo1n1eHzbrNcdvfuPaI2YA+jmouKaqkk126H5fMdGGxOef2vEZMmJX27ePlyzEMAi91dVIUrZJ0wVwSwteLcV9f3bXrnnXeA5Zq2cPk7F86JmkNkI9XN51u6YWJPu5e2bzzdGbhcYrtXQVHiZ6SmvE+UX1IolscuOjEKPtCni2CccYLXkAKZ9vRAHF4b4DEA/0238QtNsua3pEr+tCEc+wVA0sxmCQPF04J+XizaUXao5UhnLj6zeMri1/8OYZqk7xYv3PFVKgCvD09U0UCznF8JTGu+/OzqjneocJ7G+Jkpy2+eEakzBtQ2bslUtsPMvhHmh/xgeNnS/2j3o/v3qaN2l933KEH0nUnSqP2b3wDaQQpCXqig5F/XWaF67EpPT68+BOx50PGVBt1Q8qPnh+qGslu3ynyvEo3CYmjIkMSmje/hObGl/R4cZBJ5oSxYvP2//w6ZiNDvtgPjW5Gu1tzQcxh+MTAOpegJHCFPAJZfFIh3jTNihQueqnrqKmvaL19uxnO5valyzRFWvsgiRR0GOije2bc0OlCdX/NvsIVH6rAqtMDQDrGi0K2Q38qNDolJO6xZNOBOdLAZt2hRygUDAGwVMLBcJRNDmq9nkbqSJBjrifBKqU8hLQr4Mu6buP0f4Qjg5K8vXD9TAXGS8z3UCdzNCxA39U0CYTIOEwGkCGL0LnN7QbGJ9IAOA3tKoOpzDro3+DNj736ecUemvpsFH71NViXj3GTYEaj/7m8UwKHIT0UWzqxmhsnuCZsOU+azBeyXaibVPPYqkgT340pxSQniJc4eZB/4d8zXr8hksiSR8F1CLMTt02lVSOgpYCiHAAZ//dkZbGD1EjUCxTQJH8sX+1CuTGD4zAKAkPBMnLDpKzmA0TiC+ArRPHiMkuIcyjfc107p1oxiqtFL0JsEk9ZKrWbFJ/U6jMrum0g5xo0PNMISdIzIKLkNF5F2yNCGTI2DDgAvAcrULET0BAYKOwvzTMieXLunyaAAzirm60Je7vJROCZjOswsRDMukqvfIoBTp++sqLA7XaKPVbS7RoUpHK1PAi9QAPEXxW/1tIU7vlBosIyBsYmLcqToAaSTb0X3As69Zdfafua5TDHrtZJskY5A8kJbRwbXi/8+3gBK/iN2WRohjvqXYEyXmfPyy9NZ8s1G3vaQK8M/rNRjM9GRhyUH3OCt/Pw7VwaKKZ7k4MBUclcl7GYSSLqSfwaE9r4AJTQm4hgEejC5fMjx61mrpiMWX1xYTbXKNC2EHMCJfFXjpyliXClekrDtI84FoJ9abX7NLrNjhFWSjNJH0nD6iAFXME501pDPRXKMfFnpqahVKTsbnjNz0vRP1sEej3IyPqZtWlKeztS5EurQoEamSV0J0XA4gNAQP014vCjGWeImdgZUv5o2KWbmG9VIt2XewEU9jzwuO8+dJkwTPJJp6FVj6kkRBHgGIsgQOEwlsyWx85i5aKM+890sXn6zf9Y4j5Ks+iF/hkdQn4Xqd/QYPZV8JO+hK3DU64WBsGuDpwL4G557OE924l62u5Anm3RqftmgECAjBTIWIZuN05z9uANsDhdaMvCdLuxUUwJtJFmwBy6lOfPXkzFC9aMiDuAlsqo7c/Gd1bz8gN/a/vo/vl4M8BvQrDs+T4WbMAwKqeMslH6pxeAkPdkC2r4//wxN2ZI7Qo7QqwknjZq96CwIWZO/++PYzAh8U0DvOpd8qLeR0IKCbvHWvJDwiKCkzENrRBfBZbf4ENJl17zDzRmMVaC3wyZyhNw/Xbpo1iJinEIbBPJ76z4JCo4hT0+H+pDagEU9D3nw+dWm5cuZhLN4+399/de//2PxlAkI4IKrH6baYeWeSp0pqHBAYbP5dOularIouUXbF/Gb3TZ4DxKhXutfg1CfNAqtzXAG/nGM0A5JGiG3nOesAAAOw0lEQVR/kUYC3/nOYoQD3rdADGYHZb706a69J99eV2BICgEnultSnCVQ6JivX7snJNjpsIJ4Rl4LLcGMfjcyODQVt2FgFb0U3qSihlvV86DO5cLY7uo7C5iGs/2/vvtrxF//i9uF0xbsuF5R4UBPnnh1AQEpan1/VTd5rnd66FND/CiEV4BBCeBxhP9CkIYnG76mMf/q14CLJAPvYshpoWfwBntRueBQZFhQdlBYaPLSD/Dc3uO1f2TPsntXBktwAoKLcyUfF7VNXw40H7ncANmqqKOXoZzttFfejoQTdvZKWf6B40cpICYGqZ+/s5wywGmvf53z/PN/eZ3ih8nxxAtfpFYgkUbLHhmpy9OKWS+1E6JKux7/LBZ92wDsIuwBPui55NtkI0CpJAOof+z6gQ5D/aaNoS3S6Lmhr+5AWVu9fiksgjFxh85g8PS44+u8ajeqxDpI+bfAIM5PZ6t2+t6MqwS8F1DJQjgmZ/RBexkWdS+FBgVFvqrKtVtXUQ3XQ4rQAY4zN4kGtnzxf/8l4pVX/vL6YsZxTVm86WJFKs+scAE5KiAuCxmseG7FFK66TwH8mdXmSe5bGQEvM9L+lQ13sDSOAPpOCs2D/Al1jndPgLhVkeLZ+x5kpaOjp8NjeVJORNJerDwbS1uiNnC6JB8whQa1VoGl4oHyJShjJ5T+hACmw0icCKFvyZd2U/yquIaDjfKXOAGXL1/89d9ffuVlPX7EZfpC5rSTfoIjpWkVpMM0E+xFvbup+Jh916baDSKDoxdvsvfkM7wxxzhu4SFng/Kk7oxPmkWi87922/64tJmTcqA4CJHVebvKkctRagEqJmzAURiQOauBbk4BVKmrdbqhsPDoDxghq9VvxmEV525o3yo28GO3yLfpCln++nfhz78y8y+vgwzLA5PFFz7j8oVZnbZ0NwrrQjAWenvpUF3UfR+0+QLCfNgU6ZcYEH48RNlQ5f1K4R19xKI++cfSYRZoSpfctXsPHQuNSwvJgc5vTtzZDehSU2ViY4KbSTKC9TSMAMvSuFu7ulrd9BmsyQwNDcs8dFmLH7qA0EFHnfbZpgULXv8W2xfxQ6d1gqC13zzHb1NBJwcWxXVdCGDh0fPtl7sSsAS7dw/cYnVkskWzKCNiLofDZwxvyjYeaMeQ6YfFT05smCiVD0NLlGrJCcdM18q16/buD8/BGsxJO34ynTDSVJ3i4HMI0KxAkupAdG3MCQVdlA4O967kyaFBuTceUQWyqghwLMpOTDKGnhNf//ZlxO/b1xcsZ0LntCnP0MxT0zyndVxThR0M6T+n2t6NUzDhwT22H9BAyKxVpVhGZ2p70xvtjSms9Pqr8IECLKY84cQwTPJZgcIhhFBrX00DHywiZmrcq++TjLmJKjv4JmA3WZj4jwWoy/EKTRUr8AcBZFOchBFV9okiEb9LLPjLRLoFr//l+XdfiaD1R+nfM4gfDkCH0NOj9kCKFsAOT1leEymwJZwXJGD+pBRWGVYUi/zLbVSj6dZYAvjHP/jdwQa6wqgjA2/ibpilkvewXLA5beqkiJdDQublvpivOirQxTSZbdpsU4hhp6bqIn4ECyBcZoDseCMzODQ89E1RgNwAMw4tCdiByeeuvv7tK39+93msPxTBCxdgFS7f9wVnDbrkqlrT0Qu0YGkX5pmXe9HiKTxvIP1p48onBHA4R5bf03jwgUPElRSD591IOajkRZfbrJLwLnIoeUeSwnNCZgaBk/jmXngxuJw2f6UXS6pV1c5C1S1A4qhnIqPD54dP7lkl4ocWAuOp0Ae8ivj9+RW6Pwj/AUrnOzc/THVoc2f0yFQgXgohIwtLkv7W01iKhQlHYXKmatYa3o3yr6xA7z/GgZFWnrTchq3xoYtT9cHgsBuPzYMhfXBQaGTyp4dpImQSUAxF0QxVBN+DUGVWkzCD3ZL78qSZM5Pe5fW3tR3xS9Fos/lfI37v/pXyF5ifL9+06cJn51Ir6FZSSZLB3U7SnbGkwxubUFhaiq2M+XoNdVo1AStlHCIV5jGq+P7xD7KuzqoIIS6Ra5hHSTb1eZsyzMAUJlokR70+NBKupEn4fzI7rYORqLJGlGJRNMMreByic5NKfQC0ns6Gx0ydGvE8XSA9D2oQv1SybDZBgfEHMmz+K0Hepi3HPGnf9Q9TKX7izM27hPBFkYws7t5YYQgem3DqtOriANoMPkbyiGIy4swymRS/CaJ5XAHUd60hdzE/4UPyYoYMAWSJIjOmxO41xz4IhcNQOMyb4149XCsJ7KUqhODZYpxzGTRhoB8g73mVsp+YiI+QvvSch1kK+V2bHCkpLrWgB/F75bvFm5Zv2nHh6vXPv6ywkJQ2+N44+gB5KUQtmIDUJRYE2kVioFnaD6sqk9Xqh3dR5eEAmCFXJtPZ+I2Zx4NQtWgQessT7g5piMWc6vPQNXy9klqRLpcfeCkydPr0meEhMeFp+9evK4MIIWY6sHehxrGuuQVTrzxIqryXhtwn5uU/Y4h+Y60bLO5AdyCxehHAR/9c8edXbnz1448/fvXFh+dSSeoaPp0u2d3U+tPWo0d7e1nGOLawqq+qkKqQ2KjS/iaU1gHgulsM8gOq+uRhpqRpJlp9AI+xXSIWk3dV+SKnDm3Zei9ni6IF0Gz2CyBp1Fkt6Ai75A3rs+eFoyyJgGNnXNybR1YGgu2Z7goMtHlxyKCCVajlB5Jzo6dPjZn6N6QvD1YiAUekVVYihtPoP1esePdEufeAZ2Md1d106fzuHgofBTC2sLCqo1yu76vCv3a3tKIHy51ds2boNcrBLhkZ9d7dzee0dfz4wH/pxOUVb+EszSdM6r1mgR5FbuJIVwP3HDgeF5GDEMKBJHze8c1vr/TIga50u8OkuYLTKbbz06Ww1Q6ZGvL8/1O09WGZ1guTAgiJ5KrreXfFn/8M51WJ8kmGFcjO8h/OPyrq6eluaGjo7UXv4Cjx0PFf3DWXfmhur0Rzkew2NH0gZai93C+9NY1TO15sjEB4WpQRsz6/ACpyqsXqZ+7LSR6NrQOJVAIUjKyufDEsMnxSTEgE1uH8yOTXDu7d4DF818Dak28sTQ6aPDk4JOLlE1h+OEClfNJ+o4Md5d3pZ59d8c+tnnQnDcTpQ3KuXPv40Q3GnXP8eksZMCSbfCroDibW4BS1KEMJOOwo6NXLHSYyY/EFUB27/J00RIj8yVWw6l2BI9iIC6FK1Gd4WyvfejMJVjgR4eHo9cUlZ7507MC6DfkF1QXlG9a8dTY7LhJXdWgoVPo/2r2WjKHvDJIGzYxrgC+A0NHzLHZwMwxLudVdvufhg603iPxK2WJDA2xti7qYpiUJbXKH5PBKFqkWq6rbJej3oXAgeeL7MpjL/+k3xMaMIAqkjAgG5hRH9f5BAokW7DwYHJkWQrYQ06PDwtPmzQs7dvbVs8fCIiPnR8TETJ8ZHBScdHzzQ+Tc1vRrWVk8Cc/CKChPPf/sko3/bJRd7rzy2vcfPn6OhPB2V1GvEA8sWR91tKOQ1kQbJNXoLSH5unHKyBKhv9ii+a3U20bEGCmjRXqIbBB8HiHL+P62/cnzQqeHBc2cHgKHj4jwtLS4tPCpZMwZMTV6elLm2ZP1Hihy269llXjdN+/K1T0rPvpoReeltQ8f39924waCh2cVuoWIYVHP7vPNTW6iUijKqAK+/obI/v046Zfi+NvoB/r9COlfyeKHorZ5W5W/ffulyMi0oOhJsJCNgEtJ2PSgmTgYoUOTlvTp3hqPCsA/Ixe4Gz+D2J53d9KKI2Ovbdt2+x4sQMzbH7fWuFV3iuAvmWRppKHsE0Cj0r/wXn4DcJGvFflLL8wwOvEbTlHHBLpRgHK59hw5eDwpbT6arnhiYNYTHTIpYv78/bt2gkgH4I/dXFAi1ONLGK0+4+efZ9wXZuH06PFDTB+cBLKdRFYCAwUQTDEG0Bgb8+hnkq5fbVFGPAl/VQClEc8L6YkrcNR5v5AmcaSnK3Je7boDr4alzU+DrUFSbua8ebnHNh+udZKAIzAN0G9k777B/HtCRh7D5Pv3fxbRe07EbuvW+yfX1BaQEDA4ChZVgJk1ffkh06+hAZTU4S/2SaXwr9jCkg//NYJ6whMASCMMHkhj1sKgcJxWBJDZsO7FzW/cxvPN5iNr83mAiFCkWiypTFKcPRsCoiQKJxjH9+lBBCHBeOPGc4/XXSp3Ca9WrRRHVUMZi47gl56A8/aCUr2+v7ZRKMYMJ/sV+EDJb/A3cvyUEQWihpvUo0VhZukTALdsWu6M95RXXS30g1B0WDWxDzsCCOP6gTInG5kKQTOOHiwi7+/duba2wM1GOYiZt+pXJBHA0U9pSfIVSZLkG2nrnhSjg/r+8FvewvIv3sIjvgVF8p4o2qdNQRQyU46KdLvO3lKZQIcAZhG1XRJOv5iL/zyj5PDOdWs3rCwgUVNFErWIr2Qg8WpVVU3yuJ8nlF5/Gie4yIDWlQyQiFGHSppKyEjSaeIW1mS69ZGz+HKnuDwlIx/lDpGdIKGXf4VITz8PwMwqv6BM0p1hnENobWIkJ6zSDYC84SD54Y8P3jYsgJJXPnjc6CzJqyQnDROAGoUOLj0hPTUKTBqUBYQCnd9TRg6c4DqB9wk8F/kgan9MIF6HL3THkE9MGjFb8EMmeCMnjZZZeP/DWFeg5INm+ZUekjwCvkjys5EykAaGvFHJm53palpG1PlQZsZdlgqgffwzcBllTErQf5LDNlJMJIPspyxJfvNC/3zZB1MZDXLmvTRl6TfRD/zXkmbpX1Vu/uU0HF90rU3XqWgrJisX6V/vo4xyiQzX5n5SRuGXCo2poSr927//+7+N/Pw7/pP24NfiX/gfI33lv/m+WP8zft/Z90v+dkO/Mv1aWxurYbZl3fp3v+8rvo/vZfh9K+/fh34//XeGvk7xAv7N74uN35F+Kf3/sQJ/++fOFRAWB6/dLfgX1/b/h88YVuB//Of/+c//Mc//xvM/4XX8n//8j38xgL8/v/r5X//xP+j5X3j+h7yS31fG78/vz+/P78/vz+/P78/vz+/P789v9Py/GLPoyUO0POsAAAAASUVORK5CYII=';

const PALETA = ['#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308'];

const ESTILO_DIBUJO = { color: '#facc15', weight: 3, fillColor: '#facc15', fillOpacity: 0.2 };

/* ---------- Utilidades ---------- */
const $ = (id) => document.getElementById(id);

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function uid() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function cargar(clave, porDefecto) {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    alert('No se pudo guardar en el navegador (¿almacenamiento bloqueado?).');
    return false;
  }
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mostrarError(el, mensaje) {
  el.textContent = mensaje;
  el.classList.remove('hidden');
}

function ocultarError(el) {
  el.classList.add('hidden');
  el.textContent = '';
}

function colorFinca(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

// Área de un polígono [[lat, lng], ...] en hectáreas (aprox. esférica)
function areaHectareas(anillo) {
  if (!anillo || anillo.length < 3) return 0;
  const R = 6378137;
  const rad = (g) => (g * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < anillo.length; i++) {
    const [lat1, lng1] = anillo[i];
    const [lat2, lng2] = anillo[(i + 1) % anillo.length];
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * R * R) / 2) / 10000;
}

function textoHectareas(f) {
  return f.hectareas !== '' && f.hectareas != null ? `${f.hectareas} ha` : 'Superficie no indicada';
}

/* ---------- Lotes ---------- */
// Los lotes se comparan sin distinguir mayúsculas ni espacios sobrantes
const normLote = (s) => String(s ?? '').trim().toLowerCase();

function lotesConocidos() {
  const unicos = new Map();
  [...vacas, ...fincas].forEach((x) => {
    const nombre = String(x.lote ?? '').trim();
    const clave = normLote(nombre);
    if (clave && !unicos.has(clave)) unicos.set(clave, nombre);
  });
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function vacasDeLote(lote) {
  const clave = normLote(lote);
  return clave ? vacas.filter((v) => normLote(v.lote) === clave) : [];
}

function fincasDeLote(lote) {
  const clave = normLote(lote);
  return clave ? fincas.filter((f) => normLote(f.lote) === clave) : [];
}

/* ---------- Validaciones compartidas (formulario de animal y ficha) ---------- */
// Identificadores comparados sin distinguir mayúsculas ni espacios sobrantes (igual que el índice único de schema.sql)
const normId = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Un lote pertenece a una sola finca: el animal de un lote solo puede estar en la finca de ese lote
function validarUbicacion(lote, fincaId) {
  const l = String(lote ?? '').trim();
  if (fincaId && !fincas.some((f) => f.id === fincaId)) return 'La finca seleccionada ya no existe.';
  if (!l) return '';
  const propietarias = fincasDeLote(l);
  if (!propietarias.length) {
    return `El lote «${l}» no está asignado a ninguna finca. Asígnalo primero a una finca en «Fincas y mapa».`;
  }
  if (!propietarias.some((f) => f.id === fincaId)) {
    const destino = nombreFinca(fincaId);
    return `No se puede guardar: el lote «${l}» pertenece a la finca «${propietarias[0].nombre}»` +
      (destino ? ` y el animal está asignado a «${destino}».` : ' y el animal no tiene finca asignada.') +
      ' Un animal de un lote solo puede estar en la finca de ese lote.';
  }
  return '';
}

// Fecha de un movimiento: obligatoria, no futura, posterior al nacimiento y a su último movimiento registrado
function validarFechaMovimiento(animal, fecha, nacimiento) {
  if (!fecha) return 'Indica la fecha del movimiento de finca / lote.';
  if (fecha > hoyISO()) return 'La fecha del movimiento no puede ser futura.';
  if (nacimiento && fecha < nacimiento) return 'El movimiento no puede ser anterior al nacimiento del animal.';
  const ultimo = animal ? movimientosOrdenados(animal)[0] : null;
  if (ultimo && ultimo.fecha && fecha < ultimo.fecha) {
    return `El movimiento no puede ser anterior al último registrado (${formatearFecha(ultimo.fecha)}).`;
  }
  return '';
}

// Campos básicos del animal (longitudes alineadas con schema.sql, unicidad, fechas y coherencia con su historial)
function validarCamposAnimal(d, idEdicion) {
  if (!d.crotal) return `El campo «${vocab().crotal}» es obligatorio.`;
  if (d.crotal.length > 40) return 'La identificación no puede superar los 40 caracteres.';
  if (d.nombre.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  if (d.raza.length > 80) return 'La raza no puede superar los 80 caracteres.';
  if (d.lote.length > 80) return 'El lote no puede superar los 80 caracteres.';
  if (vacas.some((x) => x.id !== idEdicion && normId(x.crotal) === normId(d.crotal))) {
    return 'Ya existe otro animal con esa identificación.';
  }
  if (d.nacimiento && d.nacimiento > hoyISO()) return 'La fecha de nacimiento no puede ser futura.';
  if (!SEXOS[d.sexo]) return 'Indica el sexo del animal.';
  if (!estadosDe(d.especie, d.sexo).includes(d.estado)) return `El estado «${d.estado}» no corresponde a ${d.sexo === 'M' ? 'un macho' : 'una hembra'} de esta especie.`;
  const previa = idEdicion ? vacaPorId(idEdicion) : null;
  if (previa && d.nacimiento) {
    const trat = (previa.tratamientos || []).find((t) => t.fecha && t.fecha < d.nacimiento);
    if (trat) return `No se puede fijar ese nacimiento: el tratamiento «${trat.tipo}» (${formatearFecha(trat.fecha)}) es anterior.`;
    const mov = (previa.movimientos || []).find((m) => m.fecha && m.fecha < d.nacimiento);
    if (mov) return `No se puede fijar ese nacimiento: hay un movimiento (${formatearFecha(mov.fecha)}) anterior.`;
  }
  return '';
}

/* ---------- Genealogía ----------
   Cada vaca guarda solo su madre (madreId). Las crías de una vaca se calculan
   a partir de ahí, de modo que el vínculo madre <-> cría es siempre coherente. */
// Crías, machos y animales de engorde no pueden figurar como madre (depende de la especie)
function noPuedeSerMadre(a) { return sexoDe(a) === 'M' || ESPECIES[especieDe(a)].noMadre.includes(a.estado); }
// Pueden ser padre los machos que no sean crías ni de cebo (p. ej. un toro semental)
function esMachoReproductor(a) { return sexoDe(a) === 'M' && !ESPECIES[especieDe(a)].noPadre.includes(a.estado); }
const PADRE_EXTERNO = '__externo__'; // valor del selector «Padre» para inseminación o macho ajeno a la explotación
const especieForm = () => $('vaca-especie').value || especiesCuenta()[0];
const ROTULOS_MATERNOS = ['Madre', 'Abuela materna', 'Bisabuela materna', 'Tatarabuela materna'];
const MAX_GENERACIONES = 12; // profundidad máxima de la línea materna que se muestra en la ficha
const rotuloMaterno = (i) => ROTULOS_MATERNOS[i] || `Ascendiente materna (${i + 1}.ª generación)`;

function vacaPorId(id) {
  return id ? vacas.find((v) => v.id === id) || null : null;
}

function criasDe(id) {
  return id ? vacas.filter((v) => v.madreId === id) : [];
}

// Busca también entre los animales dados de baja (para mantener la línea materna completa)
function vacaAnyPorId(id) {
  return vacaPorId(id) || (id ? bajas.find((b) => b.id === id) || null : null);
}

// Crías de una vaca, activas y ya dadas de baja
function criasFicha(id) {
  if (!id) return [];
  const maternas = [...criasDe(id), ...bajas.filter((b) => b.madreId === id)];
  const paternas = hijosDePadre(id).filter((h) => !maternas.includes(h));
  return [...maternas, ...paternas];
}

// Hijos de un macho (activos y de baja), a partir del padreId de cada animal
function hijosDePadre(id) {
  return id ? [...vacas, ...bajas].filter((a) => a.padreId === id) : [];
}

// Texto del padre de un animal: el macho registrado, el padre externo o vacío
function textoPadre(a) {
  const p = vacaAnyPorId(a && a.padreId);
  if (p) return etiquetaVaca(p);
  return (a && a.padreExterno) || '';
}

// Nº total de descendientes (activos y de baja) con protección frente a ciclos
function totalDescendientes(id, vistos = new Set([id])) {
  let n = 0;
  criasFicha(id).forEach((c) => {
    if (vistos.has(c.id)) return;
    vistos.add(c.id);
    n += 1 + totalDescendientes(c.id, vistos);
  });
  return n;
}

function etiquetaVaca(v) {
  return v ? `${v.crotal}${v.nombre ? ' · ' + v.nombre : ''}` : '';
}

// Madre, abuela, bisabuela… (con protección frente a ciclos)
function ascendencia(id, max = MAX_GENERACIONES) {
  const cadena = [];
  const vistos = new Set([id]);
  let actual = vacaAnyPorId((vacaAnyPorId(id) || {}).madreId);
  while (actual && cadena.length < max && !vistos.has(actual.id)) {
    cadena.push(actual);
    vistos.add(actual.id);
    actual = vacaAnyPorId(actual.madreId);
  }
  return cadena;
}

// ¿Es ancestroId un ascendiente de candidatoId (por madre o por padre), o el propio animal?
// Recorre las dos líneas con protección frente a ciclos.
function esDescendienteDe(candidatoId, ancestroId) {
  const vistos = new Set();
  const pendientes = [candidatoId];
  while (pendientes.length) {
    const actual = vacaAnyPorId(pendientes.pop());
    if (!actual || vistos.has(actual.id)) continue;
    if (actual.id === ancestroId) return true;
    vistos.add(actual.id);
    if (actual.madreId) pendientes.push(actual.madreId);
    if (actual.padreId) pendientes.push(actual.padreId);
  }
  return false;
}

function edadTexto(iso) {
  if (!iso) return '';
  const nac = new Date(iso + 'T00:00:00');
  if (isNaN(nac)) return '';
  const hoy = new Date();
  let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + hoy.getMonth() - nac.getMonth();
  if (hoy.getDate() < nac.getDate()) meses--;
  if (meses < 0) return '';
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  if (a) return `${a} ${a === 1 ? 'año' : 'años'}${m ? ` y ${m} m` : ''}`;
  return `${m} ${m === 1 ? 'mes' : 'meses'}`;
}

// Madres posibles para la vaca del formulario
function candidatasMadre(actual) {
  const nac = $('vaca-nacimiento').value;
  return vacas
    .filter((m) => {
      if (m.id === actual) return true; // conserva la selección vigente
      if (editVacaId && esDescendienteDe(m.id, editVacaId)) return false; // ni ella misma ni sus descendientes
      if (especieDe(m) !== especieForm()) return false; // la madre es de la misma especie
      if (noPuedeSerMadre(m)) return false; // solo hembras adultas
      if (nac && m.nacimiento && m.nacimiento >= nac) return false; // debe ser mayor que la cría
      return true;
    })
    .sort((a, b) => a.crotal.localeCompare(b.crotal, 'es'));
}

function renderSelectMadre(valor) {
  const actual = valor !== undefined ? valor : $('vaca-madre').value;
  const lista = candidatasMadre(actual);
  $('vaca-madre').innerHTML =
    '<option value="">Sin madre registrada (compra externa / desconocida)</option>' +
    lista
      .map((m) => `<option value="${esc(m.id)}">${esc(etiquetaVaca(m))}${m.raza ? ' (' + esc(m.raza) + ')' : ''}</option>`)
      .join('');
  $('vaca-madre').value = lista.some((m) => m.id === actual) ? actual : '';
  actualizarHintMadre();
}

function actualizarHintMadre() {
  const m = vacaPorId($('vaca-madre').value);
  const el = $('vaca-madre-hint');
  if (!m) {
    el.textContent = 'Déjalo vacío si es una compra externa o la madre es desconocida.';
    return;
  }
  const otras = criasDe(m.id).filter((c) => c.id !== editVacaId);
  el.textContent =
    `Se añadirá a las crías de ${etiquetaVaca(m)}` +
    (otras.length ? ` (ya tiene ${otras.length}: ${otras.map(etiquetaVaca).join(', ')}).` : ' (aún sin crías registradas).');
}

// Padres posibles para el animal del formulario: machos reproductores de la misma especie y mayores que la cría.
// Incluye los dados de baja (un toro vendido o sacrificado puede ser padre de animales actuales).
function candidatosPadre(actual) {
  const nac = $('vaca-nacimiento').value;
  return [...vacas, ...bajas]
    .filter((p) => {
      if (p.id === actual) return true; // conserva la selección vigente
      if (editVacaId && esDescendienteDe(p.id, editVacaId)) return false;
      if (especieDe(p) !== especieForm()) return false;
      if (!esMachoReproductor(p)) return false;
      if (nac && p.nacimiento && p.nacimiento >= nac) return false;
      return true;
    })
    .sort((a, b) => (!!a.baja - !!b.baja) || a.crotal.localeCompare(b.crotal, 'es'));
}

function renderSelectPadre(valor, externo) {
  const sel = $('vaca-padre');
  let actual = valor !== undefined ? valor : sel.value;
  if (externo !== undefined) $('vaca-padre-externo').value = externo || '';
  if (!actual && $('vaca-padre-externo').value.trim()) actual = PADRE_EXTERNO;
  const lista = candidatosPadre(actual);
  sel.innerHTML =
    '<option value="">Sin padre registrado / desconocido</option>' +
    `<option value="${PADRE_EXTERNO}">Externo (inseminación o macho de fuera)…</option>` +
    lista
      .map((p) => `<option value="${esc(p.id)}">${esc(etiquetaVaca(p))}${p.raza ? ' (' + esc(p.raza) + ')' : ''}${p.baja ? ' · baja' : ''}</option>`)
      .join('');
  sel.value = actual === PADRE_EXTERNO || lista.some((p) => p.id === actual) ? actual : '';
  actualizarHintPadre();
}

function actualizarHintPadre() {
  const valor = $('vaca-padre').value;
  $('vaca-padre-externo-wrap').classList.toggle('hidden', valor !== PADRE_EXTERNO);
  const el = $('vaca-padre-hint');
  if (valor === PADRE_EXTERNO) {
    el.textContent = 'Indica la pajuela, el nombre del semental o la ganadería de origen.';
    return;
  }
  const p = vacaAnyPorId(valor);
  if (!p) {
    el.textContent = `Aparecen los machos de la misma especie (no las crías ni los de cebo: ${ESPECIES[especieForm()].noPadre.join(', ').toLowerCase()}). Si no es tuyo, elige «Externo».`;
    return;
  }
  const hijos = hijosDePadre(p.id).filter((h) => h.id !== editVacaId).length;
  el.textContent = `${etiquetaVaca(p)}: ${hijos ? `ya tiene ${hijos} ${hijos === 1 ? 'hijo/a registrado/a' : 'hijos registrados'}` : 'aún sin hijos registrados'}.`;
}

function renderCriasForm() {
  const cont = $('vaca-crias');
  if (!editVacaId) {
    cont.innerHTML =
      '<p class="text-sm text-stone-500">Aquí aparecerán las crías del animal que edites. ' +
      'Para registrar una cría, da de alta al animal joven y elige a su madre en el campo «Madre».</p>';
    return;
  }
  const crias = criasDe(editVacaId);
  cont.innerHTML = crias.length
    ? '<div class="flex flex-wrap gap-2">' +
      crias
        .map((c) => `<button type="button" data-action="ver-ficha" data-id="${esc(c.id)}"
            class="rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs px-3 py-1">
            ${esc(etiquetaVaca(c))} <span class="text-emerald-700">· ${esc(c.estado)}</span></button>`)
        .join('') +
      '</div>'
    : '<p class="text-sm text-stone-500">Este animal aún no tiene crías registradas. ' +
      'Se añadirán solas cuando selecciones a este animal como «Madre» de otro.</p>';
}

function celdaMadre(v) {
  const m = vacaAnyPorId(v.madreId);
  return m
    ? `<button data-action="ver-ficha" data-id="${esc(m.id)}" class="text-green-700 hover:underline">${esc(etiquetaVaca(m))}</button>${m.baja ? ' <span class="text-xs text-stone-500">(baja)</span>' : ''}`
    : '<span class="text-stone-400">—</span>';
}

function celdaCrias(v) {
  const c = criasDe(v.id);
  if (!c.length) return '<span class="text-stone-400">—</span>';
  return `<button data-action="ver-ficha" data-id="${esc(v.id)}" title="${esc(c.map(etiquetaVaca).join(', '))}"
    class="inline-block rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2 py-0.5 text-xs">${c.length} ${c.length === 1 ? 'cría' : 'crías'}</button>`;
}

let avisoVacaTimer = null;
function mostrarAvisoVaca(texto) {
  const el = $('vaca-aviso');
  el.textContent = texto;
  el.classList.remove('hidden');
  clearTimeout(avisoVacaTimer);
  avisoVacaTimer = setTimeout(ocultarAvisoVaca, 8000);
}
function ocultarAvisoVaca() {
  $('vaca-aviso').classList.add('hidden');
}

/* ---------- Sanidad: tratamientos y vacunas ----------
   Se guardan dentro de cada vaca: vaca.tratamientos = [{ id, fecha, tipo, veterinario, observaciones, creado }] */
// Tratamientos habituales según las especies de la cuenta
const tiposBaseCuenta = () => especiesCuenta().flatMap((e) => ESPECIES[e].tratamientos);

function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Más recientes primero; a igual fecha, el último registrado va antes
function tratamientosDe(v) {
  return [...(v.tratamientos || [])].sort(
    (a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0)
  );
}

// Sugerencias: tipos habituales + los que ya has usado
function tiposTratamiento() {
  const unicos = new Map();
  [...tiposBaseCuenta(), ...vacas.flatMap((v) => (v.tratamientos || []).map((t) => t.tipo))].forEach((t) => {
    const nombre = String(t || '').trim();
    const clave = nombre.toLowerCase();
    if (clave && !unicos.has(clave)) unicos.set(clave, nombre);
  });
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

const esVacuna = (t) => /^vacun/i.test(String(t.tipo || '').trim());

// Último tratamiento ya realizado (los de fecha futura son «programados»)
function ultimoTratamiento(v) {
  const hoy = hoyISO();
  return tratamientosDe(v).find((t) => t.fecha <= hoy) || null;
}

function celdaSanidad(v) {
  const t = tratamientosDe(v);
  if (!t.length) return '<span class="text-stone-400">—</span>';
  const ult = ultimoTratamiento(v);
  const prog = t.filter((x) => x.fecha > hoyISO()).length;
  return `<button data-action="ver-ficha" data-id="${esc(v.id)}" title="${ult ? 'Último: ' + esc(ult.tipo) : 'Solo tratamientos programados'}"
    class="text-xs text-stone-700 hover:underline whitespace-nowrap">${t.length}${ult ? ' · último ' + formatearFecha(ult.fecha) : ''}${prog ? ` · 📅 ${prog} prog.` : ''}${retiradaDe(v).carne ? ' · <span class="text-red-700" title="En tiempo de espera de medicamentos">🚫 retirada</span>' : ''}</button>`;
}

function renderTratamientos() {
  const v = vacaAnyPorId(fichaActualId);
  const soloLectura = !!(v && v.baja);
  const lista = v ? tratamientosDe(v) : [];
  const vacunas = lista.filter(esVacuna).length;
  const otros = lista.length - vacunas;
  const hoy = hoyISO();
  $('trat-titulo').textContent =
    `💉 Sanidad: ${vacunas} ${vacunas === 1 ? 'vacuna' : 'vacunas'} · ${otros} ${otros === 1 ? 'tratamiento' : 'tratamientos'}`;
  $('trat-lista').innerHTML = lista.length
    ? '<ul class="divide-y">' +
      lista
        .map((t) => {
          const prog = t.fecha > hoy;
          return `
          <li class="py-2 flex items-start justify-between gap-3 text-sm">
            <div>
              <p><span class="font-mono text-stone-600">${formatearFecha(t.fecha)}</span> · <span class="font-medium">${esc(t.tipo)}</span>
                <span class="inline-block rounded-full ${esVacuna(t) ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'} px-2 py-0.5 text-xs ml-1">${esVacuna(t) ? 'Vacuna' : 'Tratamiento'}</span>
                ${prog ? `<span class="inline-block rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs ml-1">📅 Programado · en ${diasHasta(t.fecha)} ${diasHasta(t.fecha) === 1 ? 'día' : 'días'}</span>` : ''}</p>
              ${t.veterinario ? `<p class="text-xs text-stone-500">🩺 ${esc(t.veterinario)}</p>` : ''}
              ${t.creadoPor && t.creadoPor !== idExplotacion()
                ? `<p class="text-xs text-sky-700">Registrado por ${t.creadoPor === usuarioActual.id ? 'ti' : esc(nombreVinculo(t.creadoPor) || 'el veterinario')}</p>` : ''}
              ${t.observaciones ? `<p class="text-xs text-stone-600 mt-0.5">${esc(t.observaciones)}</p>` : ''}
              ${t.retiradaCarne > 0 || t.retiradaLeche > 0 ? `<p class="text-xs text-red-700 mt-0.5">⏳ Retirada:
                ${t.retiradaCarne > 0 ? `carne ${t.retiradaCarne} días (hasta ${formatearFecha(sumarDias(t.fecha, t.retiradaCarne))})` : ''}
                ${t.retiradaCarne > 0 && t.retiradaLeche > 0 ? ' · ' : ''}
                ${t.retiradaLeche > 0 ? `leche ${t.retiradaLeche} días (hasta ${formatearFecha(sumarDias(t.fecha, t.retiradaLeche))})` : ''}</p>` : ''}
            </div>
            ${soloLectura || !puedeBorrarTrat(t) ? '' : `<button type="button" data-action="del-trat" data-id="${esc(t.id)}"
              class="text-red-600 hover:text-red-800 hover:underline text-xs whitespace-nowrap">Eliminar</button>`}
          </li>`;
        })
        .join('') +
      '</ul>'
    : '<p class="text-sm text-stone-500">Sin tratamientos registrados.</p>';
  $('tratamientos-list').innerHTML = tiposTratamiento().map((t) => `<option value="${esc(t)}"></option>`).join('');
}

// La sanidad es cosa del veterinario: solo él borra, y únicamente los tratamientos que registró él
function puedeBorrarTrat(t) {
  return esVeterinario() && (!t.creadoPor || t.creadoPor === usuarioActual.id);
}
const nombreVinculo = (id) => (vinculosCuenta.find((v) => v.id === id) || {}).usuario || '';

function resetFormTrat() {
  $('trat-fecha').value = hoyISO();
  $('trat-tipo').value = '';
  // Si quien usa la cuenta es veterinario, se propone como responsable del tratamiento
  $('trat-vet').value = usuarioActual && usuarioActual.perfil === 'veterinario' ? usuarioActual.usuario : '';
  $('trat-obs').value = '';
  $('trat-ret-carne').value = '';
  $('trat-ret-leche').value = '';
  ocultarError($('trat-error'));
}

/* ---------- Fechas ---------- */
function isoLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sumarDias(iso, dias) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
}

// Días desde hoy hasta una fecha (negativo si ya pasó)
function diasHasta(iso) {
  const hoy = new Date(hoyISO() + 'T00:00:00');
  const f = new Date(iso + 'T00:00:00');
  return Math.round((f - hoy) / 86400000);
}

const fechaCSV = (iso) => (iso ? formatearFecha(iso) : '');

/* ---------- Reproducción: gestación y próximos partos ---------- */
// Los días de gestación dependen de la especie (vaca 283, cerda 114, oveja/cabra 150)
const DIAS_ALERTA_PARTO = 30;     // aviso ámbar
const DIAS_URGENTE_PARTO = 15;    // aviso rojo

function partoCalculado(cubricion, especie) {
  const dias = ESPECIES[especie] && ESPECIES[especie].diasGestacion;
  return cubricion && dias ? sumarDias(cubricion, dias) : '';
}

function estadoParto(dias) {
  if (dias < 0) return { clase: 'bg-red-100 text-red-800', texto: `Pasada de fecha (${-dias} ${-dias === 1 ? 'día' : 'días'})` };
  if (dias === 0) return { clase: 'bg-red-100 text-red-800', texto: '¡Hoy!' };
  const t = `En ${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (dias <= DIAS_URGENTE_PARTO) return { clase: 'bg-red-100 text-red-800', texto: t + ' · inminente' };
  if (dias <= DIAS_ALERTA_PARTO) return { clase: 'bg-amber-100 text-amber-800', texto: t };
  return { clase: 'bg-green-100 text-green-800', texto: t };
}

function enlaceVaca(v) {
  return `<button type="button" data-action="ver-ficha" data-id="${esc(v.id)}" class="font-medium text-green-700 hover:underline">${esc(etiquetaVaca(v))}</button>`;
}

function renderPartos() {
  const gest = vacas.filter((v) => v.estado === 'Gestante');
  const conFecha = gest.filter((v) => v.fechaParto).sort((a, b) => a.fechaParto.localeCompare(b.fechaParto));
  const sinFecha = gest.filter((v) => !v.fechaParto);
  const conAlerta = conFecha.filter((v) => diasHasta(v.fechaParto) <= DIAS_ALERTA_PARTO).length;

  $('partos-resumen').textContent = gest.length
    ? `${gest.length} ${gest.length === 1 ? 'gestante' : 'gestantes'} · ${conAlerta} con parto en los próximos ${DIAS_ALERTA_PARTO} días`
    : '';

  if (!gest.length) {
    $('partos-lista').innerHTML =
      '<p class="text-sm text-stone-500">No hay hembras gestantes. Marca un animal como «Gestante» e indica la fecha de cubrición para ver aquí sus partos.</p>';
    return;
  }

  const fila = (v) => {
    const finca = nombreFinca(v.fincaId);
    const dias = v.fechaParto ? diasHasta(v.fechaParto) : null;
    const est = dias === null ? { clase: 'bg-stone-100 text-stone-600', texto: 'Sin fecha prevista' } : estadoParto(dias);
    return `
      <li class="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>${enlaceVaca(v)}
          <span class="text-xs text-stone-500">${finca ? '· ' + esc(finca) : ''}${v.fechaParto ? ' · parto previsto ' + formatearFecha(v.fechaParto) : ''}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block rounded-full ${est.clase} px-2 py-0.5 text-xs">${esc(est.texto)}</span>
          <button type="button" data-action="editar-gestacion" data-id="${esc(v.id)}"
            class="text-xs bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg px-3 py-1 transition">Editar</button>
          <button type="button" data-action="registrar-parto" data-id="${esc(v.id)}"
            class="text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-1 transition">Registrar parto</button>
        </div>
      </li>`;
  };
  $('partos-lista').innerHTML = '<ul class="divide-y">' + [...conFecha, ...sinFecha].map(fila).join('') + '</ul>';
}

function actualizarVisibilidadGestacion() {
  const esp = ESPECIES[especieForm()];
  $('vaca-gestacion').classList.toggle('hidden', !(esp.gestacion && $('vaca-estado').value === 'Gestante'));
  if (esp.gestacion) {
    $('vaca-gestacion-hint').textContent =
      `Se calcula sola al indicar la cubrición (${esp.diasGestacion} días, la gestación media de ${esp.animalGestante}) y puedes corregirla.`;
  }
}

// Estado y cubrición/parto del formulario vuelven a su valor inicial
function resetCamposReproduccion() {
  $('vaca-cubricion').value = '';
  $('vaca-parto').value = '';
  $('vaca-parto').dataset.auto = '';
  origenMov = null;
  $('vaca-fecha-mov').value = '';
  actualizarVisibilidadGestacion();
  actualizarMovimientoForm();
}

// Prepara el formulario para dar de alta una ternera hija de la vaca indicada
function prepararCria(madreId, nacimiento) {
  const madre = vacaPorId(madreId);
  if (!madre) return;
  cambiarTab('vacas');
  resetFormVaca();
  $('vaca-especie').value = especieDe(madre);
  alCambiarEspecie();
  if (nacimiento) $('vaca-nacimiento').value = nacimiento;
  renderSelectMadre(madre.id);
  $('vaca-sexo').value = 'H';
  renderEstadosForm();
  $('vaca-estado').value = ESPECIES[especieDe(madre)].estadoCria.H;
  actualizarVisibilidadGestacion();
  $('vaca-finca').value = madre.fincaId || '';
  actualizarMovimientoForm();
  $('vaca-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('vaca-crotal').focus();
}

function registrarParto(id) {
  const v = vacaPorId(id);
  if (!v) return;
  const estadoTras = ESPECIES[especieDe(v)].estadoParto;
  if (!confirm(`¿Registrar el parto de ${etiquetaVaca(v)}?\n\nPasará a «${estadoTras}» y se abrirá el formulario para dar de alta la cría.`)) return;
  const vacasNuevas = vacas.map((x) => (x.id === v.id ? { ...x, estado: estadoTras, fechaCubricion: '', fechaParto: '' } : x));
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) return;
  vacas = vacasNuevas;
  renderTodo();
  prepararCria(v.id, hoyISO());
}

/* ---------- Movimientos de finca y lote ---------- */
// Compara la ubicación anterior y la nueva y devuelve los registros de movimiento a anotar
function entradasMovimiento(antes, despues, fecha) {
  const out = [];
  if ((antes.fincaId || '') !== (despues.fincaId || '')) {
    out.push({ id: uid(), fecha, campo: 'Finca', desde: nombreFinca(antes.fincaId) || '', hasta: nombreFinca(despues.fincaId) || '', creado: Date.now() });
  }
  if (normLote(antes.lote) !== normLote(despues.lote)) {
    out.push({ id: uid(), fecha, campo: 'Lote', desde: String(antes.lote || '').trim(), hasta: String(despues.lote || '').trim(), creado: Date.now() });
  }
  return out;
}

// Muestra u oculta la fecha del movimiento según haya cambios de finca o lote en el formulario
function actualizarMovimientoForm() {
  const finca = $('vaca-finca').value;
  const lote = $('vaca-lote').value.trim();
  const cambios = [];
  if (editVacaId && origenMov) {
    if (finca !== origenMov.fincaId) cambios.push(`Finca: ${nombreFinca(origenMov.fincaId) || 'Sin finca'} → ${nombreFinca(finca) || 'Sin finca'}`);
    if (normLote(lote) !== normLote(origenMov.lote)) cambios.push(`Lote: ${origenMov.lote || 'Sin lote'} → ${lote || 'Sin lote'}`);
  } else if (!editVacaId) {
    if (finca) cambios.push(`Entrada en la finca ${nombreFinca(finca) || ''}`.trim());
    if (lote) cambios.push(`Entrada en el lote ${lote}`);
  }
  $('vaca-mov-wrap').classList.toggle('hidden', !cambios.length);
  $('vaca-mov-detalle').textContent = cambios.join(' · ');
  if (cambios.length && !$('vaca-fecha-mov').value) $('vaca-fecha-mov').value = hoyISO();
}

function movimientosOrdenados(v) {
  return [...(v.movimientos || [])].sort(
    (a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0)
  );
}

/* ---------- Bajas: ventas, sacrificios y fallecimientos ---------- */
const MOTIVOS_BAJA = ['Venta', 'Sacrificio', 'Fallecimiento'];
const CLASE_BAJA = {
  'Venta': 'bg-sky-100 text-sky-800',
  'Sacrificio': 'bg-amber-100 text-amber-800',
  'Fallecimiento': 'bg-stone-200 text-stone-700'
};
const ETIQUETA_DETALLE_BAJA = {
  'Venta': 'Comprador / destino',
  'Sacrificio': 'Matadero / destino',
  'Fallecimiento': 'Causa de la muerte'
};

function bajasDelPeriodo() {
  const anio = $('baja-filtro-anio').value;
  return bajas.filter((b) => !anio || String((b.baja || {}).fecha || '').slice(0, 4) === anio);
}

function bajasFiltradas() {
  const texto = $('baja-buscar').value.trim().toLowerCase();
  const motivo = $('baja-filtro-motivo').value;
  return bajasDelPeriodo()
    .filter((b) => {
      const bj = b.baja || {};
      const coincideTexto = !texto ||
        [b.crotal, b.nombre, b.raza, bj.detalle, bj.documento].some((c) => String(c || '').toLowerCase().includes(texto));
      return coincideTexto && (!motivo || bj.motivo === motivo);
    })
    .sort((a, b) => ((b.baja || {}).fecha || '').localeCompare((a.baja || {}).fecha || '') ||
      ((b.baja || {}).registrado || 0) - ((a.baja || {}).registrado || 0));
}

function renderBajas() {
  const anios = [...new Set(bajas.map((b) => String((b.baja || {}).fecha || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const anioActual = $('baja-filtro-anio').value;
  $('baja-filtro-anio').innerHTML =
    '<option value="">Todos los años</option>' + anios.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  $('baja-filtro-anio').value = anios.includes(anioActual) ? anioActual : '';

  const periodo = bajasDelPeriodo();
  const cuenta = (m) => periodo.filter((b) => (b.baja || {}).motivo === m).length;
  $('stat-bajas-total').textContent = periodo.length;
  $('stat-bajas-venta').textContent = cuenta('Venta');
  $('stat-bajas-sacrificio').textContent = cuenta('Sacrificio');
  $('stat-bajas-fallecimiento').textContent = cuenta('Fallecimiento');

  const lista = bajasFiltradas();
  $('bajas-body').innerHTML = lista
    .map((b) => {
      const bj = b.baja || {};
      return `
        <tr data-action="ver-ficha" data-id="${esc(b.id)}" class="border-b last:border-0 hover:bg-stone-50 cursor-pointer">
          <td class="py-2 pr-4 whitespace-nowrap">${formatearFecha(bj.fecha)}</td>
          <td class="py-2 pr-4"><span class="inline-block rounded-full ${CLASE_BAJA[bj.motivo] || 'bg-stone-100 text-stone-700'} px-2 py-0.5 text-xs">${esc(bj.motivo)}</span></td>
          <td class="py-2 pr-4 font-mono">
            <button data-action="ver-ficha" data-id="${esc(b.id)}" class="text-green-800 hover:underline" title="Ver ficha">${esc(b.crotal)}</button>
          </td>
          <td class="py-2 pr-4">${esc(b.nombre) || '—'}</td>
          <td class="py-2 pr-4">${esc(b.raza) || '—'}</td>
          <td class="py-2 pr-4 col-ubicacion">${bj.finca ? esc(bj.finca) : '—'}</td>
          <td class="py-2 pr-4 col-ubicacion">${bj.lote ? esc(bj.lote) : '—'}</td>
          <td class="py-2 pr-4">${esc(bj.detalle) || '—'}</td>
          <td class="py-2 pr-4">${esc(bj.documento) || '—'}</td>
          <td class="py-2 text-right whitespace-nowrap">
            <button data-action="reactivar-vaca" data-id="${esc(b.id)}"
              class="text-blue-600 hover:text-blue-800 hover:underline text-sm">Reactivar</button>
          </td>
        </tr>`;
    })
    .join('');
  $('bajas-empty').classList.toggle('hidden', lista.length > 0);
}

function actualizarEtiquetaBaja() {
  $('baja-detalle-label').textContent = ETIQUETA_DETALLE_BAJA[$('baja-motivo').value] || 'Detalle';
}

/* ---------- Exportación a Excel / CSV ----------
   CSV con ";" como separador, coma decimal y codificación UTF-8 con BOM: Excel en español lo abre directamente. */
const CABECERA_VACAS = ['Crotal', 'Nombre', 'Sexo', 'Raza', 'Especie', 'Fecha de nacimiento', 'Estado', 'Finca', 'Lote', 'Madre (crotal)', 'Padre',
  'Nº de crías', 'Fecha de cubrición', 'Fecha prevista de parto', 'Nº de tratamientos', 'Último tratamiento'];
const CABECERA_FINCAS = ['Nombre', 'Ubicación', 'Superficie (ha)', 'Lote', 'Nº de animales', 'Latitud (centro)', 'Longitud (centro)', 'Límite (lat,lng | lat,lng …)'];
const CABECERA_BAJAS = ['Fecha de baja', 'Motivo', 'Crotal', 'Nombre', 'Raza', 'Especie', 'Fecha de nacimiento', 'Finca', 'Lote', 'Destino / causa', 'Nº de documento'];

// La primera columna usa el término de identificación de la especie activa (crotal, matrícula, anilla…)
const cabeceraVacas = () => CABECERA_VACAS.map((h) => (h === 'Crotal' ? vocab().crotal : h));
const cabeceraBajas = () => CABECERA_BAJAS.map((h) => (h === 'Crotal' ? vocab().crotal : h));

function celdaCSV(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  let s = String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita que Excel interprete el texto como una fórmula
  if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function construirCSV(cabecera, filas) {
  return [cabecera, ...filas].map((fila) => fila.map(celdaCSV).join(';')).join('\r\n');
}

function descargarCSV(nombre, cabecera, filas) {
  descargarArchivo(nombre, new Blob(['﻿' + construirCSV(cabecera, filas)], { type: 'text/csv;charset=utf-8' }));
}

// Descarga un Blob con el nombre indicado (CSV y copias de seguridad)
function descargarArchivo(nombre, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filasVacas(lista) {
  return lista.map((v) => {
    const t = tratamientosDe(v);
    const ult = ultimoTratamiento(v);
    const madre = vacaAnyPorId(v.madreId);
    return [v.crotal, v.nombre, SEXOS[sexoDe(v)], v.raza, ESPECIES[especieDe(v)].corto, fechaCSV(v.nacimiento), v.estado, nombreFinca(v.fincaId) || '', v.lote || '',
      madre ? madre.crotal : '', (vacaAnyPorId(v.padreId) || {}).crotal || v.padreExterno || '', criasFicha(v.id).length, fechaCSV(v.fechaCubricion), fechaCSV(v.fechaParto),
      t.length, ult ? `${formatearFecha(ult.fecha)} ${ult.tipo}` : ''];
  });
}

function centroFinca(f) {
  if (f.poligono && f.poligono.length >= 3) {
    const n = f.poligono.length;
    return [f.poligono.reduce((s, p) => s + p[0], 0) / n, f.poligono.reduce((s, p) => s + p[1], 0) / n];
  }
  return f.punto || null;
}

function filasFincas() {
  return fincas.map((f) => {
    const c = centroFinca(f);
    return [f.nombre, f.ubicacion || '', f.hectareas === '' || f.hectareas == null ? '' : Number(f.hectareas), f.lote || '',
      vacas.filter((v) => v.fincaId === f.id).length, c ? +c[0].toFixed(6) : '', c ? +c[1].toFixed(6) : '',
      (f.poligono || []).map((p) => p.join(',')).join(' | ')];
  });
}

function filasBajas(lista) {
  return lista.map((b) => {
    const bj = b.baja || {};
    return [fechaCSV(bj.fecha), bj.motivo, b.crotal, b.nombre, b.raza, ESPECIES[especieDe(b)].corto, fechaCSV(b.nacimiento), bj.finca || '', bj.lote || '', bj.detalle || '', bj.documento || ''];
  });
}

/* ---------- Estado ---------- */
let fincas = [];
let vacas = [];
let bajas = []; // histórico de bajas (libro de explotación): animales con su registro de baja
let cebaderos = []; // { id, nombre, ubicacion, capacidad }
let pesajes = [];   // pesos: { id, animalId, fecha, peso, observaciones }
let economia = [];  // gastos e ingresos: { id, fecha, tipo, categoria, concepto, importe, animalId, origen }
let cebos = [];     // estancias en cebadero: { id, cebaderoId, animalId, entrada, pesoEntrada, salida, pesoSalida, observaciones }
let editCeboId = null;
let editCebaderoId = null;
let editVacaId = null;
let origenMov = null; // finca y lote que tenía la vaca al empezar a editarla (para registrar movimientos)
let editFincaId = null;
let geomForm = { poligono: null, punto: null };

let mapa = null;
let capaFincas = null;
let capaDibujo = null;
let capasPorFinca = {};

function cargarDatos() {
  const f = cargar(KEYS.fincas, null);
  const v = cargar(KEYS.vacas, null);
  if (f === null || v === null) {
    // Las cuentas nuevas empiezan vacías (no hay datos de ejemplo)
    fincas = [];
    vacas = [];
    guardar(KEYS.fincas, fincas);
    guardar(KEYS.vacas, vacas);
  } else {
    fincas = Array.isArray(f) ? f : [];
    vacas = Array.isArray(v) ? v : [];
  }
  const b = cargar(KEYS.bajas, []);
  bajas = Array.isArray(b) ? b : [];
  const cb = cargar(KEYS.cebaderos, []);
  cebaderos = Array.isArray(cb) ? cb.filter((c) => c && c.id && c.nombre) : [];
  const ce = cargar(KEYS.cebos, []);
  cebos = Array.isArray(ce) ? ce : [];
  const ps = cargar(KEYS.pesajes, []);
  pesajes = Array.isArray(ps) ? ps.filter((x) => x && x.id && x.animalId && x.fecha && Number(x.peso) > 0) : [];
  const ec = cargar(KEYS.economia, []);
  economia = Array.isArray(ec) ? ec.filter((m) => m && m.id && m.fecha && (m.tipo === 'gasto' || m.tipo === 'ingreso')) : [];
  // Registros anteriores a la multiespecie: toman la primera especie de la cuenta
  [...vacas, ...bajas].forEach((a) => { if (!ESPECIES[a.especie]) a.especie = especiesCuenta()[0]; });
  reparacionesIntegridad = repararIntegridad();
}

let reparacionesIntegridad = 0; // nº de relaciones rotas corregidas al cargar (para avisar a la persona)

// Revisa las relaciones entre animales, fincas y bajas (datos antiguos o editados a mano) y corrige las rotas:
// finca inexistente, madre inexistente o que forma un ciclo, y listas de sanidad/movimientos mal formadas.
// Si corrige algo, lo persiste. Devuelve el nº de correcciones.
function repararIntegridad() {
  let cambios = 0;
  let migrados = 0; // campo sexo en datos antiguos: se guarda, pero no se avisa como «relación rota»
  const idsFincas = new Set(fincas.map((f) => f.id));
  const todos = [...vacas, ...bajas];
  const porId = new Map(todos.map((a) => [a.id, a]));

  todos.forEach((a) => {
    ['tratamientos', 'movimientos'].forEach((campo) => {
      if (a[campo] !== undefined && !Array.isArray(a[campo])) { a[campo] = []; cambios++; }
      (a[campo] || []).forEach((r) => { if (!r.id) { r.id = uid(); cambios++; } });
    });
  });
  vacas.forEach((a) => {
    if (a.fincaId && !idsFincas.has(a.fincaId)) { a.fincaId = ''; cambios++; }
  });
  todos.forEach((a) => {
    if (a.sexo !== 'H' && a.sexo !== 'M') { a.sexo = sexoDe(a); migrados++; }
    if (a.estado === 'Toro') { a.estado = 'Semental'; migrados++; } // «Toro» dejó de ser un estado: ahora es un macho semental
  });
  todos.forEach((a) => {
    if (a.madreId && (a.madreId === a.id || !porId.has(a.madreId))) { a.madreId = ''; cambios++; }
    if (a.padreId && (a.padreId === a.id || !porId.has(a.padreId))) { a.padreId = ''; cambios++; }
    if (a.padreExterno !== undefined && typeof a.padreExterno !== 'string') { a.padreExterno = ''; cambios++; }
  });
  // Ciclos en la línea materna: se corta el vínculo del animal que cierra el ciclo
  todos.forEach((a) => {
    const vistos = new Set([a.id]);
    let m = a.madreId;
    while (m) {
      if (m === a.id) { a.madreId = ''; cambios++; break; }
      if (vistos.has(m)) break;
      vistos.add(m);
      m = (porId.get(m) || {}).madreId;
    }
  });

  // Ciclos que pasan por el padre (p. ej. un toro registrado como hijo de su propia hija): se corta el padre
  const llegaA = (desde, objetivo) => {
    const vistos = new Set();
    const pend = [desde];
    while (pend.length) {
      const x = porId.get(pend.pop());
      if (!x || vistos.has(x.id)) continue;
      if (x.id === objetivo) return true;
      vistos.add(x.id);
      if (x.madreId) pend.push(x.madreId);
      if (x.padreId) pend.push(x.padreId);
    }
    return false;
  };
  todos.forEach((a) => {
    if (a.padreId && llegaA(a.padreId, a.id)) { a.padreId = ''; cambios++; }
  });

  // Registros de cebadero cuyo animal o cebadero ya no existe
  const idsCebaderos = new Set(cebaderos.map((c) => c.id));
  const cebosValidos = cebos.filter((r) => r && r.id && porId.has(r.animalId) && idsCebaderos.has(r.cebaderoId) && r.entrada);
  if (cebosValidos.length !== cebos.length) { cambios += cebos.length - cebosValidos.length; cebos = cebosValidos; }
  economia.forEach((m) => { if (m.animalId && !porId.has(m.animalId)) { m.animalId = ''; migrados++; } });
  economia.forEach((m) => { if (m.cebaderoId && !idsCebaderos.has(m.cebaderoId)) { m.cebaderoId = ''; migrados++; } });
  const pesajesValidos = pesajes.filter((x) => porId.has(x.animalId));
  if (pesajesValidos.length !== pesajes.length) { migrados++; pesajes = pesajesValidos; }
  const enCeboAhora = new Set(cebos.filter((r) => !r.salida).map((r) => r.animalId));
  vacas.forEach((a) => {
    if (enCeboAhora.has(a.id) && (a.fincaId || a.lote)) { a.fincaId = ''; a.lote = ''; migrados++; }
  });

  if (cambios || migrados) guardarTransaccion([[KEYS.vacas, vacas], [KEYS.bajas, bajas], [KEYS.cebos, cebos], [KEYS.economia, economia], [KEYS.pesajes, pesajes]], true);
  return cambios;
}

// Guarda varias claves de golpe: si alguna falla se restauran las anteriores y se recargan los datos de memoria,
// de modo que nunca quedan fincas y animales a medias. «silencioso» evita el aviso (uso interno).
function guardarTransaccion(pares, silencioso = false) {
  let previos = [];
  try {
    previos = pares.map(([clave]) => localStorage.getItem(clave));
    pares.forEach(([clave, valor]) => localStorage.setItem(clave, JSON.stringify(valor)));
    // Lo guardado en el navegador se sube a la nube (solo las diferencias, en segundo plano)
    if (usuarioActual && window.Nube) Nube.programar();
    return true;
  } catch {
    pares.forEach(([clave], i) => {
      try {
        if (previos[i] === undefined || previos[i] === null) localStorage.removeItem(clave);
        else localStorage.setItem(clave, previos[i]);
      } catch { /* sin acceso al almacenamiento */ }
    });
    if (!silencioso) alert('No se pudo guardar en el navegador (¿almacenamiento bloqueado o lleno?). No se ha modificado ningún dato.');
    return false;
  }
}

/* ---------- Sesión ---------- */
/* ---------- Cuentas de usuario ----------
   Las contraseñas nunca se guardan en claro: se almacena un hash (PBKDF2-SHA256 con sal aleatoria;
   SHA-256 iterado si el navegador no ofrece crypto.subtle). Todo vive en este navegador (localStorage),
   así que protege frente a curiosos, pero no sustituye a un servidor con autenticación real. */
const PBKDF2_ITER = 150000;
const SHA_JS_ITER = 20000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normUsuario = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

function leerUsuarios() {
  const lista = cargar(KEYS.usuarios, []);
  return Array.isArray(lista) ? lista : [];
}

function guardarUsuarios(lista) {
  return guardar(KEYS.usuarios, lista);
}

function hayCryptoSubtle() {
  return !!(window.crypto && window.crypto.subtle);
}

function aHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function aleatorioHex(n = 16) {
  const a = new Uint8Array(n);
  window.crypto.getRandomValues(a);
  return aHex(a);
}

// SHA-256 en JavaScript puro (solo como alternativa cuando no hay crypto.subtle)
function sha256(texto) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const bytes = Array.from(new TextEncoder().encode(texto));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 0xff);

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

async function hashPassword(password, salt, alg) {
  if (alg === 'pbkdf2') {
    const enc = new TextEncoder();
    const clave = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITER, hash: 'SHA-256' }, clave, 256);
    return aHex(bits);
  }
  let h = sha256(salt + ':' + password);
  for (let i = 0; i < SHA_JS_ITER; i++) h = sha256(h + salt);
  return h;
}

function igualesSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------- Sesión ---------- */
// Datos de la cuenta que usa la app (perfil y especies con valores por defecto para cuentas antiguas)
function datosCuenta(u) {
  const tipo = TIPOS_EXPLOTACION[u.tipoExplotacion] ? u.tipoExplotacion : 'bovino';
  let especies = Array.isArray(u.especies) ? u.especies.filter((e) => ESPECIES[e]) : [];
  if (!especies.length) especies = tipo === 'mixta' ? Object.keys(ESPECIES) : [tipo];
  return {
    id: u.id,
    usuario: u.usuario,
    email: u.email || '',
    perfil: PERFILES[u.perfil] ? u.perfil : 'ganadero',
    tipoExplotacion: tipo,
    especies
  };
}

// El perfil se guarda también en el navegador para poder abrir la app sin conexión
function guardarPerfilLocal(p) {
  try { localStorage.setItem('gg_perfil_' + p.id, JSON.stringify(p)); } catch { /* sin espacio */ }
}
function perfilLocal(id) {
  try { return JSON.parse(localStorage.getItem('gg_perfil_' + id) || 'null'); } catch { return null; }
}

function iniciarSesion(perfil, esNuevo = false) {
  usuarioActual = datosCuenta(perfil);
  guardarPerfilLocal(perfil);
  $('login-form').reset();
  $('register-form').reset();
  mostrarApp(esNuevo);
}

// Vacía todo lo que la app tiene en memoria y en pantalla para que la siguiente cuenta no vea nada ajeno
function limpiarEstadoApp() {
  vacas = [];
  fincas = [];
  bajas = [];
  cebaderos = [];
  cebos = [];
  economia = [];
  pesajes = [];
  fotosFicha = { id: null, lista: [] };
  editEcoId = null;
  editCeboId = null;
  editCebaderoId = null;
  editVacaId = null;
  editFincaId = null;
  fichaActualId = null;
  loteModalActual = '';
  cerrarModalLote();
  cerrarFicha();
  cerrarBajaModal();
  cerrarPerfil();
  resetFormVaca();
  resetFormFinca();
  resetFormTrat();
  ['buscar-vaca', 'filtro-finca', 'filtro-estado', 'filtro-lote', 'orden-vacas', 'baja-buscar', 'baja-filtro-motivo', 'baja-filtro-anio',
    'cebo-buscar', 'cebo-filtro-cebadero', 'cebo-desde', 'cebo-hasta', 'buscar-finca', 'cebo-actual-buscar', 'cebo-actual-cebadero'].forEach((id) => { $(id).value = ''; });
  $('cebo-entrada').value = '';
  $('vaca-modal-ficha').innerHTML = '';
  $('trat-lista').innerHTML = '';
  $('lote-modal-body').innerHTML = '';
  $('agenda-lista').innerHTML = '';
  if (mapa) {
    capaFincas.clearLayers();
    capaDibujo.clearLayers();
    capasPorFinca = {};
  }
}

function mostrarPestanaAcceso(cual) {
  const registro = cual === 'registro';
  $('login-form').classList.toggle('hidden', registro);
  $('register-form').classList.toggle('hidden', !registro);
  [['tab-login-btn', !registro], ['tab-register-btn', registro]].forEach(([id, activo]) => {
    const b = $(id);
    b.setAttribute('aria-selected', String(activo));
    ['bg-white', 'shadow', 'text-green-800'].forEach((c) => b.classList.toggle(c, activo));
    ['text-stone-600', 'hover:text-stone-800'].forEach((c) => b.classList.toggle(c, !activo));
  });
}

// Iconos de la cabecera según la explotación: un PNG por cada especie de la cuenta, todos en una misma fila
// (una especie → un icono; mixta → los de todas sus especies, p. ej. vaca y cerdo).
// El logotipo (logo.png) solo se muestra en la pantalla de inicio de sesión y registro.
function actualizarIconoCabecera() {
  const esp = especiesCuenta();
  $('app-icono').innerHTML = esp
    .map((k) => `<img src="${ICONOS_ESPECIE[k]}" alt="${esc(ESPECIES[k].corto)}" title="${esc(ESPECIES[k].corto)}" class="h-9 w-9 shrink-0 object-contain" draggable="false" />`)
    .join('');
  $('app-icono').setAttribute('aria-label', esMixta()
    ? `Explotación mixta (${esp.map((k) => ESPECIES[k].corto).join(', ')})`
    : `Explotación ${ESPECIES[esp[0]].corto.toLowerCase()}`);
}

// Logotipo de la pantalla de acceso: si logo.png no se encuentra junto a index.html se usa la copia incrustada;
// si tampoco carga, se muestra el emoji de reserva.
function asegurarLogo() {
  const img = $('login-logo');
  const reserva = img.nextElementSibling;
  const usarRespaldo = () => {
    if (img.dataset.respaldo !== '1') {
      img.dataset.respaldo = '1';
      img.src = LOGO_RESPALDO;
    } else {
      img.classList.add('hidden');
      reserva.classList.remove('hidden');
    }
  };
  if (img.complete) {
    if (img.naturalWidth === 0) usarRespaldo();
  } else {
    img.addEventListener('error', usarRespaldo);
  }
}

// Adapta la interfaz a la cuenta: perfil, especies, estados, razas y vocabulario
function aplicarCuenta() {
  const esp = especiesCuenta();
  ESTADOS = estadosCuenta();
  $('user-label').textContent = `${usuarioActual.usuario} · ${PERFILES[usuarioActual.perfil]}`;
  actualizarIconoCabecera();
  $('vaca-especie').innerHTML = esp.map((k) => `<option value="${esc(k)}">${esc(ESPECIES[k].corto)}</option>`).join('');
  $('vaca-especie-wrap').classList.toggle('hidden', esp.length < 2);
  $('panel-partos').classList.toggle('hidden', !esp.some((k) => ESPECIES[k].gestacion));
  renderSelectsEstado();
  aplicarVocabulario();
}

function aplicarVocabulario() {
  const v = vocab();
  const textos = {
    tabAnimales: cap(v.animales),
    statAnimales: esVeterinario() ? `${cap(v.animales)} en seguimiento` : `Total de ${v.animales}`,
    crotalLabel: `${v.crotal} *`,
    criasTitulo: `${v.emoji} Crías de ${v.este} ${v.animal}`,
    listadoTitulo: esVeterinario() ? `${cap(v.animales)} bajo seguimiento clínico` : `Listado de ${v.animales}`,
    vacasEmpty: `No hay ${v.animales} que mostrar.`,
    loteVacio: `Este lote no tiene ${v.animales} todavía.`
  };
  document.querySelectorAll('[data-t]').forEach((el) => { if (textos[el.dataset.t] !== undefined) el.textContent = textos[el.dataset.t]; });
  const corto = crotalCorto().toLowerCase();
  const placeholders = {
    crotalPh: v.crotalPh,
    nombrePh: v.nombrePh,
    razaPh: v.razaPh,
    buscarAnimal: `Buscar por ${corto}, nombre o raza…`,
    buscarBaja: `Buscar ${corto}, nombre, destino…`
  };
  document.querySelectorAll('[data-ph]').forEach((el) => { if (placeholders[el.dataset.ph] !== undefined) el.placeholder = placeholders[el.dataset.ph]; });
  const th = (cuerpo, i, txt) => { const t = $(cuerpo).closest('table').querySelectorAll('th')[i]; if (t) t.textContent = txt; };
  th('vacas-body', 0, v.crotal);
  th('bajas-body', 2, v.crotal);
  th('lote-modal-body', 0, v.crotal);
  $('lote-modal-filtrar').textContent = `Filtrar en ${cap(v.animales)}`;
}

async function mostrarApp(esNuevo = false) {
  $('login-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  const vet = esVeterinario();
  document.body.classList.toggle('modo-veterinario', vet);
  if (window.Nube) Nube.ponerModo({ veterinario: vet });
  ganaderoVista = null;
  await cargarVinculos(); // el veterinario abre la explotación del último ganadero que vio
  aplicarCuenta();
  cargarDatos();          // copia del navegador (rápido y sin conexión)
  cambiarTab('vacas');
  resetFormVaca();
  resetFormEco();
  renderTodo();
  avisoReparaciones();
  if (esNuevo) {
    const pasos = vet
      ? 'Pide a tu ganadero un código de invitación y añádelo en «Mi perfil» (👤) para ver sus animales y registrar tratamientos.'
      : `Empieza añadiendo una finca (con su lote) en «Fincas» y tus primeros ${vocab().animales} aquí. Desde «Mi perfil» (👤) puedes invitar a tu veterinario.`;
    mostrarAvisoVaca(`👋 ¡Bienvenido/a, ${usuarioActual.usuario}! Tu cuenta de ${PERFILES[usuarioActual.perfil].toLowerCase()} está creada. ${pasos}`);
  }
  refrescarDesdeNube();   // y después, lo último de la nube
}

function avisoReparaciones() {
  if (reparacionesIntegridad) {
    mostrarAvisoVaca(`🛠 Se corrigieron ${reparacionesIntegridad} ${reparacionesIntegridad === 1 ? 'relación rota' : 'relaciones rotas'} en los datos guardados (fincas o madres que ya no existían).`);
    reparacionesIntegridad = 0;
  }
}

/* ---------- Nube: descarga, estado de sincronización y veterinario ---------- */
let refrescando = false;

async function refrescarDesdeNube() {
  if (!usuarioActual || !window.Nube || refrescando) return;
  if (esVeterinario() && !ganaderoVista) { marcarEstadoNube({ estado: 'inactivo' }); return; }
  const owner = idExplotacion();
  refrescando = true;
  marcarEstadoNube({ estado: 'cargando' });
  try {
    const { estado, combinado } = await Nube.descargar(owner, { fincas, vacas, bajas, cebaderos, cebos, economia, pesajes });
    if (!usuarioActual || owner !== idExplotacion()) return; // se cambió de cuenta o de ganadero mientras tanto
    const fichaAbierta = !$('vaca-modal').classList.contains('hidden') ? fichaActualId : null;
    guardar(KEYS.fincas, estado.fincas);
    guardar(KEYS.vacas, estado.vacas);
    guardar(KEYS.bajas, estado.bajas);
    guardar(KEYS.cebaderos, estado.cebaderos);
    guardar(KEYS.cebos, estado.cebos);
    if (!esVeterinario()) guardar(KEYS.economia, Nube.economiaEnNube() ? (estado.economia || []) : economia);
    if (!esVeterinario()) guardar(KEYS.pesajes, Nube.tablaEnNube('pesajes') ? (estado.pesajes || []) : pesajes);
    cargarDatos(); // pasa por las migraciones y repararIntegridad(); si corrige algo, se sube
    renderTodo();
    if (fichaAbierta && vacaAnyPorId(fichaAbierta)) abrirFicha(fichaAbierta);
    avisoReparaciones();
    if (combinado) Nube.programar(100);
    else marcarEstadoNube(Nube.estado().estado === 'error' ? Nube.estado() : { estado: 'guardado' });
  } catch (err) {
    marcarEstadoNube({ estado: 'sin-conexion',
      mensaje: 'Sin conexión con la nube: estás viendo la copia guardada en este navegador. ' + Nube.traducirError(err) });
  } finally {
    refrescando = false;
  }
}

function marcarEstadoNube(s) {
  const tipos = {
    cargando: ['⏳', 'Cargando…', 'text-green-100'], guardando: ['⏳', 'Guardando…', 'text-green-100'],
    guardado: ['☁️', 'Guardado', 'text-green-100'], 'sin-conexion': ['⚠️', 'Sin conexión', 'text-amber-200'],
    error: ['⚠️', 'Error al guardar', 'text-red-200'], inactivo: ['☁️', '', 'text-green-100']
  };
  const [ico, texto, clase] = tipos[s.estado] || tipos.inactivo;
  const el = $('nube-estado');
  el.textContent = `${ico} ${texto}`.trim();
  el.title = s.mensaje || (s.estado === 'guardado' ? 'Todos los cambios están guardados en la nube.' : texto);
  el.className = `hidden sm:inline text-xs whitespace-nowrap ${clase}`;
  const aviso = $('nube-aviso');
  aviso.textContent = s.estado === 'error' || s.estado === 'sin-conexion' ? s.mensaje : '';
  aviso.classList.toggle('hidden', !aviso.textContent);
}

// Vínculos de la cuenta; el veterinario elige con qué ganadero trabaja
async function cargarVinculos() {
  if (!window.Nube || !usuarioActual) return;
  const clave = 'gg_vinculos_' + usuarioActual.id;
  try {
    vinculosCuenta = await Nube.vinculos();
    try { localStorage.setItem(clave, JSON.stringify(vinculosCuenta)); } catch { /* sin espacio */ }
  } catch {
    try { vinculosCuenta = JSON.parse(localStorage.getItem(clave) || '[]'); } catch { vinculosCuenta = []; }
  }
  if (esVeterinario()) {
    const ganaderos = vinculosCuenta.filter((v) => v.rol === 'ganadero');
    let ultimo = null;
    try { ultimo = localStorage.getItem('gg_vet_ultimo_' + usuarioActual.id); } catch { /* nada */ }
    const buscado = ganaderoVista ? ganaderoVista.id : ultimo;
    ganaderoVista = ganaderos.find((g) => g.id === buscado) || ganaderos[0] || null;
  }
  renderSelectorGanadero();
}

function renderSelectorGanadero() {
  const vet = esVeterinario();
  const ganaderos = vinculosCuenta.filter((v) => v.rol === 'ganadero');
  $('ganadero-vista').innerHTML = ganaderos.map((g) => `<option value="${esc(g.id)}">${esc(g.usuario)}</option>`).join('');
  $('ganadero-vista').value = ganaderoVista ? ganaderoVista.id : '';
  $('ganadero-vista-wrap').classList.toggle('hidden', !vet || !ganaderos.length);
  $('vet-sin-ganaderos').classList.toggle('hidden', !vet || ganaderos.length > 0);
}

async function cambiarGanadero(id) {
  const g = vinculosCuenta.find((v) => v.rol === 'ganadero' && v.id === id) || null;
  ganaderoVista = g;
  if (g) { try { localStorage.setItem('gg_vet_ultimo_' + usuarioActual.id, g.id); } catch { /* nada */ } }
  cerrarFicha();
  cerrarModalLote();
  cerrarArbol();
  editVacaId = null;
  editFincaId = null;
  editCeboId = null;
  editCebaderoId = null;
  renderSelectorGanadero();
  aplicarCuenta();
  cargarDatos();
  resetFormVaca();
  renderTodo();
  await refrescarDesdeNube();
}

$('ganadero-vista').addEventListener('change', (e) => cambiarGanadero(e.target.value));
$('nube-refrescar').addEventListener('click', () => refrescarDesdeNube());
// Al volver a la pestaña se traen los cambios de otros (p. ej. tratamientos del veterinario), si no se está editando nada
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !usuarioActual || !window.Nube) return;
  const ocupado = editVacaId || editFincaId || editCeboId || editCebaderoId ||
    ['vaca-modal', 'lote-modal', 'perfil-modal', 'baja-modal', 'arbol-modal'].some((id) => !$(id).classList.contains('hidden'));
  if (!ocupado && !Nube.hayPendientes()) refrescarDesdeNube();
});

function mostrarLogin() {
  $('app-view').classList.add('hidden');
  $('login-view').classList.remove('hidden');
  $('login-form').reset();
  $('register-form').reset();
  ocultarError($('login-error'));
  ocultarError($('register-error'));
  ocultarError($('login-ok'));
  mostrarPestanaAcceso('login');
}

$('tab-login-btn').addEventListener('click', () => mostrarPestanaAcceso('login'));
$('tab-register-btn').addEventListener('click', () => mostrarPestanaAcceso('registro'));

// Explotación mixta: se muestran las casillas para elegir las especies
function actualizarRegistroTipo() {
  $('reg-mixta-wrap').classList.toggle('hidden', $('reg-tipo').value !== 'mixta');
}
$('reg-tipo').addEventListener('change', actualizarRegistroTipo);
$('register-form').addEventListener('reset', () => setTimeout(actualizarRegistroTipo, 0));

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('login-error');
  ocultarError(error);
  ocultarError($('login-ok'));
  const email = $('username').value.trim().toLowerCase();
  const pass = $('password').value;
  if (!EMAIL_RE.test(email)) return mostrarError(error, 'Escribe el correo electrónico de tu cuenta.');
  if (!pass) return mostrarError(error, 'Escribe tu contraseña.');
  const boton = $('login-submit');
  boton.disabled = true;
  try {
    const perfil = await Nube.entrar(email, pass);
    if (!perfil) return mostrarError(error, 'No se pudo abrir la sesión.');
    iniciarSesion(perfil);
  } catch (err) {
    mostrarError(error, err.message || 'No se pudo iniciar sesión.');
  } finally {
    boton.disabled = false;
  }
});

$('login-olvido').addEventListener('click', async () => {
  const email = $('username').value.trim().toLowerCase();
  ocultarError($('login-ok'));
  if (!EMAIL_RE.test(email)) return mostrarError($('login-error'), 'Escribe primero tu correo y vuelve a pulsar «¿Olvidaste tu contraseña?».');
  try {
    await Nube.recuperarPassword(email);
    ocultarError($('login-error'));
    mostrarError($('login-ok'), `✉️ Te hemos enviado un correo a ${email} con un enlace para crear una contraseña nueva.`);
  } catch (err) {
    mostrarError($('login-error'), err.message);
  }
});

// Tras abrir el enlace del correo de recuperación se pide la contraseña nueva
async function pedirPasswordNueva() {
  const nueva = prompt('Escribe tu nueva contraseña (mínimo 6 caracteres):');
  if (!nueva) return;
  if (nueva.length < 6) { alert('La contraseña debe tener al menos 6 caracteres.'); return pedirPasswordNueva(); }
  try {
    await Nube.fijarPassword(nueva);
    alert('✔ Contraseña cambiada.');
  } catch (err) {
    alert('No se pudo cambiar la contraseña: ' + err.message);
  }
}

$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('register-error');
  ocultarError(error);

  const usuario = $('reg-usuario').value.trim().replace(/\s+/g, ' ');
  const email = $('reg-email').value.trim().toLowerCase();
  const pass = $('reg-password').value;
  const pass2 = $('reg-password2').value;
  const perfil = $('reg-perfil').value;
  const tipo = $('reg-tipo').value;
  const marcadas = [...document.querySelectorAll('input[name="reg-especie"]:checked')].map((c) => c.value);

  if (usuario.length < 3 || usuario.length > 30) {
    return mostrarError(error, 'El usuario debe tener entre 3 y 30 caracteres.');
  }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(usuario)) {
    return mostrarError(error, 'El usuario solo puede contener letras, números, espacios, puntos, guiones y guiones bajos.');
  }
  if (!EMAIL_RE.test(email)) return mostrarError(error, 'Escribe un correo electrónico válido.');
  if (pass.length < 6) return mostrarError(error, 'La contraseña debe tener al menos 6 caracteres.');
  if (pass !== pass2) return mostrarError(error, 'Las contraseñas no coinciden.');
  if (!PERFILES[perfil]) return mostrarError(error, 'Selecciona tu perfil de usuario: Ganadero o Veterinario.');
  if (!TIPOS_EXPLOTACION[tipo]) return mostrarError(error, 'Selecciona el tipo de explotación.');
  if (tipo === 'mixta' && marcadas.filter((e) => ESPECIES[e]).length < 2) {
    return mostrarError(error, 'En una explotación mixta marca al menos dos especies.');
  }
  const especies = tipo === 'mixta' ? Object.keys(ESPECIES).filter((e) => marcadas.includes(e)) : [tipo];

  const boton = $('register-submit');
  boton.disabled = true;
  try {
    const r = await Nube.registrar({ email, password: pass, usuario, perfil, tipoExplotacion: tipo, especies });
    if (r.confirmar) {
      $('register-form').reset();
      mostrarPestanaAcceso('login');
      $('username').value = email;
      mostrarError($('login-ok'), `✉️ Cuenta creada. Te hemos enviado un correo a ${email}: ábrelo y pulsa el enlace para activarla. Después entra aquí con tu correo y contraseña.`);
      return;
    }
    iniciarSesion(r.perfil, true);
  } catch (err) {
    mostrarError(error, err.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.');
  } finally {
    boton.disabled = false;
  }
});

$('logout-btn').addEventListener('click', async () => {
  if (window.Nube && Nube.hayPendientes() &&
      !confirm('Hay cambios que todavía no se han subido a la nube (¿sin conexión?). Se quedarán en este navegador y se subirán la próxima vez que entres. ¿Cerrar sesión igualmente?')) return;
  if (window.Nube) await Nube.salir();
  limpiarEstadoApp();
  usuarioActual = null;
  ganaderoVista = null;
  vinculosCuenta = [];
  document.body.classList.remove('modo-veterinario');
  marcarEstadoNube({ estado: 'inactivo' });
  mostrarLogin();
});

/* ---------- Perfil de usuario ----------
   Desde la cabecera se abre el perfil: usuario, correo, perfil (ganadero / veterinario), tipo de explotación y especies.
   Los cambios se guardan en la lista de cuentas (localStorage) y se aplican al momento a la sesión y a la interfaz.
   El cambio de contraseña exige la clave actual y un código de verificación (el envío por correo se SIMULA: la app
   no tiene servidor de correo, así que el código se muestra en pantalla). */

function cuentaActual() {
  return usuarioActual;
}

function actualizarPerfilTipo() {
  $('perfil-mixta-wrap').classList.toggle('hidden', $('perfil-tipo').value !== 'mixta');
}

function abrirPerfil() {
  const cuenta = cuentaActual();
  if (!cuenta) return;
  $('perfil-usuario').value = cuenta.usuario;
  $('perfil-email').value = cuenta.email || '';
  $('perfil-perfil').value = usuarioActual.perfil;
  $('perfil-perfil').disabled = true; // ganadero / veterinario se elige al crear la cuenta
  renderVinculosPerfil();
  $('perfil-tipo').value = usuarioActual.tipoExplotacion;
  document.querySelectorAll('input[name="perfil-especie"]').forEach((cb) => {
    cb.checked = usuarioActual.especies.includes(cb.value);
  });
  actualizarPerfilTipo();
  ocultarError($('perfil-error'));
  ocultarError($('perfil-ok'));
  reiniciarCambioPw();
  reiniciarCopia();
  $('perfil-modal').classList.remove('hidden');
  $('perfil-modal').classList.add('flex');
  $('perfil-usuario').focus();
}

function cerrarPerfil() {
  $('perfil-modal').classList.add('hidden');
  $('perfil-modal').classList.remove('flex');
  reiniciarCambioPw();
  reiniciarCopia();
}

/* ---------- Copia de seguridad (exportar / importar JSON) ----------
   Los datos viven solo en el localStorage de este navegador: la copia permite guardarlos fuera y recuperarlos.
   Formato: { app, formato, exportado, cuenta: {usuario, perfil, tipoExplotacion, especies}, datos: {fincas, vacas, bajas} }.
   Nunca incluye el hash de la contraseña. Restaurar SUSTITUYE los datos de la cuenta actual (con confirmación). */
const COPIA_APP = 'gestion-ganadera';
const COPIA_FORMATO = 4; // 2: cebaderos y cebo · 3: economía · 4: pesajes
const COPIA_MAX_BYTES = 25 * 1024 * 1024;
let copiaPendiente = null; // { fincas, vacas, bajas } validados, a la espera de confirmar

// «2 animales activos, 1 baja y 1 finca»
function resumenDatos(f, v, b) {
  const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;
  return `${n(v.length, 'animal activo', 'animales activos')}, ${n(b.length, 'baja', 'bajas')} y ${n(f.length, 'finca', 'fincas')}`;
}

const claveUltimaCopia = () => claveDatos('ultimacopia');

function reiniciarCopia() {
  copiaPendiente = null;
  $('copia-archivo').value = '';
  $('copia-confirmar').classList.add('hidden');
  ocultarError($('copia-error'));
  ocultarError($('copia-ok'));
  if (!usuarioActual) return;
  renderLegado();
  const ultima = cargar(claveUltimaCopia(), null);
  const dias = ultima ? -diasHasta(ultima) : null;
  $('copia-ultima').textContent = ultima
    ? `Última copia descargada: ${formatearFecha(ultima)}${dias > 30 ? ` (hace ${dias} días, conviene hacer otra)` : ''}.`
    : 'Todavía no has descargado ninguna copia desde este navegador.';
}

function exportarCopia() {
  ocultarError($('copia-error'));
  ocultarError($('copia-ok'));
  const copia = {
    app: COPIA_APP,
    formato: COPIA_FORMATO,
    exportado: new Date().toISOString(),
    cuenta: {
      usuario: usuarioActual.usuario,
      perfil: usuarioActual.perfil,
      tipoExplotacion: usuarioActual.tipoExplotacion,
      especies: usuarioActual.especies
    },
    datos: { fincas, vacas, bajas, cebaderos, cebos, economia, pesajes }
  };
  const nombreSeguro = String(usuarioActual.usuario).replace(/[^\p{L}\p{N}_-]+/gu, '_');
  descargarArchivo(`copia-ganaderia-${nombreSeguro}-${hoyISO()}.json`,
    new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json;charset=utf-8' }));
  guardar(claveUltimaCopia(), hoyISO());
  reiniciarCopia();
  mostrarError($('copia-ok'), `Copia descargada: ${resumenDatos(fincas, vacas, bajas)}.`);
}

// Comprueba que el contenido de la copia tiene la forma esperada. Devuelve { fincas, vacas, bajas } o lanza un Error con el motivo.
function validarCopia(obj) {
  const fallo = (m) => { throw new Error(m); };
  const esObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (!esObjeto(obj) || obj.app !== COPIA_APP) fallo('El archivo no es una copia de seguridad de Gestión Ganadera.');
  if (typeof obj.formato !== 'number' || obj.formato > COPIA_FORMATO) {
    fallo('La copia es de una versión más nueva de la aplicación. Actualiza la app para poder restaurarla.');
  }
  const d = obj.datos;
  if (!esObjeto(d)) fallo('La copia no contiene datos.');
  const fincasC = d.fincas, vacasC = d.vacas, bajasC = d.bajas === undefined ? [] : d.bajas;
  if (![fincasC, vacasC, bajasC].every(Array.isArray)) fallo('La copia está dañada: faltan las listas de fincas o animales.');

  const ids = new Set();
  const idUnico = (x, que) => {
    if (!esObjeto(x) || typeof x.id !== 'string' || !x.id) fallo(`La copia está dañada: hay ${que} sin identificador.`);
    if (ids.has(x.id)) fallo(`La copia está dañada: hay identificadores repetidos (${que}).`);
    ids.add(x.id);
  };
  fincasC.forEach((f) => {
    idUnico(f, 'una finca');
    if (typeof f.nombre !== 'string' || !f.nombre.trim()) fallo('La copia está dañada: hay una finca sin nombre.');
  });
  const especiesCuentaActual = especiesCuenta();
  const crotales = new Set();
  [...vacasC, ...bajasC].forEach((a) => {
    idUnico(a, 'un animal');
    if (typeof a.crotal !== 'string' || !a.crotal.trim()) fallo('La copia está dañada: hay un animal sin crotal.');
    if (a.especie !== undefined && !ESPECIES[a.especie]) fallo(`La copia contiene una especie desconocida («${a.especie}»).`);
    if (a.especie && !especiesCuentaActual.includes(a.especie)) {
      fallo(`La copia contiene animales de ${ESPECIES[a.especie].corto.toLowerCase()}, que no está entre las especies de tu cuenta. ` +
        'Añádela en «Datos de la cuenta» y vuelve a intentarlo.');
    }
  });
  vacasC.forEach((a) => {
    const c = a.crotal.trim().toLowerCase();
    if (crotales.has(c)) fallo(`La copia tiene dos animales activos con el mismo crotal («${a.crotal}»).`);
    crotales.add(c);
  });
  bajasC.forEach((b) => { if (!esObjeto(b.baja)) fallo(`La copia está dañada: la baja de «${b.crotal}» no tiene registro de baja.`); });
  // Cebaderos (copias de formato 2 en adelante; las antiguas no los traen)
  const cebaderosC = d.cebaderos === undefined ? [] : d.cebaderos;
  const cebosC = d.cebos === undefined ? [] : d.cebos;
  if (![cebaderosC, cebosC].every(Array.isArray)) fallo('La copia está dañada: la lista de cebaderos no es válida.');
  cebaderosC.forEach((c) => {
    idUnico(c, 'un cebadero');
    if (typeof c.nombre !== 'string' || !c.nombre.trim()) fallo('La copia está dañada: hay un cebadero sin nombre.');
  });
  const idsAnimales = new Set([...vacasC, ...bajasC].map((a) => a.id));
  const idsCeb = new Set(cebaderosC.map((c) => c.id));
  cebosC.forEach((r) => {
    idUnico(r, 'un registro de cebo');
    if (!idsAnimales.has(r.animalId) || !idsCeb.has(r.cebaderoId)) fallo('La copia está dañada: hay un registro de cebo de un animal o cebadero que no existe.');
  });
  const economiaC = d.economia === undefined ? [] : d.economia;
  if (!Array.isArray(economiaC)) fallo('La copia está dañada: la lista de economía no es válida.');
  economiaC.forEach((m) => {
    idUnico(m, 'un movimiento de economía');
    if (m.tipo !== 'gasto' && m.tipo !== 'ingreso') fallo('La copia está dañada: hay un movimiento de economía sin tipo.');
    if (!(Number(m.importe) > 0)) fallo('La copia está dañada: hay un movimiento de economía sin importe.');
    if (m.animalId && !idsAnimales.has(m.animalId)) m.animalId = '';
  });
  const pesajesC = (Array.isArray(d.pesajes) ? d.pesajes : []).filter((x) => x && x.id && idsAnimales.has(x.animalId) && Number(x.peso) > 0);
  return { fincas: fincasC, vacas: vacasC, bajas: bajasC, cebaderos: cebaderosC, cebos: cebosC, economia: economiaC, pesajes: pesajesC };
}

function leerArchivoCopia(archivo) {
  ocultarError($('copia-error'));
  ocultarError($('copia-ok'));
  $('copia-confirmar').classList.add('hidden');
  copiaPendiente = null;
  if (!archivo) return;
  if (archivo.size > COPIA_MAX_BYTES) return mostrarError($('copia-error'), 'El archivo es demasiado grande para ser una copia de esta aplicación.');

  const lector = new FileReader();
  lector.onerror = () => mostrarError($('copia-error'), 'No se pudo leer el archivo.');
  lector.onload = () => {
    let obj;
    try { obj = JSON.parse(String(lector.result).replace(/^﻿/, '')); } catch {
      return mostrarError($('copia-error'), 'El archivo no es un JSON válido.');
    }
    try { copiaPendiente = validarCopia(obj); } catch (err) {
      return mostrarError($('copia-error'), err.message);
    }
    const c = copiaPendiente;
    const fecha = typeof obj.exportado === 'string' ? formatearFecha(obj.exportado.slice(0, 10)) : 'fecha desconocida';
    const origen = obj.cuenta && obj.cuenta.usuario && obj.cuenta.usuario !== usuarioActual.usuario
      ? ` Es de la cuenta «${obj.cuenta.usuario}».` : '';
    $('copia-resumen').textContent =
      `Copia del ${fecha}: ${resumenDatos(c.fincas, c.vacas, c.bajas)}.${origen} ` +
      `Restaurarla SUSTITUIRÁ tus datos actuales (${resumenDatos(fincas, vacas, bajas)}). ` +
      'Si no tienes copia de lo actual, descárgala antes.';
    $('copia-confirmar').classList.remove('hidden');
  };
  lector.readAsText(archivo, 'utf-8');
}

function confirmarRestaurarCopia() {
  if (!copiaPendiente) return;
  const { fincas: f, vacas: v, bajas: b, cebaderos: cb, cebos: ce, economia: ec, pesajes: ps } = window.Nube ? Nube.normalizarIds(copiaPendiente) : copiaPendiente;
  if (!guardarTransaccion([[KEYS.fincas, f], [KEYS.vacas, v], [KEYS.bajas, b], [KEYS.cebaderos, cb], [KEYS.cebos, ce],
    [KEYS.economia, ec || []], [KEYS.pesajes, ps || []]])) return;
  // Recarga desde el almacenamiento: así pasa por la migración de especie y repararIntegridad()
  cargarDatos();
  editVacaId = null;
  editFincaId = null;
  resetFormVaca();
  resetFormFinca();
  renderTodo();
  const reparadas = reparacionesIntegridad;
  reiniciarCopia();
  mostrarError($('copia-ok'), `Copia restaurada: ${resumenDatos(fincas, vacas, bajas)}.` +
    (reparadas ? ` Se corrigieron ${reparadas} ${reparadas === 1 ? 'relación rota' : 'relaciones rotas'}.` : ''));
}

$('copia-exportar').addEventListener('click', exportarCopia);
$('copia-importar').addEventListener('click', () => $('copia-archivo').click());
$('copia-archivo').addEventListener('change', (e) => leerArchivoCopia(e.target.files[0]));
$('copia-confirmar-si').addEventListener('click', confirmarRestaurarCopia);
$('copia-confirmar-no').addEventListener('click', reiniciarCopia);

$('perfil-btn').addEventListener('click', abrirPerfil);
$('perfil-modal-x').addEventListener('click', cerrarPerfil);
$('perfil-modal-cerrar').addEventListener('click', cerrarPerfil);
$('perfil-modal').addEventListener('click', (e) => {
  if (e.target === $('perfil-modal')) cerrarPerfil();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('perfil-modal').classList.contains('hidden')) cerrarPerfil();
});
$('perfil-tipo').addEventListener('change', actualizarPerfilTipo);

$('perfil-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('perfil-error');
  const ok = $('perfil-ok');
  ocultarError(error);
  ocultarError(ok);

  const usuario = $('perfil-usuario').value.trim().replace(/\s+/g, ' ');
  const email = $('perfil-email').value.trim().toLowerCase();
  const tipo = $('perfil-tipo').value;
  const marcadas = [...document.querySelectorAll('input[name="perfil-especie"]:checked')].map((c) => c.value).filter((x) => ESPECIES[x]);

  if (usuario.length < 3 || usuario.length > 30) return mostrarError(error, 'El usuario debe tener entre 3 y 30 caracteres.');
  if (!/^[\p{L}\p{N} ._-]+$/u.test(usuario)) {
    return mostrarError(error, 'El usuario solo puede contener letras, números, espacios, puntos, guiones y guiones bajos.');
  }
  if (!EMAIL_RE.test(email)) return mostrarError(error, 'Escribe un correo electrónico válido.');
  if (!TIPOS_EXPLOTACION[tipo]) return mostrarError(error, 'Selecciona el tipo de explotación.');
  if (tipo === 'mixta' && marcadas.length < 2) return mostrarError(error, 'En una explotación mixta marca al menos dos especies.');
  const especies = tipo === 'mixta' ? Object.keys(ESPECIES).filter((x) => marcadas.includes(x)) : [tipo];

  // Una especie con animales (activos o de baja) no se puede quitar: dejaría esos registros sin estados ni vocabulario
  if (!esVeterinario()) {
    for (const esp of especiesCuenta().filter((x) => !especies.includes(x))) {
      const n = [...vacas, ...bajas].filter((a) => especieDe(a) === esp).length;
      if (n) {
        return mostrarError(error, `No se puede quitar «${ESPECIES[esp].corto}»: hay ${n} ${n === 1 ? 'animal' : 'animales'} de esa especie (activos o dados de baja).`);
      }
    }
  }

  const cambiaPerfil = usuario !== usuarioActual.usuario || tipo !== usuarioActual.tipoExplotacion ||
    especies.join() !== usuarioActual.especies.join();
  const cambiaEmail = email !== (usuarioActual.email || '');
  if (!cambiaPerfil && !cambiaEmail) return mostrarError(error, 'No hay cambios que guardar.');

  const boton = $('perfil-guardar');
  boton.disabled = true;
  try {
    const mensajes = [];
    if (cambiaPerfil) {
      const p = await Nube.actualizarPerfil({ usuario, tipoExplotacion: tipo, especies });
      const conEmail = { ...p, email: usuarioActual.email };
      usuarioActual = datosCuenta(conEmail);
      guardarPerfilLocal(conEmail);
      mensajes.push(`✔ Perfil actualizado: ${usuarioActual.usuario} · ${PERFILES[usuarioActual.perfil]} · ${TIPOS_EXPLOTACION[usuarioActual.tipoExplotacion]}.`);
    }
    if (cambiaEmail) {
      await Nube.cambiarEmail(email);
      mensajes.push(`✉️ Para cambiar el correo a ${email}, abre el enlace de confirmación que te hemos enviado.`);
    }
    aplicarCuenta();
    resetFormVaca();
    renderTodo();
    ok.textContent = mensajes.join(' ');
    ok.classList.remove('hidden');
  } catch (err) {
    mostrarError(error, err.message || 'No se pudo guardar el perfil.');
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Veterinario ↔ ganadero (Mi perfil) ---------- */
function renderVinculosPerfil() {
  const vet = esVeterinario();
  $('vinculos-titulo').textContent = vet ? '🐄 Mis ganaderos' : '🩺 Mis veterinarios';
  $('vinculos-ayuda').textContent = vet
    ? 'Escribe el código que te dé cada ganadero. Verás sus animales y podrás registrar tratamientos y vacunas, pero no cambiar sus datos.'
    : 'Genera un código y dáselo a tu veterinario: podrá ver tus animales y registrar tratamientos y vacunas, pero no cambiar tus datos. Puedes quitarle el acceso cuando quieras.';
  $('invitar-wrap').classList.toggle('hidden', vet);
  $('canjear-form').classList.toggle('hidden', !vet);
  const lista = vinculosCuenta.filter((v) => v.rol === (vet ? 'ganadero' : 'veterinario'));
  $('vinculos-lista').innerHTML = lista.length
    ? lista.map((v) => `
      <div class="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
        <div>
          <p class="font-medium">${esc(v.usuario)}</p>
          ${v.email ? `<p class="text-xs text-stone-500">${esc(v.email)}</p>` : ''}
        </div>
        <button type="button" data-action="quitar-vinculo" data-id="${esc(v.id)}" class="text-red-600 hover:underline text-xs">Quitar</button>
      </div>`).join('')
    : `<p class="text-sm text-stone-500">${vet ? 'Todavía no atiendes a ningún ganadero.' : 'Todavía no has invitado a ningún veterinario.'}</p>`;
  ocultarError($('vinculos-error'));
  ocultarError($('vinculos-ok'));
  $('invitar-codigo-wrap').classList.add('hidden');
}

$('invitar-btn').addEventListener('click', async () => {
  ocultarError($('vinculos-error'));
  const boton = $('invitar-btn');
  boton.disabled = true;
  try {
    $('invitar-codigo').textContent = await Nube.crearInvitacion();
    $('invitar-codigo-wrap').classList.remove('hidden');
  } catch (err) {
    mostrarError($('vinculos-error'), err.message);
  } finally {
    boton.disabled = false;
  }
});

$('invitar-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('invitar-codigo').textContent);
    $('invitar-copiar').textContent = '✔ Copiado';
    setTimeout(() => { $('invitar-copiar').textContent = 'Copiar'; }, 1500);
  } catch { /* sin portapapeles: el código se puede seleccionar a mano */ }
});

$('canjear-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarError($('vinculos-error'));
  ocultarError($('vinculos-ok'));
  const codigo = $('canjear-codigo').value.trim();
  if (!/^[0-9A-Fa-f]{5}-?[0-9A-Fa-f]{5}$/.test(codigo)) {
    return mostrarError($('vinculos-error'), 'El código tiene 10 caracteres, por ejemplo A1B2C-3D4E5.');
  }
  const boton = $('canjear-btn');
  boton.disabled = true;
  try {
    const ganaderoId = await Nube.canjearInvitacion(codigo);
    $('canjear-codigo').value = '';
    await cargarVinculos();
    renderVinculosPerfil();
    const g = vinculosCuenta.find((v) => v.id === ganaderoId);
    mostrarError($('vinculos-ok'), `✔ Ya atiendes a ${g ? g.usuario : 'este ganadero'}. Lo puedes elegir arriba, junto a tu nombre.`);
    await cambiarGanadero(ganaderoId);
  } catch (err) {
    mostrarError($('vinculos-error'), err.message);
  } finally {
    boton.disabled = false;
  }
});

$('vinculos-lista').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="quitar-vinculo"]');
  if (!btn) return;
  const v = vinculosCuenta.find((x) => x.id === btn.dataset.id);
  if (!v) return;
  const texto = esVeterinario()
    ? `¿Dejar de atender a ${v.usuario}? Ya no verás sus animales.`
    : `¿Quitar el acceso de ${v.usuario}? Dejará de ver tus animales.`;
  if (!confirm(texto)) return;
  try {
    const eraVista = ganaderoVista && ganaderoVista.id === v.id;
    await Nube.desvincular(v.id);
    await cargarVinculos();
    renderVinculosPerfil();
    if (esVeterinario() && eraVista) await cambiarGanadero(ganaderoVista ? ganaderoVista.id : '');
  } catch (err) {
    mostrarError($('vinculos-error'), err.message);
  }
});

/* ---------- Datos de la versión anterior (guardados solo en este navegador) ---------- */
function cuentasLegado() {
  return leerUsuarios().filter((u) => u && u.id).map((u) => {
    const leer = (t) => {
      try { const x = JSON.parse(localStorage.getItem(`gg_${t}_${u.id}`) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
    };
    const datos = { fincas: leer('fincas'), vacas: leer('vacas'), bajas: leer('bajas'), cebaderos: leer('cebaderos'), cebos: leer('cebos'), economia: leer('economia'), pesajes: leer('pesajes') };
    return { cuenta: u, datos, total: datos.fincas.length + datos.vacas.length + datos.bajas.length + datos.cebaderos.length };
  }).filter((x) => x.total > 0);
}

function renderLegado() {
  const lista = esVeterinario() ? [] : cuentasLegado();
  $('legado-wrap').classList.toggle('hidden', !lista.length);
  $('legado-cuenta').innerHTML = lista.map((x) =>
    `<option value="${esc(x.cuenta.id)}">${esc(x.cuenta.usuario)} · ${esc(resumenDatos(x.datos.fincas, x.datos.vacas, x.datos.bajas))}</option>`).join('');
}

$('legado-importar').addEventListener('click', () => {
  ocultarError($('copia-error'));
  ocultarError($('copia-ok'));
  const x = cuentasLegado().find((c) => c.cuenta.id === $('legado-cuenta').value);
  if (!x) return;
  try {
    copiaPendiente = validarCopia({ app: COPIA_APP, formato: COPIA_FORMATO, datos: x.datos });
  } catch (err) {
    copiaPendiente = null;
    return mostrarError($('copia-error'), err.message);
  }
  const c = copiaPendiente;
  $('copia-resumen').textContent =
    `Datos de «${x.cuenta.usuario}» guardados en este navegador: ${resumenDatos(c.fincas, c.vacas, c.bajas)}. ` +
    `Subirlos SUSTITUIRÁ lo que tienes ahora en tu cuenta (${resumenDatos(fincas, vacas, bajas)}).`;
  $('copia-confirmar').classList.remove('hidden');
});

/* ---------- Cambio de contraseña ---------- */
function reiniciarCambioPw() {
  $('pw-form').reset();
  ['pw-actual', 'pw-nueva', 'pw-nueva2'].forEach((id) => { $(id).disabled = false; });
  $('pw-paso-codigo').classList.add('hidden');
  $('pw-submit').textContent = 'Cambiar contraseña';
  $('pw-submit').disabled = false;
  $('pw-cancelar').classList.add('hidden');
  ocultarError($('pw-error'));
  ocultarError($('pw-ok'));
}

$('pw-cancelar').addEventListener('click', reiniciarCambioPw);

$('pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('pw-error');
  ocultarError(error);
  ocultarError($('pw-ok'));
  const actual = $('pw-actual').value;
  const nueva = $('pw-nueva').value;
  const nueva2 = $('pw-nueva2').value;
  if (!actual) return mostrarError(error, 'Escribe tu contraseña actual.');
  if (nueva.length < 6) return mostrarError(error, 'La nueva contraseña debe tener al menos 6 caracteres.');
  if (nueva !== nueva2) return mostrarError(error, 'Las contraseñas nuevas no coinciden.');
  if (nueva === actual) return mostrarError(error, 'La nueva contraseña debe ser distinta de la actual.');
  const boton = $('pw-submit');
  boton.disabled = true;
  try {
    await Nube.cambiarPassword(usuarioActual.email, actual, nueva);
    reiniciarCambioPw();
    const ok = $('pw-ok');
    ok.textContent = '✔ Contraseña cambiada. La próxima vez que inicies sesión usa la nueva.';
    ok.classList.remove('hidden');
  } catch (err) {
    mostrarError(error, err.message || 'No se pudo cambiar la contraseña.');
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Pestañas ---------- */
function cambiarTab(nombre) {
  if (esVeterinario() && (nombre === 'fincas' || nombre === 'cebaderos' || nombre === 'economia')) nombre = 'vacas';
  ['vacas', 'fincas', 'cebaderos', 'economia', 'bajas'].forEach((t) => {
    $('tab-' + t).classList.toggle('hidden', t !== nombre);
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const activo = btn.dataset.tab === nombre;
    btn.classList.toggle('bg-stone-100', activo);
    btn.classList.toggle('text-green-900', activo);
    btn.classList.toggle('text-green-100', !activo);
    btn.classList.toggle('hover:bg-green-700', !activo);
  });

  if (nombre === 'fincas') {
    initMapa();
    // El mapa estaba oculto: recalcula su tamaño al mostrarse
    setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 60);
  }
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
});

/* ============================================================
   MAPA
   ============================================================ */
function iconoPunto() {
  return L.divIcon({
    className: '',
    html: '<div style="font-size:26px;line-height:26px;text-shadow:0 1px 3px rgba(0,0,0,.8)">📍</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24]
  });
}

function initMapa() {
  if (mapa) return;

  if (typeof L === 'undefined') {
    $('mapa').innerHTML =
      '<p class="p-6 text-sm text-red-600">No se pudo cargar Leaflet. Comprueba tu conexión a internet.</p>';
    return;
  }

  mapa = L.map('mapa', { center: [40.2, -3.7], zoom: 6, maxZoom: 20 });

  const satelite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 20,
      maxNativeZoom: 18,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  );

  const etiquetas = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, maxNativeZoom: 18, attribution: '&copy; Esri' }
  );

  const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: '&copy; Colaboradores de OpenStreetMap'
  });

  satelite.addTo(mapa);
  etiquetas.addTo(mapa);

  L.control.layers(
    { 'Satélite (Esri)': satelite, 'Callejero (OSM)': calles },
    { 'Nombres y límites': etiquetas }
  ).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);

  capaFincas = L.featureGroup().addTo(mapa);
  capaDibujo = L.featureGroup().addTo(mapa);

  if (L.Control && L.Control.Draw) {
    mapa.addControl(new L.Control.Draw({
      position: 'topleft',
      draw: {
        // showArea:false evita un fallo conocido de Leaflet.draw 1.0.4
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: ESTILO_DIBUJO,
          drawError: { color: '#e11d48', message: 'Los lados no pueden cruzarse' }
        },
        rectangle: { showArea: false, shapeOptions: ESTILO_DIBUJO },
        marker: { icon: iconoPunto() },
        polyline: false,
        circle: false,
        circlemarker: false
      },
      edit: { featureGroup: capaDibujo, remove: true }
    }));

    mapa.on(L.Draw.Event.CREATED, (e) => {
      const esPunto = e.layerType === 'marker';
      // Solo se guarda un polígono y/o un punto por finca
      capaDibujo.eachLayer((l) => {
        const mismoTipo = esPunto ? l instanceof L.Marker : l instanceof L.Polygon;
        if (mismoTipo) capaDibujo.removeLayer(l);
      });
      capaDibujo.addLayer(e.layer);
      sincronizarGeometria();
    });
    mapa.on(L.Draw.Event.EDITED, sincronizarGeometria);
    mapa.on(L.Draw.Event.DELETED, sincronizarGeometria);
  }

  // El botón "Ver lote" vive dentro del popup de Leaflet, que se recrea al abrirse
  mapa.on('popupopen', (e) => {
    const el = e.popup.getElement();
    if (!el) return;
    el.querySelectorAll('[data-action="ver-lote"]').forEach((b) => {
      b.addEventListener('click', () => abrirModalLote(b.dataset.lote));
    });
  });

  renderMapaFincas(true);
}

function sincronizarGeometria() {
  if (!capaDibujo) return;
  let poligono = null;
  let punto = null;

  capaDibujo.eachLayer((l) => {
    if (l instanceof L.Polygon) {
      const ll = l.getLatLngs();
      const anillo = Array.isArray(ll[0]) ? ll[0] : ll;
      poligono = anillo.map((p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)]);
    } else if (l instanceof L.Marker) {
      const p = l.getLatLng();
      punto = [+p.lat.toFixed(6), +p.lng.toFixed(6)];
    }
  });

  geomForm = { poligono, punto };
  if (poligono) $('finca-hectareas').value = areaHectareas(poligono).toFixed(2);
  actualizarEstadoGeom();
}

function actualizarEstadoGeom() {
  const partes = [];
  if (geomForm.poligono) partes.push(`Límite dibujado (${areaHectareas(geomForm.poligono).toFixed(2)} ha)`);
  if (geomForm.punto) partes.push(`Punto marcado (${geomForm.punto[0]}, ${geomForm.punto[1]})`);
  $('geom-estado').textContent = partes.length ? partes.join(' · ') : 'Sin ubicación en el mapa';
}

function popupFinca(f) {
  const lista = vacas.filter((v) => v.fincaId === f.id);
  const resumen = ESTADOS
    .map((e) => [e, lista.filter((v) => v.estado === e).length])
    .filter(([, c]) => c > 0)
    .map(([e, c]) => `${esc(e)}: ${c}`)
    .join(' · ');
  const max = 12;
  const nLote = f.lote ? vacasDeLote(f.lote).length : 0;
  const items = lista.slice(0, max).map((v) =>
    `<li>${esc(v.crotal)}${v.nombre ? ' · ' + esc(v.nombre) : ''} <em>(${esc(v.estado)})</em></li>`
  ).join('');

  return `
    <div style="min-width:210px">
      <strong style="font-size:15px">${esc(f.nombre)}</strong><br>
      <span style="color:#57534e">${esc(f.ubicacion) || 'Sin ubicación'} · ${esc(textoHectareas(f))}</span>
      <div style="margin-top:6px">🏷️ <strong>Lote:</strong> ${f.lote ? esc(f.lote) : '<em>Sin lote asignado</em>'}</div>
      <hr style="margin:6px 0">
      <strong>${lista.length}</strong> ${lista.length === 1 ? esc(vocab().animal) : esc(vocab().animales)}
      ${resumen ? `<br><small>${resumen}</small>` : ''}
      ${items ? `<ul style="margin:6px 0 0 16px;padding:0;list-style:disc">${items}</ul>` : ''}
      ${lista.length > max ? `<small>…y ${lista.length - max} más</small>` : ''}
      ${f.lote ? `
        <div style="margin-top:8px">
          <small style="color:#57534e">${nLote} ${nLote === 1 ? esc(vocab().animal) : esc(vocab().animales)} en este lote</small><br>
          <button type="button" data-action="ver-lote" data-lote="${esc(f.lote)}"
            style="margin-top:4px;background:#15803d;color:#fff;border:0;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">
            Ver lote
          </button>
        </div>` : ''}
    </div>`;
}

function renderMapaFincas(ajustar) {
  if (!mapa) return;
  capaFincas.clearLayers();
  capasPorFinca = {};

  fincas.forEach((f) => {
    if (f.id === editFincaId) return; // la finca en edición se muestra en la capa de dibujo
    const color = colorFinca(f.id);
    const n = vacas.filter((v) => v.fincaId === f.id).length;
    const etiqueta = esc(`${f.nombre} · ${n} ${vocab().emoji}`);
    let principal = null;

    if (f.poligono && f.poligono.length >= 3) {
      const poly = L.polygon(f.poligono, { color, weight: 3, fillColor: color, fillOpacity: 0.25 }).addTo(capaFincas);
      poly.bindPopup(popupFinca(f), { maxWidth: 300 });
      poly.bindTooltip(etiqueta, { permanent: true, direction: 'center', className: 'tooltip-finca' });
      principal = poly;
    }

    if (f.punto) {
      const m = L.marker(f.punto, { icon: iconoPunto() }).addTo(capaFincas);
      m.bindPopup(popupFinca(f), { maxWidth: 300 });
      if (!principal) {
        m.bindTooltip(etiqueta, { permanent: true, direction: 'top', offset: [0, -26], className: 'tooltip-finca' });
        principal = m;
      }
    }

    if (principal) capasPorFinca[f.id] = principal;
  });

  if (ajustar) ajustarVista();
}

function ajustarVista() {
  if (!mapa || !capaFincas.getLayers().length) return;
  try {
    mapa.fitBounds(capaFincas.getBounds().pad(0.15), { maxZoom: 17 });
  } catch { /* sin geometrías válidas */ }
}

function enfocarFinca(id, desplazar) {
  const capa = capasPorFinca[id];
  if (!mapa || !capa) return;
  if (desplazar) $('mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (capa.getBounds) mapa.flyToBounds(capa.getBounds().pad(0.3), { maxZoom: 18 });
  else mapa.flyTo(capa.getLatLng(), 17);
  setTimeout(() => capa.openPopup(), 900);
}

$('btn-ver-todas').addEventListener('click', ajustarVista);

/* ---------- Render de listas ---------- */
function nombreFinca(id) {
  const f = fincas.find((x) => x.id === id);
  return f ? f.nombre : null;
}

function renderSelectsEstado() {
  $('filtro-estado').innerHTML =
    '<option value="">Todos los estados</option>' +
    ESTADOS.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
}

function renderSelectsFinca() {
  const valorForm = $('vaca-finca').value;
  $('vaca-finca').innerHTML =
    '<option value="">Sin finca</option>' +
    fincas.map((f) => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('');
  if (valorForm && fincas.some((f) => f.id === valorForm)) $('vaca-finca').value = valorForm;

  const actual = $('filtro-finca').value;
  $('filtro-finca').innerHTML =
    '<option value="">Todas las localizaciones</option>' +
    '<option value="__cebo__">En cebadero</option>' +
    '<option value="__none__">Sin localización</option>' +
    fincas.map((f) => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('');
  if ([...$('filtro-finca').options].some((o) => o.value === actual)) {
    $('filtro-finca').value = actual;
  }
}

function renderSelectsLote() {
  const lotes = lotesConocidos();
  $('lotes-list').innerHTML = lotes.map((l) => `<option value="${esc(l)}"></option>`).join('');

  const actual = $('filtro-lote').value;
  $('filtro-lote').innerHTML =
    '<option value="">Todos los lotes</option>' +
    '<option value="__none__">Sin lote</option>' +
    lotes.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  if ([...$('filtro-lote').options].some((o) => o.value === actual)) {
    $('filtro-lote').value = actual;
  }
}

function renderStats() {
  $('stat-vacas').textContent = vacas.length;
  $('stat-fincas').textContent = fincas.length;
  // Los terneros en un cebadero tienen localización aunque no estén en una finca
  $('stat-sin-finca').textContent = vacas.filter((v) => !nombreFinca(v.fincaId) && !ceboAbiertoDe(v.id)).length;
}

/* ---------- Localización ----------
   Un animal está en UNA finca (con su lote) o en UN cebadero, nunca en los dos a la vez. */
function localizacionTexto(v) {
  const r = ceboAbiertoDe(v.id);
  if (r) return `Cebadero ${nombreCebadero(r.cebaderoId)}`;
  return nombreFinca(v.fincaId) || '';
}

function celdaLocalizacion(v) {
  const r = ceboAbiertoDe(v.id);
  if (r) {
    return `<span class="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs" title="En el cebadero desde el ${formatearFecha(r.entrada)}">🐂 ${esc(nombreCebadero(r.cebaderoId))}</span>`;
  }
  const finca = nombreFinca(v.fincaId);
  return finca ? `🌾 ${esc(finca)}` : '<span class="text-stone-400">Sin localización</span>';
}

function vacasFiltradas() {
  const texto = $('buscar-vaca').value.trim().toLowerCase();
  // El veterinario no filtra por localización; el filtro de lotes ya no existe en el listado
  const filtroFinca = esVeterinario() ? '' : $('filtro-finca').value;
  const filtroEstado = $('filtro-estado').value;

  const lista = vacas.filter((v) => {
    const coincideTexto =
      !texto ||
      [v.crotal, v.nombre, v.raza, v.lote].some((c) => String(c || '').toLowerCase().includes(texto));
    let coincideFinca = true;
    if (filtroFinca === '__none__') coincideFinca = !nombreFinca(v.fincaId) && !ceboAbiertoDe(v.id);
    else if (filtroFinca === '__cebo__') coincideFinca = !!ceboAbiertoDe(v.id);
    else if (filtroFinca) coincideFinca = v.fincaId === filtroFinca;
    const coincideEstado = !filtroEstado || v.estado === filtroEstado;
    return coincideTexto && coincideFinca && coincideEstado;
  });
  // Orden por edad: los animales sin fecha de nacimiento van siempre al final
  const orden = $('orden-vacas').value;
  if (orden === 'edad-desc' || orden === 'edad-asc') {
    const signo = orden === 'edad-desc' ? 1 : -1; // mayor edad = nacimiento más antiguo
    lista.sort((a, b) => {
      if (!a.nacimiento || !b.nacimiento) return (!a.nacimiento) - (!b.nacimiento);
      return signo * a.nacimiento.localeCompare(b.nacimiento);
    });
  }
  return lista;
}

function renderVacas() {
  const lista = vacasFiltradas();

  $('vacas-body').innerHTML = lista
    .map((v) => {
      const finca = nombreFinca(v.fincaId);
      const clase = ESTADO_CLASE[v.estado] || 'bg-stone-100 text-stone-700';
      return `
        <tr data-action="ver-ficha" data-id="${esc(v.id)}" class="border-b last:border-0 hover:bg-stone-50 cursor-pointer ${v.id === editVacaId ? 'bg-amber-50' : ''}">
          <td class="py-2 pr-4 font-mono">
            <button data-action="ver-ficha" data-id="${esc(v.id)}" class="text-green-800 hover:underline" title="Ver ficha y genealogía">${esMixta() ? emojiAnimal(v) + ' ' : ''}${esc(v.crotal)}</button>
          </td>
          <td class="py-2 pr-4">${esc(v.nombre) || '—'}</td>
          <td class="py-2 pr-4 whitespace-nowrap" title="${SEXOS[sexoDe(v)]}">${SIMBOLO_SEXO[sexoDe(v)]} ${SEXOS[sexoDe(v)]}</td>
          <td class="py-2 pr-4">${esc(v.raza) || '—'}</td>
          <td class="py-2 pr-4">${formatearFecha(v.nacimiento)}</td>
          <td class="py-2 pr-4 col-ubicacion">${celdaLocalizacion(v)}</td>
          <td class="py-2 pr-4 col-ubicacion">${v.lote ? esc(v.lote) : '<span class="text-stone-400">Sin lote</span>'}</td>
          <td class="py-2 pr-4">${celdaMadre(v)}</td>
          <td class="py-2 pr-4">${celdaCrias(v)}</td>
          <td class="py-2 pr-4">${celdaSanidad(v)}</td>
          <td class="py-2 pr-4">
            <span class="inline-block rounded-full ${clase} px-2 py-0.5 text-xs">${esc(v.estado)}</span>
          </td>
          <td class="py-2 text-right whitespace-nowrap">
            <button data-action="ver-ficha" data-id="${esc(v.id)}"
              class="text-green-700 hover:text-green-900 hover:underline text-sm mr-3">Ficha</button>
            <button data-action="ver-arbol" data-id="${esc(v.id)}"
              class="text-amber-700 hover:text-amber-900 hover:underline text-sm mr-3">Árbol</button>
            <button data-action="edit-vaca" data-id="${esc(v.id)}"
              class="text-blue-600 hover:text-blue-800 hover:underline text-sm mr-3">Editar</button>
            <button data-action="baja-vaca" data-id="${esc(v.id)}"
              class="text-red-600 hover:text-red-800 hover:underline text-sm">Dar de baja</button>
          </td>
        </tr>`;
    })
    .join('');

  $('vacas-empty').classList.toggle('hidden', lista.length > 0);
}

// Búsqueda sin distinguir mayúsculas ni tildes («la vega» encuentra «La Vega», «fonte» encuentra «Fonté»)
const normTexto = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function fincasFiltradas() {
  const q = normTexto($('buscar-finca').value);
  return q ? fincas.filter((f) => normTexto(f.nombre).includes(q) || normTexto(f.ubicacion).includes(q)) : fincas;
}

// Lleva a una finca: centra el mapa en ella (si está dibujada) y resalta su tarjeta
function irAFinca(id) {
  const f = fincas.find((x) => x.id === id);
  if (!f) return;
  initMapa();
  if (capasPorFinca[id]) enfocarFinca(id, true);
  const tarjeta = document.querySelector(`[data-finca-card="${CSS.escape(id)}"]`);
  if (tarjeta) {
    if (!capasPorFinca[id]) tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tarjeta.classList.add('ring-4', 'ring-green-500');
    setTimeout(() => tarjeta.classList.remove('ring-4', 'ring-green-500'), 2500);
  }
}

function buscarYIrAFinca() {
  const q = normTexto($('buscar-finca').value);
  if (!q) return;
  const exacta = fincas.find((f) => normTexto(f.nombre) === q);
  const lista = fincasFiltradas();
  const destino = exacta || (lista.length === 1 ? lista[0] : null);
  $('buscar-finca-hint').textContent = destino ? '' : (lista.length ? `${lista.length} fincas coinciden: elige una de la lista.` : 'Ninguna finca se llama así.');
  if (destino) irAFinca(destino.id);
}

function renderFincas() {
  $('fincas-nombres').innerHTML = fincas.map((f) => `<option value="${esc(f.nombre)}"></option>`).join('');
  const visibles = fincasFiltradas();
  $('fincas-grid').innerHTML = visibles
    .map((f) => {
      const numVacas = vacas.filter((v) => v.id && v.fincaId === f.id).length;
      const tieneGeom = !!((f.poligono && f.poligono.length >= 3) || f.punto);
      return `
        <article data-finca-card="${esc(f.id)}" class="bg-white rounded-xl shadow p-5 flex flex-col gap-2 transition ${f.id === editFincaId ? 'ring-2 ring-amber-400' : ''}">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-lg" style="color:${colorFinca(f.id)}">🌾 ${esc(f.nombre)}</h3>
            <div class="whitespace-nowrap">
              <button data-action="edit-finca" data-id="${esc(f.id)}"
                class="text-blue-600 hover:text-blue-800 hover:underline text-sm mr-2">Editar</button>
              <button data-action="del-finca" data-id="${esc(f.id)}"
                class="text-red-600 hover:text-red-800 hover:underline text-sm">Eliminar</button>
            </div>
          </div>
          <p class="text-sm text-stone-600">📍 ${esc(f.ubicacion) || 'Sin ubicación'}</p>
          <p class="text-sm text-stone-600">📐 ${esc(textoHectareas(f))}</p>
          <p class="text-sm text-stone-600">🏷️ Lote: ${f.lote ? `<span class="font-semibold text-stone-800">${esc(f.lote)}</span>` : '<span class="text-stone-400">Sin lote</span>'}</p>
          <p class="text-sm"><span class="font-semibold">${numVacas}</span> ${numVacas === 1 ? vocab().animal : vocab().animales}</p>
          <div class="flex flex-wrap gap-2 mt-1">
            ${tieneGeom
              ? `<button data-action="ver-mapa" data-id="${esc(f.id)}"
                   class="text-xs bg-green-100 hover:bg-green-200 text-green-900 rounded-lg px-3 py-1.5 transition">Ver en el mapa</button>`
              : '<span class="text-xs text-stone-400 py-1.5">Sin dibujar en el mapa</span>'}
            <button data-action="ver-vacas" data-id="${esc(f.id)}"
              class="text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg px-3 py-1.5 transition">Ver ${esc(vocab().animales)}</button>
            ${f.lote
              ? `<button data-action="ver-lote" data-id="${esc(f.id)}"
                   class="text-xs bg-green-700 hover:bg-green-800 text-white rounded-lg px-3 py-1.5 transition">Ver lote</button>`
              : ''}
          </div>
        </article>`;
    })
    .join('');

  $('fincas-empty').classList.toggle('hidden', visibles.length > 0);
  $('fincas-empty').textContent = fincas.length ? 'Ninguna finca coincide con la búsqueda.' : 'Aún no has añadido ninguna finca.';
}

$('buscar-finca').addEventListener('input', () => {
  $('buscar-finca-hint').textContent = '';
  renderFincas();
  // Al elegir un nombre de la lista de sugerencias se va directamente a esa finca
  const q = normTexto($('buscar-finca').value);
  const exacta = q && fincas.find((f) => normTexto(f.nombre) === q);
  if (exacta) irAFinca(exacta.id);
});
$('buscar-finca').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); buscarYIrAFinca(); }
});
$('buscar-finca-ir').addEventListener('click', buscarYIrAFinca);

/* ---------- Lotes exclusivos por finca ----------
   Cada lote pertenece a UNA sola finca (el que se asigna al registrar o editar la finca).
   Un animal con lote solo puede estar asignado a la finca de ese lote. */
function lotesDeFincas() {
  const unicos = new Map();
  fincas.forEach((f) => {
    const nombre = String(f.lote ?? '').trim();
    const clave = normLote(nombre);
    if (clave && !unicos.has(clave)) unicos.set(clave, nombre);
  });
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function renderSelectLoteForm(valor) {
  const actual = valor !== undefined ? valor : $('vaca-lote').value;
  const lotes = lotesDeFincas();
  let html = '<option value="">Sin lote</option>' + lotes.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  if (normLote(actual) && !lotes.some((l) => normLote(l) === normLote(actual))) {
    html += `<option value="${esc(actual)}">${esc(actual)} (sin finca asignada)</option>`;
  }
  $('vaca-lote').innerHTML = html;
  const op = [...$('vaca-lote').options].find((o) => normLote(o.value) === normLote(actual));
  $('vaca-lote').value = op ? op.value : '';
  actualizarHintLote();
}

function actualizarHintLote() {
  const el = $('vaca-lote-hint');
  const lote = $('vaca-lote').value;
  const propietarias = fincasDeLote(lote);
  el.classList.remove('text-red-600');
  el.classList.add('text-stone-500');
  if (!normLote(lote)) {
    el.textContent = fincas.some((f) => normLote(f.lote))
      ? 'Los lotes pertenecen a una finca: al elegir uno se asigna su finca.'
      : 'Aún no hay lotes: se crean al asignarlos a una finca en «Fincas y mapa».';
    return;
  }
  if (!propietarias.length) {
    el.textContent = '⚠ Este lote no está asignado a ninguna finca; asígnalo antes en «Fincas y mapa».';
  } else if (!propietarias.some((f) => f.id === $('vaca-finca').value)) {
    el.textContent = `⚠ El lote pertenece a la finca «${propietarias[0].nombre}»: el animal solo puede estar en esa finca.`;
  } else {
    el.textContent = `Lote de la finca «${propietarias[0].nombre}».`;
    el.classList.remove('text-stone-500');
    return;
  }
  el.classList.remove('text-stone-500');
  el.classList.add('text-red-600');
}

const sexoForm = () => ($('vaca-sexo').value === 'M' ? 'M' : 'H');

// Rellena «Estado» con los estados de la especie y sexo del formulario. Si se cambia el sexo de una cría
// (Ternera ↔ Ternero), mantiene el estado equivalente.
function renderEstadosForm() {
  const esp = especieForm();
  const sexo = sexoForm();
  const estados = estadosDe(esp, sexo);
  const previo = $('vaca-estado').value;
  const crias = Object.values(ESPECIES[esp].estadoCria);
  $('vaca-estado').innerHTML = estados.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  if (estados.includes(previo)) $('vaca-estado').value = previo;
  else if (crias.includes(previo)) $('vaca-estado').value = ESPECIES[esp].estadoCria[sexo];
  else $('vaca-estado').value = estados[0];
}

function alCambiarSexo() {
  renderEstadosForm();
  actualizarVisibilidadGestacion();
}

// Cambia la especie del formulario: estados, razas y madres posibles
function alCambiarEspecie() {
  const esp = especieForm();
  renderEstadosForm();
  $('razas').innerHTML = ESPECIES[esp].razas.map((r) => `<option value="${esc(r)}"></option>`).join('');
  renderSelectMadre();
  renderSelectPadre();
  actualizarVisibilidadGestacion();
}

function renderTodo() {
  renderSelectsFinca();
  renderSelectsLote();
  renderSelectLoteForm();
  renderSelectMadre();
  renderSelectPadre();
  renderCriasForm();
  renderAgenda();
  renderPartos();
  renderBajas();
  renderCebaderos();
  renderEconomia();
  renderAvisos();
  renderSelectLibro();
  renderStats();
  renderVacas();
  renderFincas();
  renderMapaFincas(false);
}

/* ============================================================
   VACAS: añadir / editar / eliminar
   ============================================================ */
function resetFormVaca() {
  editVacaId = null;
  $('vaca-form').reset();
  ocultarError($('vaca-error'));
  $('vaca-form-title').textContent = `Añadir ${vocab().animal}`;
  $('vaca-submit').textContent = `Añadir ${vocab().animal}`;
  $('vaca-cancel').classList.add('hidden');
  $('vaca-editando').classList.add('hidden');
  $('vaca-especie').disabled = false;
  $('vaca-finca').disabled = false;
  $('vaca-lote').disabled = false;
  $('vaca-finca').title = '';
  $('vaca-sexo').value = 'H';
  alCambiarEspecie();
  renderSelectMadre('');
  renderSelectPadre('', '');
  renderSelectLoteForm('');
  renderCriasForm();
  ocultarAvisoVaca();
  resetCamposReproduccion();
}

function iniciarEdicionVaca(id) {
  const v = vacas.find((x) => x.id === id);
  if (!v) return;
  editVacaId = id;

  $('vaca-crotal').value = v.crotal || '';
  $('vaca-nombre').value = v.nombre || '';
  $('vaca-raza').value = v.raza || '';
  $('vaca-nacimiento').value = v.nacimiento || '';
  $('vaca-finca').value = v.fincaId || '';
  $('vaca-especie').value = especieDe(v);
  $('vaca-especie').disabled = true; // la especie no se cambia al editar (protege la genealogía)
  $('vaca-sexo').value = sexoDe(v);
  alCambiarEspecie();
  renderSelectLoteForm(v.lote || '');
  const estadosEsp = estadosDe(especieDe(v), sexoDe(v));
  $('vaca-estado').value = estadosEsp.includes(v.estado) ? v.estado : estadosEsp[0];
  renderSelectMadre(v.madreId || '');
  renderSelectPadre(v.padreId || '', v.padreExterno || '');
  const enCebo = ceboAbiertoDe(v.id);
  $('vaca-finca').disabled = !!enCebo;
  $('vaca-lote').disabled = !!enCebo;
  $('vaca-finca').title = enCebo ? `En el cebadero «${nombreCebadero(enCebo.cebaderoId)}»` : '';
  renderCriasForm();
  ocultarAvisoVaca();

  // Gestación y movimientos
  $('vaca-cubricion').value = v.fechaCubricion || '';
  $('vaca-parto').value = v.fechaParto || '';
  $('vaca-parto').dataset.auto = partoCalculado(v.fechaCubricion, especieDe(v));
  actualizarVisibilidadGestacion();
  origenMov = { fincaId: v.fincaId || '', lote: v.lote || '' };
  $('vaca-fecha-mov').value = hoyISO();
  actualizarMovimientoForm();

  ocultarError($('vaca-error'));
  $('vaca-form-title').textContent = `Editar ${vocab().animal} ${v.crotal}`;
  $('vaca-submit').textContent = 'Guardar cambios';
  $('vaca-cancel').classList.remove('hidden');
  $('vaca-editando').classList.remove('hidden');

  renderVacas();
  $('vaca-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('vaca-crotal').focus();
}

$('vaca-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('vaca-error');
  ocultarError(error);

  const crotal = $('vaca-crotal').value.trim().replace(/\s+/g, ' ');
  const errCampos = validarCamposAnimal({
    crotal,
    nombre: $('vaca-nombre').value.trim(),
    raza: $('vaca-raza').value.trim(),
    nacimiento: $('vaca-nacimiento').value,
    estado: $('vaca-estado').value,
    especie: especieForm(),
    sexo: sexoForm(),
    lote: $('vaca-lote').value.trim()
  }, editVacaId);
  if (errCampos) return mostrarError(error, errCampos);

  // --- Validación genealógica ---
  const madreId = $('vaca-madre').value;
  const nacimiento = $('vaca-nacimiento').value;
  const estado = $('vaca-estado').value;

  if (madreId) {
    const madre = vacaPorId(madreId);
    if (!madre) return mostrarError(error, 'La madre seleccionada ya no existe.');
    if (especieDe(madre) !== especieForm()) return mostrarError(error, 'La madre debe ser de la misma especie que la cría.');
    if (editVacaId && esDescendienteDe(madre.id, editVacaId)) {
      return mostrarError(error, 'Un animal no puede ser su propia madre ni la madre de una de sus ascendientes.');
    }
    if (nacimiento && madre.nacimiento && madre.nacimiento >= nacimiento) {
      return mostrarError(error, `La madre (${etiquetaVaca(madre)}) debe haber nacido antes que la cría.`);
    }
  }
  // --- Padre ---
  const valorPadre = $('vaca-padre').value;
  const padreId = valorPadre && valorPadre !== PADRE_EXTERNO ? valorPadre : '';
  const padreExterno = valorPadre === PADRE_EXTERNO ? $('vaca-padre-externo').value.trim().replace(/\s+/g, ' ') : '';
  if (valorPadre === PADRE_EXTERNO && !padreExterno) return mostrarError(error, 'Indica la pajuela o el nombre del padre externo.');
  if (padreExterno.length > 120) return mostrarError(error, 'El padre externo no puede superar los 120 caracteres.');
  if (padreId) {
    const padre = vacaAnyPorId(padreId);
    if (!padre) return mostrarError(error, 'El padre seleccionado ya no existe.');
    if (especieDe(padre) !== especieForm()) return mostrarError(error, 'El padre debe ser de la misma especie que la cría.');
    if (!esMachoReproductor(padre)) return mostrarError(error, `${etiquetaVaca(padre)} no está registrado como macho reproductor.`);
    if (editVacaId && esDescendienteDe(padre.id, editVacaId)) {
      return mostrarError(error, 'Un animal no puede ser su propio padre ni el padre de uno de sus ascendientes.');
    }
    if (nacimiento && padre.nacimiento && padre.nacimiento >= nacimiento) {
      return mostrarError(error, `El padre (${etiquetaVaca(padre)}) debe haber nacido antes que la cría.`);
    }
  }
  if (editVacaId) {
    const hijosP = hijosDePadre(editVacaId);
    if (hijosP.length && !esMachoReproductor({ especie: especieForm(), estado, sexo: sexoForm() })) {
      return mostrarError(error, `Este animal es padre de ${hijosP.length} ${hijosP.length === 1 ? 'animal' : 'animales'}: debe seguir siendo macho y no puede pasar a «${estado}».`);
    }
    const incoherenteP = nacimiento && hijosP.find((c) => c.nacimiento && c.nacimiento <= nacimiento);
    if (incoherenteP) return mostrarError(error, `${etiquetaVaca(incoherenteP)} nació antes o el mismo día que su padre.`);
  }
  if (editVacaId) {
    const crias = criasDe(editVacaId);
    if (crias.length && noPuedeSerMadre({ especie: especieForm(), estado, sexo: sexoForm() })) {
      return mostrarError(error, sexoForm() === 'M' ? 'Este animal tiene crías registradas como madre: no puede ser macho.'
        : `Un animal con crías registradas no puede tener el estado «${estado}».`);
    }
    const incoherente = nacimiento && crias.find((c) => c.nacimiento && c.nacimiento <= nacimiento);
    if (incoherente) {
      return mostrarError(error, `La cría ${etiquetaVaca(incoherente)} nació antes o el mismo día que su madre.`);
    }
  }

  // --- Validación de gestación y movimientos ---
  const cubricion = estado === 'Gestante' ? $('vaca-cubricion').value : '';
  let fechaParto = estado === 'Gestante' ? $('vaca-parto').value : '';
  if (cubricion) {
    if (cubricion > hoyISO()) return mostrarError(error, 'La fecha de cubrición no puede ser futura.');
    if (nacimiento && cubricion < nacimiento) return mostrarError(error, 'La cubrición no puede ser anterior al nacimiento del animal.');
    if (fechaParto && fechaParto <= cubricion) return mostrarError(error, 'La fecha prevista de parto debe ser posterior a la cubrición.');
    if (!fechaParto) fechaParto = partoCalculado(cubricion, especieForm());
  }

  // --- Validación estricta de lote por finca ---
  // Cada lote pertenece a una sola finca: el animal de un lote solo puede estar en la finca de ese lote.
  const loteElegido = $('vaca-lote').value.trim();
  const fincaElegida = $('vaca-finca').value;
  const errUbicacion = validarUbicacion(loteElegido, fincaElegida);
  if (errUbicacion) return mostrarError(error, errUbicacion);
  const enCebo = editVacaId ? ceboAbiertoDe(editVacaId) : null;
  if (enCebo && (fincaElegida || loteElegido)) {
    return mostrarError(error, `Está en el cebadero «${nombreCebadero(enCebo.cebaderoId)}»: no puede estar a la vez en una finca. Registra antes su salida del cebadero.`);
  }

  const previa = editVacaId ? vacaPorId(editVacaId) : null;
  if (editVacaId && !previa) return mostrarError(error, 'El animal que estás editando ya no está en el censo activo.');
  const fechaMov = $('vaca-fecha-mov').value;
  const movs = entradasMovimiento(
    previa || { fincaId: '', lote: '' },
    { fincaId: $('vaca-finca').value, lote: $('vaca-lote').value.trim() },
    fechaMov
  );
  if (movs.length) {
    const errMov = validarFechaMovimiento(previa, fechaMov, nacimiento);
    if (errMov) return mostrarError(error, errMov);
  }

  const datos = {
    crotal,
    nombre: $('vaca-nombre').value.trim(),
    raza: $('vaca-raza').value.trim(),
    nacimiento: $('vaca-nacimiento').value,
    fincaId: $('vaca-finca').value,
    lote: $('vaca-lote').value.trim(),
    madreId,
    padreId,
    padreExterno,
    sexo: sexoForm(),
    estado: $('vaca-estado').value,
    especie: especieForm(),
    fechaCubricion: cubricion,
    fechaParto
  };

  // Se construye la lista nueva y solo se sustituye la de memoria si el guardado en localStorage ha funcionado
  const vacasNuevas = editVacaId
    ? vacas.map((v) => (v.id === editVacaId ? { ...v, ...datos, movimientos: [...(v.movimientos || []), ...movs] } : v))
    : [...vacas, { id: uid(), ...datos, movimientos: movs }];
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) {
    return mostrarError(error, 'No se pudo guardar en este navegador. No se ha modificado ningún dato.');
  }
  vacas = vacasNuevas;

  const madreGuardada = vacaPorId(madreId);
  const mensaje = madreGuardada
    ? `✔ ${etiquetaVaca(datos)} queda registrado/a como cría de ${etiquetaVaca(madreGuardada)}, ` +
      `que ahora tiene ${criasDe(madreGuardada.id).length} ${criasDe(madreGuardada.id).length === 1 ? 'cría' : 'crías'}.`
    : '';

  resetFormVaca();
  renderTodo();
  if (mensaje) mostrarAvisoVaca(mensaje);
});

$('vaca-cancel').addEventListener('click', () => {
  resetFormVaca();
  renderVacas();
});

$('vacas-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const vaca = vacas.find((v) => v.id === btn.dataset.id);
  if (!vaca) return;

  if (btn.dataset.action === 'edit-vaca') {
    iniciarEdicionVaca(vaca.id);
  } else if (btn.dataset.action === 'baja-vaca') {
    abrirBajaModal(vaca.id);
  }
});

$('buscar-vaca').addEventListener('input', renderVacas);
$('vaca-madre').addEventListener('change', actualizarHintMadre);
$('vaca-padre').addEventListener('change', actualizarHintPadre);
$('vaca-especie').addEventListener('change', alCambiarEspecie);
$('vaca-sexo').addEventListener('change', alCambiarSexo);
// La fecha de nacimiento acota qué animales pueden ser madre (deben ser mayores)
$('vaca-nacimiento').addEventListener('change', () => { renderSelectMadre(); renderSelectPadre(); });
$('filtro-finca').addEventListener('change', renderVacas);
$('filtro-estado').addEventListener('change', renderVacas);
$('filtro-lote').addEventListener('change', renderVacas);
$('orden-vacas').addEventListener('change', renderVacas);

/* ============================================================
   FINCAS: añadir / editar / eliminar (con dibujo en el mapa)
   ============================================================ */
function resetFormFinca() {
  editFincaId = null;
  $('finca-form').reset();
  ocultarError($('finca-error'));
  if (capaDibujo) capaDibujo.clearLayers();
  geomForm = { poligono: null, punto: null };
  actualizarEstadoGeom();
  $('finca-form-title').textContent = 'Añadir finca';
  $('finca-submit').textContent = 'Añadir finca';
  $('finca-cancel').classList.add('hidden');
  $('finca-editando').classList.add('hidden');
}

function iniciarEdicionFinca(id) {
  const f = fincas.find((x) => x.id === id);
  if (!f) return;
  initMapa();

  editFincaId = id;
  $('finca-nombre').value = f.nombre || '';
  $('finca-ubicacion').value = f.ubicacion || '';
  $('finca-lote').value = f.lote || '';
  $('finca-hectareas').value = f.hectareas !== '' && f.hectareas != null ? f.hectareas : '';
  ocultarError($('finca-error'));

  geomForm = { poligono: f.poligono || null, punto: f.punto || null };
  if (capaDibujo) {
    capaDibujo.clearLayers();
    if (f.poligono && f.poligono.length >= 3) capaDibujo.addLayer(L.polygon(f.poligono, ESTILO_DIBUJO));
    if (f.punto) capaDibujo.addLayer(L.marker(f.punto, { icon: iconoPunto() }));
  }
  actualizarEstadoGeom();

  $('finca-form-title').textContent = `Editar finca`;
  $('finca-submit').textContent = 'Guardar cambios';
  $('finca-cancel').classList.remove('hidden');
  $('finca-editando').classList.remove('hidden');

  renderMapaFincas(false);
  renderFincas();
  if (mapa && capaDibujo.getLayers().length) {
    try { mapa.fitBounds(capaDibujo.getBounds().pad(0.3), { maxZoom: 18 }); } catch { /* ignorar */ }
  }
  $('finca-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('finca-nombre').focus();
}

$('finca-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('finca-error');
  ocultarError(error);

  const nombre = $('finca-nombre').value.trim();
  if (!nombre) return mostrarError(error, 'El nombre es obligatorio.');
  if (fincas.some((f) => f.id !== editFincaId && f.nombre.toLowerCase() === nombre.toLowerCase())) {
    return mostrarError(error, 'Ya existe una finca con ese nombre.');
  }

  // Un lote pertenece a una sola finca: no puede repetirse en otra
  const loteNuevo = $('finca-lote').value.trim();
  if (loteNuevo) {
    const otra = fincas.find((f) => f.id !== editFincaId && normLote(f.lote) === normLote(loteNuevo));
    if (otra) {
      return mostrarError(error, `El lote «${loteNuevo}» ya está asignado a la finca «${otra.nombre}». Cada lote solo puede pertenecer a una finca.`);
    }
    // Ningún animal de otra finca (o sin finca) puede llevar ya ese lote: rompería la exclusividad lote ↔ finca
    const ajenos = vacas.filter((v) => normLote(v.lote) === normLote(loteNuevo) && v.fincaId !== editFincaId);
    if (ajenos.length) {
      return mostrarError(error, `No se puede asignar el lote «${loteNuevo}» a esta finca: ${ajenos.length} ${ajenos.length === 1 ? 'animal' : 'animales'} ` +
        `(${ajenos.slice(0, 3).map(etiquetaVaca).join(', ')}${ajenos.length > 3 ? '…' : ''}) lo tienen asignado en otra finca. Muévelos o cambia su lote antes.`);
    }
  }

  // Longitudes y superficie (alineadas con schema.sql)
  if (nombre.length > 120) return mostrarError(error, 'El nombre no puede superar los 120 caracteres.');
  if ($('finca-ubicacion').value.trim().length > 200) return mostrarError(error, 'La ubicación no puede superar los 200 caracteres.');
  if (loteNuevo.length > 80) return mostrarError(error, 'El lote no puede superar los 80 caracteres.');
  const haTexto = $('finca-hectareas').value;
  if (haTexto !== '' && !(Number.isFinite(Number(haTexto)) && Number(haTexto) >= 0)) {
    return mostrarError(error, 'La superficie debe ser un número igual o mayor que 0.');
  }

  const ha = $('finca-hectareas').value;
  const datos = {
    nombre,
    ubicacion: $('finca-ubicacion').value.trim(),
    lote: $('finca-lote').value.trim(),
    hectareas: ha === '' ? '' : Number(ha),
    poligono: geomForm.poligono,
    punto: geomForm.punto
  };

  // Si la finca cambia de lote, sus animales con el lote anterior pasan al nuevo (para mantener la coherencia lote-finca)
  let vacasNuevas = vacas;
  if (editFincaId) {
    const previa = fincas.find((f) => f.id === editFincaId);
    if (previa && normLote(previa.lote) && normLote(previa.lote) !== normLote(datos.lote)) {
      const afectados = vacas.filter((v) => v.fincaId === previa.id && normLote(v.lote) === normLote(previa.lote));
      if (afectados.length) {
        const destino = datos.lote ? `al lote «${datos.lote}»` : 'a «Sin lote»';
        if (!confirm(`Esta finca cambia del lote «${previa.lote}» ${datos.lote ? 'a «' + datos.lote + '»' : 'a ninguno'}.\n\n` +
          `${afectados.length} ${afectados.length === 1 ? 'animal pasará' : 'animales pasarán'} ${destino} y se anotará el movimiento. ¿Continuar?`)) return;
        const hoy = hoyISO();
        vacasNuevas = vacas.map((v) => (afectados.includes(v)
          ? { ...v, lote: datos.lote, movimientos: [...(v.movimientos || []),
              ...entradasMovimiento({ fincaId: v.fincaId, lote: v.lote }, { fincaId: v.fincaId, lote: datos.lote }, hoy)] }
          : v));
      }
    }
  }

  // Finca y animales se guardan juntos: o se guarda todo o no se toca nada
  let idGuardada = editFincaId;
  if (editFincaId && !fincas.some((f) => f.id === editFincaId)) return mostrarError(error, 'La finca que estás editando ya no existe.');
  if (!editFincaId) idGuardada = uid();
  const fincasNuevas = editFincaId
    ? fincas.map((f) => (f.id === editFincaId ? { ...f, ...datos } : f))
    : [...fincas, { id: idGuardada, ...datos }];
  if (!guardarTransaccion([[KEYS.fincas, fincasNuevas], [KEYS.vacas, vacasNuevas]])) {
    return mostrarError(error, 'No se pudo guardar en este navegador. No se ha modificado ningún dato.');
  }
  fincas = fincasNuevas;
  vacas = vacasNuevas;

  resetFormFinca();
  renderTodo();
  enfocarFinca(idGuardada, false);
});

$('finca-cancel').addEventListener('click', () => {
  resetFormFinca();
  renderTodo();
});

$('btn-borrar-dibujo').addEventListener('click', () => {
  if (capaDibujo) capaDibujo.clearLayers();
  geomForm = { poligono: null, punto: null };
  actualizarEstadoGeom();
});

$('fincas-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const finca = fincas.find((f) => f.id === btn.dataset.id);
  if (!finca) return;

  switch (btn.dataset.action) {
    case 'edit-finca':
      iniciarEdicionFinca(finca.id);
      break;

    case 'ver-mapa':
      enfocarFinca(finca.id, true);
      break;

    case 'ver-vacas':
      $('buscar-vaca').value = '';
      $('filtro-estado').value = '';
      $('filtro-lote').value = '';
      $('filtro-finca').value = finca.id;
      cambiarTab('vacas');
      renderVacas();
      $('vacas-body').scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;

    case 'ver-lote':
      abrirModalLote(finca.lote);
      break;

    case 'del-finca': {
      const afectadas = vacas.filter((v) => v.fincaId === finca.id).length;
      const aviso = afectadas
        ? `¿Eliminar la finca "${finca.nombre}"? Sus ${afectadas} ${vocab().animales} quedarán sin finca asignada${finca.lote ? ' y sin el lote «' + finca.lote + '»' : ''}.`
        : `¿Eliminar la finca "${finca.nombre}"?`;
      if (!confirm(aviso)) return;

      const fincasNuevas = fincas.filter((f) => f.id !== finca.id);
      // Los animales de la finca eliminada quedan sin finca (y sin su lote, que era de esa finca) y se anota el movimiento
      const vacasNuevas = vacas.map((v) => {
        if (v.fincaId !== finca.id) return v;
        const quitaLote = normLote(finca.lote) && normLote(v.lote) === normLote(finca.lote);
        const movs = [{ id: uid(), fecha: hoyISO(), campo: 'Finca', desde: finca.nombre, hasta: '', creado: Date.now() }];
        if (quitaLote) movs.push({ id: uid(), fecha: hoyISO(), campo: 'Lote', desde: String(v.lote || '').trim(), hasta: '', creado: Date.now() });
        return { ...v, fincaId: '', lote: quitaLote ? '' : v.lote, movimientos: [...(v.movimientos || []), ...movs] };
      });
      if (!guardarTransaccion([[KEYS.fincas, fincasNuevas], [KEYS.vacas, vacasNuevas]])) return;
      fincas = fincasNuevas;
      vacas = vacasNuevas;
      if (editFincaId === finca.id) resetFormFinca();
      renderTodo();
      break;
    }
  }
});

/* ============================================================
   LOTES: ventana con todas las vacas de un lote
   ============================================================ */
let loteModalActual = '';

function abrirModalLote(lote) {
  const clave = normLote(lote);
  if (!clave) return;

  // Nombre tal como está guardado (conserva mayúsculas)
  const nombre = lotesConocidos().find((l) => normLote(l) === clave) || String(lote).trim();
  loteModalActual = nombre;

  const lista = vacasDeLote(nombre);
  const pastos = fincasDeLote(nombre).map((f) => f.nombre);
  const porEstado = ESTADOS
    .map((e) => [e, lista.filter((v) => v.estado === e).length])
    .filter(([, c]) => c > 0)
    .map(([e, c]) => `${e}: ${c}`)
    .join(' · ');

  $('lote-modal-titulo').textContent = `🏷️ ${nombre}`;
  $('lote-modal-resumen').textContent =
    `${lista.length} ${lista.length === 1 ? vocab().animal : vocab().animales}` +
    (porEstado ? ` (${porEstado})` : '') +
    (pastos.length ? ` · Pasta en: ${pastos.join(', ')}` : '');

  $('lote-modal-body').innerHTML = lista
    .map((v) => {
      const finca = nombreFinca(v.fincaId);
      const clase = ESTADO_CLASE[v.estado] || 'bg-stone-100 text-stone-700';
      return `
        <tr data-action="ver-ficha" data-id="${esc(v.id)}" class="border-b last:border-0 hover:bg-stone-50 cursor-pointer" title="Ver ficha del animal">
          <td class="py-2 pr-4 font-mono text-green-800 hover:underline">${esc(v.crotal)}</td>
          <td class="py-2 pr-4">${esc(v.nombre) || '—'}</td>
          <td class="py-2 pr-4">${esc(v.raza) || '—'}</td>
          <td class="py-2 pr-4">${finca ? esc(finca) : '<span class="text-stone-400">Sin finca</span>'}</td>
          <td class="py-2"><span class="inline-block rounded-full ${clase} px-2 py-0.5 text-xs">${esc(v.estado)}</span></td>
        </tr>`;
    })
    .join('');
  $('lote-modal-vacio').classList.toggle('hidden', lista.length > 0);

  $('lote-modal').classList.remove('hidden');
  $('lote-modal').classList.add('flex');
  $('lote-modal-cerrar').focus();
}

function cerrarModalLote() {
  $('lote-modal').classList.add('hidden');
  $('lote-modal').classList.remove('flex');
}

$('lote-modal-x').addEventListener('click', cerrarModalLote);
$('lote-modal-cerrar').addEventListener('click', cerrarModalLote);
$('lote-modal').addEventListener('click', (e) => {
  if (e.target === $('lote-modal')) cerrarModalLote(); // clic en el fondo oscuro
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('lote-modal').classList.contains('hidden')) cerrarModalLote();
});

$('lote-modal-filtrar').addEventListener('click', () => {
  if (!loteModalActual) return;
  $('buscar-vaca').value = '';
  $('filtro-finca').value = '';
  $('filtro-estado').value = '';
  const opcion = [...$('filtro-lote').options].find((o) => normLote(o.value) === normLote(loteModalActual));
  $('filtro-lote').value = opcion ? opcion.value : '';
  cerrarModalLote();
  cambiarTab('vacas');
  renderVacas();
  $('vacas-body').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* ============================================================
   FICHA DE VACA: datos, línea materna y crías
   ============================================================ */
let fichaActualId = null;
let volverALote = ''; // si la ficha se abrió desde la ventana de un lote, al cerrarla se vuelve a ese lote

// Árbol de descendencia (crías, nietas…) con enlaces a cada ficha; protege frente a ciclos
function arbolDescendencia(id, vistos = new Set([id])) {
  const hijos = criasFicha(id)
    .filter((c) => !vistos.has(c.id))
    .sort((a, b) => (b.nacimiento || '').localeCompare(a.nacimiento || ''));
  if (!hijos.length) return '';
  hijos.forEach((c) => vistos.add(c.id));
  return '<ul class="space-y-1 ml-4 border-l pl-3">' +
    hijos
      .map((c) => `
        <li class="text-sm">
          ${enlaceVaca(c)}
          <span class="text-xs text-stone-500">${esc(c.raza || '')}${c.nacimiento ? ' · nació el ' + formatearFecha(c.nacimiento) : ''}</span>
          <span class="inline-block rounded-full ${c.baja ? 'bg-stone-200 text-stone-600' : (ESTADO_CLASE[c.estado] || 'bg-stone-100 text-stone-700')} px-2 py-0.5 text-xs">${c.baja ? 'Baja · ' + esc(c.baja.motivo) : esc(c.estado)}</span>
          ${arbolDescendencia(c.id, vistos)}
        </li>`)
      .join('') +
    '</ul>';
}

function abrirFicha(id, mensaje) {
  const v = vacaAnyPorId(id); // también las bajas (ficha de solo lectura)
  if (!v) return;
  const reabierta = !$('vaca-modal').classList.contains('hidden') && fichaActualId === id;
  const scrollPrevio = reabierta ? $('vaca-modal-body').scrollTop : 0;
  fichaActualId = id;

  const esBaja = !!v.baja;
  const esp = ESPECIES[especieDe(v)];
  const finca = esBaja ? (v.baja.finca || null) : nombreFinca(v.fincaId);
  const lote = esBaja ? (v.baja.lote || v.lote) : v.lote;
  const ancestros = ascendencia(id);
  const totalDesc = totalDescendientes(id);
  const claseEstado = (e) => ESTADO_CLASE[e] || 'bg-stone-100 text-stone-700';
  const vacio = (t) => `<span class="text-stone-400">${t}</span>`;
  const dato = (rotulo, valor) => `<div><p class="text-xs uppercase text-stone-500">${esc(rotulo)}</p><p>${valor}</p></div>`;
  const edad = edadTexto(v.nacimiento);

  $('vaca-modal-titulo').textContent = `${emojiAnimal(v)} ${etiquetaVaca(v)}`;
  $('vaca-modal-estado').className = `inline-block rounded-full ${claseEstado(v.estado)} px-2 py-0.5 text-xs mt-1`;
  $('vaca-modal-estado').textContent = esBaja ? `Baja · ${v.baja.motivo}` : (v.estado || '');

  // 1) Datos identificativos y de especie
  const datos = `
    <section>
      <h3 class="font-semibold mb-2">🪪 Datos identificativos</h3>
      <div class="grid gap-3 sm:grid-cols-3 text-sm">
        ${dato('Especie', `${esp.emoji} ${esc(esp.corto)}`)}
        ${dato(esp.v.crotal, `<span class="font-mono">${esc(v.crotal)}</span>`)}
        ${dato('Nombre', v.nombre ? esc(v.nombre) : vacio('—'))}
        ${dato('Sexo', `${SIMBOLO_SEXO[sexoDe(v)]} ${SEXOS[sexoDe(v)]}`)}
        ${dato('Raza', v.raza ? esc(v.raza) : vacio('—'))}
        ${dato('Nacimiento', `${formatearFecha(v.nacimiento)}${edad ? ` <span class="text-stone-500">(${esc(edad)})</span>` : ''}`)}
        ${dato('Estado', `<span class="inline-block rounded-full ${claseEstado(v.estado)} px-2 py-0.5 text-xs">${esc(v.estado || '—')}</span>`)}
        ${esVeterinario() ? '' : dato(esBaja ? 'Última localización' : 'Localización', esBaja ? (finca ? '🌾 ' + esc(finca) : vacio('Sin localización')) : celdaLocalizacion(v))}
        ${esVeterinario() ? '' : dato(esBaja ? 'Último lote' : 'Lote', lote ? esc(lote) : vacio('Sin lote'))}
        ${dato('Padre', vacaAnyPorId(v.padreId) ? enlaceVaca(vacaAnyPorId(v.padreId)) : (v.padreExterno ? esc(v.padreExterno) + ' <span class="text-xs text-stone-500">(externo)</span>' : vacio('—')))}
        ${dato('Crías registradas', String(criasFicha(id).length))}
      </div>
    </section>`;

  // 2) Estado reproductivo / baja
  let extraEstado = '';
  if (esBaja) {
    extraEstado = `
    <section class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
      <p class="font-semibold text-red-800">Baja: ${esc(v.baja.motivo)} · ${formatearFecha(v.baja.fecha)}</p>
      ${v.baja.detalle ? `<p>${esc(v.baja.detalle)}</p>` : ''}
      ${v.baja.documento ? `<p class="text-xs text-stone-600">Documento: ${esc(v.baja.documento)}</p>` : ''}
    </section>`;
  } else if (v.estado === 'Gestante') {
    const dias = v.fechaParto ? diasHasta(v.fechaParto) : null;
    const est = dias === null ? null : estadoParto(dias);
    extraEstado = `
    <section class="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm">
      <p class="font-semibold text-purple-800">🤰 Estado reproductivo: gestante</p>
      <p>Cubrición: ${fechaCSV(v.fechaCubricion) || '—'} · Parto previsto: ${fechaCSV(v.fechaParto) || '—'}
        ${est ? `<span class="inline-block rounded-full ${est.clase} px-2 py-0.5 text-xs ml-1">${esc(est.texto)}</span>` : ''}</p>
    </section>`;
  } else if (esp.gestacion && !noPuedeSerMadre(v)) {
    extraEstado = `
    <section class="rounded-lg bg-stone-50 border border-stone-200 p-3 text-sm">
      <p class="font-semibold text-stone-700">🍼 Estado reproductivo</p>
      <p class="text-stone-600">Sin gestación en curso · ${criasFicha(id).length} ${criasFicha(id).length === 1 ? 'cría registrada' : 'crías registradas'}.</p>
    </section>`;
  }

  // 3) Árbol genealógico: línea materna (hacia arriba) y descendencia (hacia abajo)
  let linea = '<p class="text-sm text-stone-500">Sin madre registrada (compra externa o madre desconocida).</p>';
  if (ancestros.length) {
    const ultima = ancestros[ancestros.length - 1];
    const sigue = ultima.madreId && ancestros.length >= MAX_GENERACIONES;
    linea = '<ol class="space-y-1.5">' +
      `<li class="text-sm"><span class="text-xs uppercase text-stone-500">Este animal</span> <span class="font-medium">${esc(etiquetaVaca(v))}</span></li>` +
      ancestros
        .map((a, i) => `
          <li class="text-sm" style="margin-left:${(i + 1) * 16}px">
            <span class="text-stone-400">↳</span>
            <span class="text-xs uppercase text-stone-500">${esc(rotuloMaterno(i))}</span>
            ${enlaceVaca(a)}${a.baja ? ` <span class="text-xs text-stone-500">(baja: ${esc(a.baja.motivo)})</span>` : ''}
            <span class="text-xs text-stone-500">${esc(a.raza || '')}${a.nacimiento ? ' · ' + formatearFecha(a.nacimiento) : ''}</span>
          </li>`)
        .join('') +
      `<li class="text-xs text-stone-500" style="margin-left:${(ancestros.length + 1) * 16}px">${
        sigue ? `… la línea continúa (se muestran las ${MAX_GENERACIONES} generaciones más próximas).`
              : 'Origen de la línea: sin madre registrada (compra externa o desconocida).'}</li>` +
      '</ol>';
  }
  const descendencia = arbolDescendencia(id) || '<p class="text-sm text-stone-500">Sin crías registradas.</p>';

  // 4) Historial de movimientos de finca y lote
  const movs = movimientosOrdenados(v);
  const seccionMov = `
    <section>
      <h3 class="font-semibold mb-2">🧭 Historial de movimientos (${movs.length})</h3>
      ${movs.length
        ? '<ul class="divide-y">' + movs.map((m) => `
          <li class="py-2 text-sm">
            <span class="font-mono text-stone-600">${formatearFecha(m.fecha)}</span> ·
            <span class="font-medium">${esc(m.campo)}</span>:
            ${m.desde ? esc(m.desde) : '<span class="text-stone-400">—</span>'} →
            ${m.hasta ? esc(m.hasta) : `<span class="text-stone-400">${m.campo === 'Cebadero' ? 'Sale del cebadero' : 'Sin ' + (m.campo === 'Finca' ? 'finca' : 'lote')}</span>`}
          </li>`).join('') + '</ul>'
        : '<p class="text-sm text-stone-500">Sin movimientos registrados.</p>'}
    </section>`;

  const estancias = cebosDe(id);
  const seccionCebo = estancias.length ? `
    <section>
      <h3 class="font-semibold mb-2">🐂 Cebadero (${estancias.length})</h3>
      <ul class="divide-y">${estancias.map((r) => {
        const m = metricasCebo(r);
        const peso = (v) => (v ? `${formatoNum(v, 1)} kg` : '<span class="text-stone-400">sin pesar</span>');
        return `<li class="py-2 text-sm">
          <p><span class="font-medium">${esc(nombreCebadero(r.cebaderoId))}</span> ·
          ${formatearFecha(r.entrada)} → ${r.salida ? formatearFecha(r.salida) : '<span class="text-emerald-700 font-medium">en cebadero</span>'}
          · ${m.dias} días</p>
          <p class="text-stone-600">Peso de entrada: ${peso(r.pesoEntrada)} · Peso de salida: ${r.salida ? peso(r.pesoSalida) : '—'}
          ${m.kg !== null ? ` · <span class="font-medium">+${formatoNum(m.kg, 1)} kg</span>` : ''}
          ${m.gmd !== null ? ` · <span class="font-medium">${formatoNum(m.gmd, 2)} kg/día</span>` : ''}</p>
        </li>`;
      }).join('')}</ul>
    </section>` : '';

  $('vaca-modal-ficha').innerHTML = `
    ${avisoRetirada(v)}
    ${datos}
    ${extraEstado}
    ${seccionCebo}
    <section>
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="font-semibold">🌳 Línea materna</h3>
        <button type="button" data-action="ver-arbol" data-id="${esc(v.id)}"
          class="bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg px-3 py-1 text-sm">Ver árbol genealógico</button>
      </div>
      ${linea}
    </section>
    <section>
      <h3 class="font-semibold mb-2">Descendencia (${totalDesc})</h3>
      ${descendencia}
    </section>
    ${seccionPesoFicha(v)}
    ${seccionFotosFicha(v)}
    ${seccionEconomiaFicha(id)}
    ${esVeterinario() ? '' : seccionMov}`;
  cargarFotosFicha(id);

  // Solo las hembras adultas pueden tener crías; las bajas se consultan en solo lectura
  $('vaca-modal-cria').classList.toggle('hidden', esBaja || noPuedeSerMadre(v));
  $('vaca-modal-editar').classList.toggle('hidden', esBaja);
  $('vaca-modal-baja').classList.toggle('hidden', esBaja);
  // El ganadero solo consulta la sanidad; el formulario es del veterinario
  $('trat-form').classList.toggle('hidden', esBaja || !esVeterinario());
  $('trat-aviso-ganadero').classList.toggle('hidden', esBaja || esVeterinario());
  $('ficha-sit-seccion').classList.toggle('hidden', esBaja);

  // Perfil veterinario: el historial sanitario (lo que más usa) va antes que el resto de la ficha
  const vet = esVeterinario();
  const trat = $('trat-seccion');
  ['border-t', 'pt-5'].forEach((c) => trat.classList.toggle(c, !vet));
  ['border-b', 'pb-5'].forEach((c) => trat.classList.toggle(c, vet));
  if (vet) $('vaca-modal-body').insertBefore(trat, $('vaca-modal-ficha'));
  else $('vaca-modal-body').appendChild(trat);

  $('vaca-modal').classList.remove('hidden');
  $('vaca-modal').classList.add('flex');
  resetFormTrat();
  renderTratamientos();
  if (!esBaja) prepararFormSituacion(v, mensaje);
  $('vaca-modal-body').scrollTop = scrollPrevio;
}

// «volver»: si la ficha se abrió desde un lote, se regresa a la ventana de ese lote
function cerrarFicha(volver = false) {
  $('vaca-modal').classList.add('hidden');
  $('vaca-modal').classList.remove('flex');
  const lote = volverALote;
  volverALote = '';
  if (volver === true && lote) abrirModalLote(lote);
}

// Cualquier enlace o fila "ver-ficha" (tabla, lote, bajas, crías del formulario, árbol genealógico, agenda…)
// Si dentro de la fila hay otro botón de acción (Editar, Dar de baja…), manda ese y no se abre la ficha.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.dataset.action !== 'ver-ficha') return;
  if (btn.closest('#lote-modal')) {
    volverALote = loteModalActual;
    cerrarModalLote();
  }
  abrirFicha(btn.dataset.id);
});

$('vaca-modal-x').addEventListener('click', () => cerrarFicha(true));
$('vaca-modal-cerrar').addEventListener('click', () => cerrarFicha(true));
$('vaca-modal').addEventListener('click', (e) => {
  if (e.target === $('vaca-modal')) cerrarFicha(true);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('vaca-modal').classList.contains('hidden')) cerrarFicha(true);
});

$('vaca-modal-editar').addEventListener('click', () => {
  const id = fichaActualId;
  cerrarFicha();
  cambiarTab('vacas');
  iniciarEdicionVaca(id);
});

// Prepara el formulario para registrar una cría de este animal
$('vaca-modal-cria').addEventListener('click', () => {
  const id = fichaActualId;
  cerrarFicha();
  prepararCria(id);
});

/* ---------- Ficha: actualizar estado, finca y lote ---------- */
function renderLoteSituacion(valor) {
  const lotes = lotesDeFincas();
  let html = '<option value="">Sin lote</option>' + lotes.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  if (normLote(valor) && !lotes.some((l) => normLote(l) === normLote(valor))) {
    html += `<option value="${esc(valor)}">${esc(valor)} (sin finca asignada)</option>`;
  }
  $('ficha-sit-lote').innerHTML = html;
  const op = [...$('ficha-sit-lote').options].find((o) => normLote(o.value) === normLote(valor));
  $('ficha-sit-lote').value = op ? op.value : '';
}

function prepararFormSituacion(v, mensaje) {
  const estados = estadosDe(especieDe(v), sexoDe(v));
  $('ficha-sit-estado').innerHTML = estados.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  $('ficha-sit-estado').value = estados.includes(v.estado) ? v.estado : estados[0];
  $('ficha-sit-finca').innerHTML =
    '<option value="">Sin finca</option>' + fincas.map((f) => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('');
  $('ficha-sit-finca').value = v.fincaId && fincas.some((f) => f.id === v.fincaId) ? v.fincaId : '';
  renderLoteSituacion(v.lote || '');
  const enCebo = ceboAbiertoDe(v.id);
  $('ficha-sit-finca').disabled = !!enCebo;
  $('ficha-sit-lote').disabled = !!enCebo;
  $('ficha-sit-fecha').value = hoyISO();
  ocultarError($('ficha-sit-error'));
  const ok = $('ficha-sit-ok');
  ok.textContent = mensaje || '';
  ok.classList.toggle('hidden', !mensaje);
  actualizarSituacion();
}

function actualizarSituacion() {
  const v = vacaPorId(fichaActualId);
  if (!v) return;
  const fincaId = $('ficha-sit-finca').value;
  const lote = $('ficha-sit-lote').value;
  const cambios = [];
  if (fincaId !== (v.fincaId || '')) cambios.push(`Finca: ${nombreFinca(v.fincaId) || 'Sin finca'} → ${nombreFinca(fincaId) || 'Sin finca'}`);
  if (normLote(lote) !== normLote(v.lote)) cambios.push(`Lote: ${v.lote || 'Sin lote'} → ${lote || 'Sin lote'}`);
  $('ficha-sit-mov-wrap').classList.toggle('hidden', !cambios.length);
  const err = validarUbicacion(lote, fincaId);
  const hint = $('ficha-sit-hint');
  const enCebo = ceboAbiertoDe(v.id);
  if (enCebo) {
    hint.textContent = `🐂 Está en el cebadero «${nombreCebadero(enCebo.cebaderoId)}»: la finca y el lote se asignan al registrar su salida (pestaña Cebaderos). Aquí solo puedes cambiar el estado.`;
    hint.classList.remove('text-red-600');
    hint.classList.add('text-stone-500');
    return;
  }
  hint.textContent = err
    ? `⚠ ${err}`
    : (cambios.length
      ? `Se anotará el movimiento: ${cambios.join(' · ')}.`
      : 'Cambia el estado, la finca o el lote y guarda: los movimientos quedan anotados en el historial.');
  hint.classList.toggle('text-red-600', !!err);
  hint.classList.toggle('text-stone-500', !err);
}

$('ficha-sit-finca').addEventListener('change', () => {
  // Un lote pertenece a una sola finca: si el lote elegido no es de la nueva finca, se quita
  const lote = $('ficha-sit-lote').value;
  if (normLote(lote) && !fincasDeLote(lote).some((f) => f.id === $('ficha-sit-finca').value)) renderLoteSituacion('');
  actualizarSituacion();
});
$('ficha-sit-lote').addEventListener('change', () => {
  // Al elegir un lote se propone la finca a la que pertenece
  const propietarias = fincasDeLote($('ficha-sit-lote').value);
  if (propietarias.length && !propietarias.some((f) => f.id === $('ficha-sit-finca').value)) $('ficha-sit-finca').value = propietarias[0].id;
  actualizarSituacion();
});

$('ficha-sit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('ficha-sit-error');
  ocultarError(error);
  $('ficha-sit-ok').classList.add('hidden');

  const v = vacaPorId(fichaActualId);
  if (!v) return mostrarError(error, 'Este animal ya no está en el censo activo.');

  const estado = $('ficha-sit-estado').value;
  const fincaId = $('ficha-sit-finca').value;
  const lote = $('ficha-sit-lote').value.trim();

  if (!estadosDe(especieDe(v), sexoDe(v)).includes(estado)) return mostrarError(error, 'El estado no corresponde a la especie y sexo del animal.');
  if (estado !== v.estado && criasDe(v.id).length && noPuedeSerMadre({ especie: especieDe(v), estado, sexo: sexoDe(v) })) {
    return mostrarError(error, `Un animal con crías registradas no puede tener el estado «${estado}».`);
  }
  if (estado !== v.estado && hijosDePadre(v.id).length && !esMachoReproductor({ especie: especieDe(v), estado, sexo: sexoDe(v) })) {
    return mostrarError(error, `Este animal es padre de otros: no puede pasar a «${estado}».`);
  }
  const errUbicacion = validarUbicacion(lote, fincaId);
  if (errUbicacion) return mostrarError(error, errUbicacion);
  const enCebo = ceboAbiertoDe(v.id);
  if (enCebo && (fincaId || lote)) {
    return mostrarError(error, `Está en el cebadero «${nombreCebadero(enCebo.cebaderoId)}»: registra antes su salida para llevarlo a una finca.`);
  }

  const fechaMov = $('ficha-sit-fecha').value;
  const movs = entradasMovimiento(v, { fincaId, lote }, fechaMov);
  if (movs.length) {
    const errMov = validarFechaMovimiento(v, fechaMov, v.nacimiento);
    if (errMov) return mostrarError(error, errMov);
  }
  if (!movs.length && estado === v.estado) return mostrarError(error, 'No hay cambios que guardar.');

  const actualizado = { ...v, estado, fincaId, lote, movimientos: [...(v.movimientos || []), ...movs] };
  if (estado !== 'Gestante') { actualizado.fechaCubricion = ''; actualizado.fechaParto = ''; }
  const vacasNuevas = vacas.map((x) => (x.id === v.id ? actualizado : x));
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) {
    return mostrarError(error, 'No se pudo guardar en este navegador. No se ha modificado ningún dato.');
  }
  vacas = vacasNuevas;
  if (editVacaId === v.id) resetFormVaca(); // el formulario de edición abierto quedaría con datos obsoletos

  const partes = [];
  if (estado !== v.estado) partes.push(`estado «${estado}»`);
  movs.forEach((m) => partes.push(`${m.campo.toLowerCase()}: ${m.desde || '—'} → ${m.hasta || '—'}`));
  const aviso = estado === 'Gestante' && v.estado !== 'Gestante'
    ? ' Para indicar la cubrición y el parto previsto usa «Editar».' : '';
  renderTodo();
  abrirFicha(v.id, `✔ Cambios guardados (${partes.join(' · ')}).${aviso}`);
});

/* ---------- Ficha: añadir / eliminar tratamientos ---------- */
$('trat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('trat-error');
  ocultarError(error);
  if (!esVeterinario()) return mostrarError(error, 'Los tratamientos y vacunas los registra tu veterinario.');

  const v = vacaPorId(fichaActualId);
  if (!v) return mostrarError(error, 'Este animal ya no está en el censo activo.');

  const fecha = $('trat-fecha').value;
  const tipo = $('trat-tipo').value.trim().replace(/\s+/g, ' ');
  const vet = $('trat-vet').value.trim();
  const obs = $('trat-obs').value.trim();
  const retCarne = leerDiasRetirada('trat-ret-carne');
  const retLeche = leerDiasRetirada('trat-ret-leche');
  if (retCarne.error || retLeche.error) return mostrarError(error, retCarne.error || retLeche.error);
  if (!fecha) return mostrarError(error, 'La fecha es obligatoria.');
  if (!tipo) return mostrarError(error, 'Indica el tipo o nombre del tratamiento.');
  if (tipo.length > 120) return mostrarError(error, 'El tipo de tratamiento no puede superar los 120 caracteres.');
  if (vet.length > 120) return mostrarError(error, 'El nombre del veterinario no puede superar los 120 caracteres.');
  if (obs.length > 1000) return mostrarError(error, 'Las observaciones no pueden superar los 1000 caracteres.');
  if (v.nacimiento && fecha < v.nacimiento) {
    return mostrarError(error, `La fecha no puede ser anterior al nacimiento del animal (${formatearFecha(v.nacimiento)}).`);
  }
  if ((v.tratamientos || []).some((t) => t.fecha === fecha && String(t.tipo || '').trim().toLowerCase() === tipo.toLowerCase())) {
    return mostrarError(error, `«${tipo}» ya está registrado para este animal el ${formatearFecha(fecha)}.`);
  }

  const nuevo = { id: uid(), fecha, tipo, veterinario: vet, observaciones: obs, creado: Date.now(), creadoPor: usuarioActual.id,
    retiradaCarne: retCarne.valor, retiradaLeche: retLeche.valor };
  const vacasNuevas = vacas.map((x) => (x.id === v.id ? { ...x, tratamientos: [...(x.tratamientos || []), nuevo] } : x));
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) {
    return mostrarError(error, 'No se pudo guardar en este navegador. No se ha modificado ningún dato.');
  }
  vacas = vacasNuevas;

  resetFormTrat();
  renderTratamientos();
  renderVacas();  // actualiza la columna "Sanidad" de la tabla
  renderAgenda(); // y la agenda clínica del veterinario
});

$('trat-lista').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-trat"]');
  if (!btn) return;
  const v = vacaPorId(fichaActualId);
  const t = v && (v.tratamientos || []).find((x) => x.id === btn.dataset.id);
  if (!t || !puedeBorrarTrat(t)) return;
  if (!confirm(`¿Eliminar el registro "${t.tipo}" del ${formatearFecha(t.fecha)}?`)) return;

  const vacasNuevas = vacas.map((x) => (x.id === v.id ? { ...x, tratamientos: (x.tratamientos || []).filter((r) => r.id !== t.id) } : x));
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) return;
  vacas = vacasNuevas;
  renderTratamientos();
  renderVacas();
  renderAgenda();
});

/* ---------- Agenda clínica (perfil veterinario) ----------
   Reúne los tratamientos de todos los animales y fincas de la cuenta: los programados (fecha de hoy en adelante)
   y los realizados en los últimos 30 días, agrupados por finca. Cada fila abre la ficha del animal. */
function renderAgenda() {
  const vet = esVeterinario();
  $('panel-agenda').classList.toggle('hidden', !vet);
  if (!vet) return;

  // El veterinario no ve la localización: la agenda no se agrupa ni se filtra por finca

  const hoy = hoyISO();
  const desde = sumarDias(hoy, -30);
  const visibles = vacas;
  const registros = visibles.flatMap((v) => (v.tratamientos || []).map((t) => ({ v, t })));
  const programados = registros.filter(({ t }) => t.fecha >= hoy).sort((a, b) => a.t.fecha.localeCompare(b.t.fecha));
  const recientes = registros.filter(({ t }) => t.fecha < hoy && t.fecha >= desde).sort((a, b) => b.t.fecha.localeCompare(a.t.fecha));

  $('agenda-resumen').textContent =
    `${visibles.length} ${visibles.length === 1 ? vocab().animal : vocab().animales} · ${programados.length} programados`;

  const fila = (v, t, prog) => {
    let badge = '';
    if (prog) {
      const d = diasHasta(t.fecha);
      const clase = d <= 1 ? 'bg-red-100 text-red-800' : d <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800';
      badge = `<span class="inline-block rounded-full ${clase} px-2 py-0.5 text-xs">${d === 0 ? '¡Hoy!' : `En ${d} ${d === 1 ? 'día' : 'días'}`}</span>`;
    }
    return `
      <li class="py-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div><span class="font-mono text-stone-600">${formatearFecha(t.fecha)}</span> · <span class="font-medium">${esc(t.tipo)}</span> · ${enlaceVaca(v)}
          <span class="text-xs text-stone-500">${t.veterinario ? '· 🩺 ' + esc(t.veterinario) : ''}</span></div>
        ${badge}
      </li>`;
  };
  const bloque = (titulo, lista, vacioTxt, prog) => {
    if (!lista.length) return `<div><h3 class="font-semibold text-sm mb-1">${titulo} (0)</h3><p class="text-sm text-stone-500">${vacioTxt}</p></div>`;
    return `<div><h3 class="font-semibold text-sm mb-1">${titulo} (${lista.length})</h3>` +
      `<ul class="divide-y">${lista.map(({ v, t }) => fila(v, t, prog)).join('')}</ul></div>`;
  };
  $('agenda-lista').innerHTML =
    bloque('📅 Programados', programados, 'No hay tratamientos programados. Añádelos desde la ficha de un animal con una fecha futura.', true) +
    bloque('✅ Realizados en los últimos 30 días', recientes, 'Sin tratamientos en los últimos 30 días.', false);
}


/* ============================================================
   GESTACIÓN, MOVIMIENTOS, BAJAS Y EXPORTACIÓN: eventos
   ============================================================ */
// Gestación: mostrar los campos solo si la vaca está gestante y calcular el parto desde la cubrición
$('vaca-estado').addEventListener('change', actualizarVisibilidadGestacion);
$('vaca-cubricion').addEventListener('change', () => {
  const parto = $('vaca-parto');
  const calculada = partoCalculado($('vaca-cubricion').value, especieForm());
  // Solo se sobrescribe si el usuario no la había corregido a mano
  if (!parto.value || parto.value === parto.dataset.auto) parto.value = calculada;
  parto.dataset.auto = calculada;
});

// Movimientos: pedir la fecha cuando cambia la finca o el lote
$('vaca-finca').addEventListener('change', () => {
  // Un lote pertenece a una sola finca: si el lote elegido no es de la nueva finca, se quita
  const lote = $('vaca-lote').value;
  if (normLote(lote) && !fincasDeLote(lote).some((f) => f.id === $('vaca-finca').value)) renderSelectLoteForm('');
  actualizarHintLote();
  actualizarMovimientoForm();
});
$('vaca-lote').addEventListener('change', () => {
  // Al elegir un lote se propone la finca a la que pertenece
  const propietarias = fincasDeLote($('vaca-lote').value);
  if (propietarias.length && !propietarias.some((f) => f.id === $('vaca-finca').value)) $('vaca-finca').value = propietarias[0].id;
  actualizarHintLote();
  actualizarMovimientoForm();
});

// Panel de próximos partos
$('partos-lista').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'registrar-parto') registrarParto(btn.dataset.id);
  else if (btn.dataset.action === 'editar-gestacion') iniciarEdicionVaca(btn.dataset.id);
});

/* ---------- Dar de baja ---------- */
let bajaVacaId = null;

function abrirBajaModal(id) {
  const v = vacaPorId(id);
  if (!v) return;
  bajaVacaId = id;

  $('baja-modal-vaca').textContent = `${etiquetaVaca(v)}${v.raza ? ' · ' + v.raza : ''}`;
  $('baja-motivo').value = 'Venta';
  $('baja-fecha').value = hoyISO();
  $('baja-detalle').value = '';
  $('baja-doc').value = '';
  $('baja-importe').value = '';
  ocultarError($('baja-error'));
  actualizarEtiquetaBaja();
  actualizarImporteBaja();

  const avisos = [];
  if (v.estado === 'Gestante') avisos.push('Está gestante.');
  const ret = retiradaDe(v);
  if (ret.carne) avisos.push(`⏳ Está en tiempo de espera de medicamentos: no puede ir a matadero hasta el ${formatearFecha(ret.carne)}.`);
  const crias = criasDe(id).length;
  if (crias) avisos.push(`Tiene ${crias} ${crias === 1 ? 'cría activa, que seguirá' : 'crías activas, que seguirán'} registrada${crias === 1 ? '' : 's'} con ella como madre.`);
  $('baja-aviso').textContent = avisos.join(' ');
  $('baja-aviso').classList.toggle('hidden', !avisos.length);

  $('baja-modal').classList.remove('hidden');
  $('baja-modal').classList.add('flex');
}

function cerrarBajaModal() {
  bajaVacaId = null;
  $('baja-modal').classList.add('hidden');
  $('baja-modal').classList.remove('flex');
}

$('baja-motivo').addEventListener('change', actualizarEtiquetaBaja);
$('baja-cancelar').addEventListener('click', cerrarBajaModal);
$('baja-modal').addEventListener('click', (e) => {
  if (e.target === $('baja-modal')) cerrarBajaModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('baja-modal').classList.contains('hidden')) cerrarBajaModal();
});

$('baja-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('baja-error');
  ocultarError(error);

  const v = vacaPorId(bajaVacaId);
  if (!v) return;

  const motivo = $('baja-motivo').value;
  const fecha = $('baja-fecha').value;
  if (!MOTIVOS_BAJA.includes(motivo)) return mostrarError(error, 'Selecciona el motivo de la baja.');
  if (!fecha) return mostrarError(error, 'La fecha de la baja es obligatoria.');
  if (fecha > hoyISO()) return mostrarError(error, 'La fecha de la baja no puede ser futura.');
  if (v.nacimiento && fecha < v.nacimiento) {
    return mostrarError(error, `La baja no puede ser anterior al nacimiento del animal (${formatearFecha(v.nacimiento)}).`);
  }
  const ret = retiradaDe(v);
  if (motivo === 'Sacrificio' && ret.carne && fecha < ret.carne) {
    return mostrarError(error, `No puede ir a matadero hasta el ${formatearFecha(ret.carne)}: está en tiempo de espera de medicamentos.`);
  }
  // Venta o sacrificio con importe: se anota como ingreso enlazado al animal
  let ingresoBaja = null;
  const textoImporte = $('baja-importe').value;
  if (CATEGORIA_BAJA[motivo] && String(textoImporte).trim() && !esVeterinario()) {
    const imp = leerImporte(textoImporte);
    if (imp.error) return mostrarError(error, imp.error);
    const detalle = $('baja-detalle').value.trim();
    ingresoBaja = { id: uid(), fecha, tipo: 'ingreso', categoria: CATEGORIA_BAJA[motivo],
      concepto: `${motivo} de ${etiquetaVaca(v)}${detalle ? ' · ' + detalle : ''}`.slice(0, 200), importe: imp.valor, animalId: v.id, origen: 'baja' };
  }

  const registro = {
    ...v,
    baja: {
      fecha,
      motivo,
      detalle: $('baja-detalle').value.trim(),
      documento: $('baja-doc').value.trim(),
      finca: nombreFinca(v.fincaId) || '',
      lote: v.lote || '',
      registrado: Date.now()
    }
  };

  // Histórico y censo se guardan juntos: o se guarda todo o no se toca nada (nunca se pierde ni se duplica el animal)
  const bajasNuevas = [...bajas, registro];
  const vacasNuevas = vacas.filter((x) => x.id !== v.id);
  const economiaNueva = ingresoBaja ? [...economia, ingresoBaja] : economia;
  if (!guardarTransaccion([[KEYS.bajas, bajasNuevas], [KEYS.vacas, vacasNuevas], [KEYS.economia, economiaNueva]])) {
    return mostrarError(error, 'No se pudo guardar la baja en este navegador. No se ha modificado ningún dato.');
  }
  bajas = bajasNuevas;
  vacas = vacasNuevas;
  economia = economiaNueva;

  if (editVacaId === v.id) resetFormVaca();
  cerrarFicha();
  cerrarBajaModal();
  renderTodo();
  mostrarAvisoVaca(`✔ Baja registrada: ${etiquetaVaca(v)} (${motivo.toLowerCase()}, ${formatearFecha(fecha)}). Lo tienes en «Histórico de bajas».` +
    (ingresoBaja ? ` Ingreso de ${euros(ingresoBaja.importe)} anotado en «Economía».` : ''));
});

$('vaca-modal-baja').addEventListener('click', () => {
  const id = fichaActualId;
  cerrarFicha();
  abrirBajaModal(id);
});

/* ---------- Histórico de bajas ---------- */
['baja-buscar'].forEach((id) => $(id).addEventListener('input', renderBajas));
['baja-filtro-motivo', 'baja-filtro-anio'].forEach((id) => $(id).addEventListener('change', renderBajas));

$('bajas-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="reactivar-vaca"]');
  if (!btn) return;
  const b = bajas.find((x) => x.id === btn.dataset.id);
  if (!b) return;
  if (vacas.some((v) => v.crotal.toLowerCase() === b.crotal.toLowerCase())) {
    return alert(`No se puede reactivar: ya existe otro animal con la identificación ${b.crotal}.`);
  }
  const ingresosBaja = economia.filter((m) => m.animalId === b.id && m.origen === 'baja');
  if (!confirm(`¿Reactivar a ${etiquetaVaca(b)}?\n\nVolverá al listado de vacas y se quitará del histórico de bajas.` +
    (ingresosBaja.length ? `\nTambién se borrará el ingreso de su ${b.baja.motivo.toLowerCase()} (${euros(sumaImportes(ingresosBaja))}) de «Economía».` : ''))) return;

  const { baja, ...animal } = b;
  // Mientras estaba de baja pudo borrarse su finca o cambiar el lote: se revalida la ubicación
  const avisosReactivar = [];
  if (animal.fincaId && !fincas.some((f) => f.id === animal.fincaId)) {
    animal.fincaId = '';
    animal.lote = '';
    avisosReactivar.push('su finca ya no existe (queda sin finca ni lote)');
  } else if (animal.lote && validarUbicacion(animal.lote, animal.fincaId)) {
    animal.lote = '';
    avisosReactivar.push('su lote ya no pertenece a su finca (queda sin lote)');
  }
  if (!ESPECIES[animal.especie]) animal.especie = especiesCuenta()[0];
  const movsReactivar = entradasMovimiento(b, animal, hoyISO());
  if (movsReactivar.length) animal.movimientos = [...(animal.movimientos || []), ...movsReactivar];
  const vacasNuevas = [...vacas, animal];
  const bajasNuevas = bajas.filter((x) => x.id !== b.id);
  const economiaNueva = economia.filter((m) => !(m.animalId === b.id && m.origen === 'baja'));
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas], [KEYS.bajas, bajasNuevas], [KEYS.economia, economiaNueva]])) return;
  vacas = vacasNuevas;
  bajas = bajasNuevas;
  economia = economiaNueva;
  renderTodo();
  if (avisosReactivar.length) mostrarAvisoVaca(`✔ ${etiquetaVaca(animal)} reactivado/a; ${avisosReactivar.join(' y ')}.`);
});

/* ---------- Exportar a Excel / CSV ---------- */
$('btn-export-vacas').addEventListener('click', () => {
  const lista = vacasFiltradas();
  if (!lista.length) return alert('No hay animales que exportar con los filtros actuales.');
  descargarCSV(`animales_${hoyISO()}.csv`, cabeceraVacas(), filasVacas(lista));
  mostrarAvisoVaca(`⬇ Exportados ${lista.length} ${lista.length === 1 ? 'animal' : 'animales'} (con los filtros actuales).`);
});

$('btn-export-fincas').addEventListener('click', () => {
  if (!fincas.length) return alert('No hay fincas que exportar.');
  descargarCSV(`fincas_${hoyISO()}.csv`, CABECERA_FINCAS, filasFincas());
});

$('btn-export-bajas').addEventListener('click', () => {
  const lista = bajasFiltradas();
  if (!lista.length) return alert('No hay bajas que exportar con los filtros actuales.');
  descargarCSV(`bajas_${hoyISO()}.csv`, cabeceraBajas(), filasBajas(lista));
});

/* ---------- Arranque ---------- */

/* ============================================================
   CEBADEROS: cebaderos de la explotación y registro de entradas / salidas
   Cada registro (estancia) guarda animal, cebadero, fechas y pesos de entrada y salida.
   Productividad: días de cebo, kg ganados y ganancia media diaria (GMD = kg ganados / días).
   ============================================================ */
const PESO_MAX_KG = 2000;
const FIN_ABIERTO = '9999-12-31';

function diasEntre(desde, hasta) {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
const formatoNum = (n, dec = 1) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: dec });
const cebaderoPorId = (id) => cebaderos.find((c) => c.id === id) || null;
const nombreCebadero = (id) => (cebaderoPorId(id) || {}).nombre || '—';
const cebosDe = (animalId) => cebos.filter((r) => r.animalId === animalId).sort((a, b) => b.entrada.localeCompare(a.entrada));
const ceboAbiertoDe = (animalId) => cebos.find((r) => r.animalId === animalId && !r.salida) || null;
const ocupacion = (cebaderoId) => cebos.filter((r) => r.cebaderoId === cebaderoId && !r.salida).length;

// Días (hasta hoy si sigue dentro), kg ganados y GMD (solo con salida y ambos pesos)
function metricasCebo(r) {
  const fin = r.salida || hoyISO();
  const dias = Math.max(0, diasEntre(r.entrada, fin));
  const conPesos = r.salida && r.pesoEntrada > 0 && r.pesoSalida > 0;
  const kg = conPesos ? r.pesoSalida - r.pesoEntrada : null;
  const gmd = conPesos && dias > 0 ? kg / dias : null;
  return { dias, kg, gmd };
}

function resumenCebo(lista) {
  const terminados = lista.filter((r) => r.salida);
  const conGmd = terminados.map(metricasCebo).filter((m) => m.gmd !== null);
  const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    dentro: lista.filter((r) => !r.salida).length,
    terminados: terminados.length,
    diasMedios: media(terminados.map((r) => metricasCebo(r).dias)),
    gmdMedia: media(conGmd.map((m) => m.gmd)),
    nGmd: conGmd.length
  };
}

function leerPeso(id) {
  const t = String($(id).value || '').trim().replace(',', '.');
  if (!t) return { valor: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > PESO_MAX_KG) return { error: `El peso debe ser un número entre 0 y ${PESO_MAX_KG} kg.` };
  return { valor: Math.round(n * 10) / 10 };
}

/* ---------- Cebaderos (alta, edición, borrado) ---------- */
function resetFormCebadero() {
  editCebaderoId = null;
  $('cebadero-form').reset();
  ocultarError($('cebadero-error'));
  $('cebadero-submit').textContent = 'Añadir cebadero';
  $('cebadero-cancel').classList.add('hidden');
}

$('cebadero-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('cebadero-error');
  ocultarError(error);
  const nombre = $('cebadero-nombre').value.trim().replace(/\s+/g, ' ');
  const ubicacion = $('cebadero-ubicacion').value.trim();
  const capTxt = String($('cebadero-capacidad').value || '').trim();
  if (!nombre) return mostrarError(error, 'El nombre del cebadero es obligatorio.');
  if (nombre.length > 120) return mostrarError(error, 'El nombre no puede superar los 120 caracteres.');
  if (ubicacion.length > 200) return mostrarError(error, 'La ubicación no puede superar los 200 caracteres.');
  if (cebaderos.some((c) => c.id !== editCebaderoId && c.nombre.toLowerCase() === nombre.toLowerCase())) {
    return mostrarError(error, 'Ya tienes un cebadero con ese nombre.');
  }
  let capacidad = null;
  if (capTxt) {
    capacidad = Number(capTxt);
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100000) return mostrarError(error, 'Las plazas deben ser un número entero.');
    if (editCebaderoId && ocupacion(editCebaderoId) > capacidad) {
      return mostrarError(error, `Ahora mismo hay ${ocupacion(editCebaderoId)} animales dentro: las plazas no pueden ser menos.`);
    }
  }
  const datos = { nombre, ubicacion, capacidad };
  const nuevos = editCebaderoId
    ? cebaderos.map((c) => (c.id === editCebaderoId ? { ...c, ...datos } : c))
    : [...cebaderos, { id: uid(), ...datos }];
  if (!guardarTransaccion([[KEYS.cebaderos, nuevos]])) return mostrarError(error, 'No se pudo guardar en este navegador.');
  cebaderos = nuevos;
  resetFormCebadero();
  renderCebaderos();
});
$('cebadero-cancel').addEventListener('click', () => { resetFormCebadero(); renderCebaderos(); });

$('cebaderos-lista').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const c = cebaderoPorId(btn.dataset.id);
  if (!c) return;
  if (btn.dataset.action === 'edit-cebadero') {
    editCebaderoId = c.id;
    $('cebadero-nombre').value = c.nombre;
    $('cebadero-ubicacion').value = c.ubicacion || '';
    $('cebadero-capacidad').value = c.capacidad || '';
    $('cebadero-submit').textContent = 'Guardar cambios';
    $('cebadero-cancel').classList.remove('hidden');
    ocultarError($('cebadero-error'));
    renderCebaderos();
    $('cebadero-nombre').focus();
  } else if (btn.dataset.action === 'del-cebadero') {
    const n = cebos.filter((r) => r.cebaderoId === c.id).length;
    if (n) return mostrarError($('cebadero-error'), `«${c.nombre}» tiene ${n} ${n === 1 ? 'registro' : 'registros'} de cebo: no se puede eliminar.`);
    if (!confirm(`¿Eliminar el cebadero «${c.nombre}»?`)) return;
    const nuevos = cebaderos.filter((x) => x.id !== c.id);
    if (!guardarTransaccion([[KEYS.cebaderos, nuevos]])) return;
    cebaderos = nuevos;
    if (editCebaderoId === c.id) resetFormCebadero();
    renderCebaderos();
  }
});

/* ---------- Registro de entradas y salidas ---------- */
// Solo entran en el cebadero las crías: ternera / ternero (o la cría equivalente en otras especies)
function esTernero(a) {
  return !!a && Object.values(ESPECIES[especieDe(a)].estadoCria).includes(a.estado);
}

// Animales que se pueden meter: terneros activos que no estén ya en un cebadero (al editar, también el del registro)
function animalesParaCebo() {
  const actual = editCeboId ? (cebos.find((r) => r.id === editCeboId) || {}).animalId : null;
  const lista = vacas.filter((v) => v.id === actual || (esTernero(v) && !ceboAbiertoDe(v.id)));
  const extra = actual && !lista.some((v) => v.id === actual) ? [vacaAnyPorId(actual)].filter(Boolean) : [];
  return [...lista, ...extra].sort((a, b) => a.crotal.localeCompare(b.crotal, 'es'));
}

function renderSelectsCebo() {
  const selCeb = $('cebo-cebadero');
  const prevCeb = selCeb.value;
  selCeb.innerHTML = '<option value="">Elige cebadero…</option>' + cebaderos
    .map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}${c.capacidad ? ` (${ocupacion(c.id)}/${c.capacidad})` : ''}</option>`).join('');
  selCeb.value = cebaderos.some((c) => c.id === prevCeb) ? prevCeb : (cebaderos.length === 1 ? cebaderos[0].id : '');

  const selAni = $('cebo-animal');
  const prevAni = selAni.value;
  const lista = animalesParaCebo();
  selAni.innerHTML = '<option value="">Elige animal…</option>' + lista.map((a) => {
    const edad = edadTexto(a.nacimiento);
    return `<option value="${esc(a.id)}">${esMixta() ? emojiAnimal(a) + ' ' : ''}${esc(etiquetaVaca(a))} · ${SIMBOLO_SEXO[sexoDe(a)]} ${esc(a.estado || '')}${edad ? ' · ' + esc(edad) : ''}${a.baja ? ' · baja' : ''}</option>`;
  }).join('');
  selAni.value = lista.some((a) => a.id === prevAni) ? prevAni : '';
  $('cebo-animal-hint').textContent = editCeboId ? ''
    : (lista.length ? 'Solo aparecen terneros y terneras que no estén ya en un cebadero.'
      : 'No hay terneros ni terneras disponibles (deben estar en estado «Ternera» o «Ternero» y fuera de cualquier cebadero).');

  ['cebo-filtro-cebadero', 'cebo-actual-cebadero'].forEach((id) => {
    const filtro = $(id);
    const prevF = filtro.value;
    filtro.innerHTML = '<option value="">Todos los cebaderos</option>' + cebaderos.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
    filtro.value = cebaderos.some((c) => c.id === prevF) ? prevF : '';
  });
}

function resetFormCebo() {
  editCeboId = null;
  $('cebo-form').reset();
  $('cebo-entrada').value = hoyISO();
  $('cebo-salida-wrap').classList.add('hidden');
  ocultarError($('cebo-error'));
  $('cebo-form-titulo').textContent = 'Registrar entrada';
  $('cebo-submit').textContent = 'Registrar entrada';
  $('cebo-cancel').classList.add('hidden');
  $('cebo-animal').disabled = false;
  renderSelectsCebo();
}

function iniciarEdicionCebo(id, soloSalida = false) {
  const r = cebos.find((x) => x.id === id);
  if (!r) return;
  editCeboId = id;
  renderSelectsCebo();
  $('cebo-cebadero').value = r.cebaderoId;
  $('cebo-animal').value = r.animalId;
  $('cebo-animal').disabled = true; // el animal de un registro no se cambia (se borra y se crea otro)
  $('cebo-entrada').value = r.entrada;
  $('cebo-peso-entrada').value = r.pesoEntrada || '';
  $('cebo-salida').value = r.salida || (soloSalida ? hoyISO() : '');
  $('cebo-peso-salida').value = r.pesoSalida || '';
  $('cebo-obs').value = r.observaciones || '';
  $('cebo-salida-wrap').classList.remove('hidden');
  // Destino al salir: solo cuando se registra la salida de un animal que sigue en el censo
  $('cebo-destino').innerHTML = '<option value="">Ninguna (venta, matadero o pendiente)</option>' +
    fincas.map((f) => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('');
  $('cebo-destino').value = '';
  $('cebo-destino-wrap').classList.toggle('hidden', !!r.salida || !vacaPorId(r.animalId));
  ocultarError($('cebo-error'));
  const a = vacaAnyPorId(r.animalId);
  $('cebo-form-titulo').textContent = soloSalida ? `Registrar salida · ${etiquetaVaca(a)}` : `Editar registro · ${etiquetaVaca(a)}`;
  $('cebo-submit').textContent = soloSalida ? 'Registrar salida' : 'Guardar cambios';
  $('cebo-cancel').classList.remove('hidden');
  $('cebo-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  (soloSalida ? $('cebo-peso-salida') : $('cebo-entrada')).focus();
}

$('cebo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('cebo-error');
  ocultarError(error);
  const previo = editCeboId ? cebos.find((r) => r.id === editCeboId) : null;
  const cebaderoId = $('cebo-cebadero').value;
  const animalId = previo ? previo.animalId : $('cebo-animal').value;
  const entrada = $('cebo-entrada').value;
  const salida = previo ? $('cebo-salida').value : '';
  const observaciones = $('cebo-obs').value.trim();

  const ceb = cebaderoPorId(cebaderoId);
  if (!ceb) return mostrarError(error, cebaderos.length ? 'Elige el cebadero.' : 'Primero añade un cebadero.');
  const animal = vacaAnyPorId(animalId);
  if (!animal) return mostrarError(error, 'Elige el animal.');
  if (!previo && animal.baja) return mostrarError(error, 'Ese animal está dado de baja.');
  if (!previo && !esTernero(animal)) return mostrarError(error, `Solo pueden entrar en el cebadero terneros y terneras (${etiquetaVaca(animal)} está como «${animal.estado}»).`);
  if (!entrada) return mostrarError(error, 'Indica la fecha de entrada.');
  if (entrada > hoyISO()) return mostrarError(error, 'La fecha de entrada no puede ser futura.');
  if (animal.nacimiento && entrada < animal.nacimiento) return mostrarError(error, 'La entrada no puede ser anterior al nacimiento del animal.');
  if (salida) {
    if (salida > hoyISO()) return mostrarError(error, 'La fecha de salida no puede ser futura.');
    if (salida < entrada) return mostrarError(error, 'La salida no puede ser anterior a la entrada.');
  }
  const pe = leerPeso('cebo-peso-entrada');
  if (pe.error) return mostrarError(error, 'Peso de entrada: ' + pe.error);
  const ps = previo ? leerPeso('cebo-peso-salida') : { valor: null };
  if (ps.error) return mostrarError(error, 'Peso de salida: ' + ps.error);
  if (ps.valor !== null && !salida) return mostrarError(error, 'Para anotar el peso de salida, indica también la fecha de salida.');
  if (observaciones.length > 500) return mostrarError(error, 'Las observaciones no pueden superar los 500 caracteres.');

  // Un animal no puede estar en dos cebaderos a la vez (los periodos no se solapan)
  const fin = salida || FIN_ABIERTO;
  const choque = cebos.find((r) => r.id !== editCeboId && r.animalId === animalId && r.entrada < fin && entrada < (r.salida || FIN_ABIERTO));
  if (choque) {
    return mostrarError(error, `Ese animal ya estaba en «${nombreCebadero(choque.cebaderoId)}» desde el ${formatearFecha(choque.entrada)}` +
      (choque.salida ? ` hasta el ${formatearFecha(choque.salida)}.` : ' y aún no ha salido. Registra antes su salida.'));
  }
  // Plazas libres (solo cuenta si el animal queda dentro y no estaba ya ocupando plaza en ese cebadero)
  const ocupaPlaza = !salida && (!previo || previo.salida || previo.cebaderoId !== cebaderoId);
  if (ocupaPlaza && ceb.capacidad && ocupacion(ceb.id) >= ceb.capacidad) {
    return mostrarError(error, `«${ceb.nombre}» está lleno (${ceb.capacidad} plazas).`);
  }

  const datos = { cebaderoId, animalId, entrada, pesoEntrada: pe.valor, salida, pesoSalida: ps.valor, observaciones };
  const nuevos = previo ? cebos.map((r) => (r.id === previo.id ? { ...r, ...datos } : r)) : [...cebos, { id: uid(), ...datos }];

  // Localización del animal: dentro del cebadero no está en ninguna finca; al salir puede ir a una finca
  let vacasNuevas = vacas;
  const activo = vacaPorId(animalId);
  if (activo) {
    const movs = [];
    let cambio = {};
    const entraAhora = !salida && (!previo || previo.salida);
    const saleAhora = salida && previo && !previo.salida;
    if (entraAhora) {
      movs.push(...entradasMovimiento(activo, { fincaId: '', lote: '' }, entrada));
      movs.push({ id: uid(), fecha: entrada, campo: 'Cebadero', desde: '', hasta: ceb.nombre, creado: Date.now() });
      cambio = { fincaId: '', lote: '' };
    } else if (!salida && (activo.fincaId || activo.lote)) {
      cambio = { fincaId: '', lote: '' };
    }
    if (saleAhora) {
      const destino = $('cebo-destino').value;
      movs.push({ id: uid(), fecha: salida, campo: 'Cebadero', desde: ceb.nombre, hasta: nombreFinca(destino) || '', creado: Date.now() });
      if (destino && fincas.some((f) => f.id === destino)) {
        movs.push(...entradasMovimiento({ fincaId: '', lote: '' }, { fincaId: destino, lote: '' }, salida));
        cambio = { fincaId: destino, lote: '' };
      }
    }
    if (movs.length || Object.keys(cambio).length) {
      vacasNuevas = vacas.map((v) => (v.id === activo.id ? { ...v, ...cambio, movimientos: [...(v.movimientos || []), ...movs] } : v));
    }
  }
  if (!guardarTransaccion([[KEYS.cebos, nuevos], [KEYS.vacas, vacasNuevas]])) return mostrarError(error, 'No se pudo guardar en este navegador.');
  cebos = nuevos;
  vacas = vacasNuevas;
  renderTodo();
  resetFormCebo();
  renderCebaderos();
});
$('cebo-cancel').addEventListener('click', () => { resetFormCebo(); });

// Rango de meses del filtro («2024-06» a «2024-08» → del 01/06/2024 al 31/08/2024)
function rangoCebo() {
  const desde = $('cebo-desde').value ? $('cebo-desde').value + '-01' : '';
  let hasta = '';
  if ($('cebo-hasta').value) {
    const [y, m] = $('cebo-hasta').value.split('-').map(Number);
    hasta = `${$('cebo-hasta').value}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  }
  return { desde, hasta };
}

function renderCebaderos() {
  renderSelectsCebo();
  if (!editCeboId && !$('cebo-entrada').value) $('cebo-entrada').value = hoyISO();
  const res = resumenCebo(cebos);
  $('stat-cebo-dentro').textContent = res.dentro;
  $('stat-cebo-salidas').textContent = res.terminados;
  $('stat-cebo-dias').textContent = res.diasMedios === null ? '—' : formatoNum(res.diasMedios, 0);
  $('stat-cebo-gmd').textContent = res.gmdMedia === null ? '—' : formatoNum(res.gmdMedia, 2);
  $('stat-cebo-gmd-nota').textContent = res.nGmd
    ? `kg/día · media de ${res.nGmd} ${res.nGmd === 1 ? 'salida pesada' : 'salidas pesadas'}`
    : 'kg/día · anota pesos de entrada y salida';

  // Tarjetas de cebaderos con ocupación y productividad
  $('cebaderos-lista').innerHTML = cebaderos.length
    ? cebaderos.map((c) => {
        const r = resumenCebo(cebos.filter((x) => x.cebaderoId === c.id));
        const pct = c.capacidad ? Math.min(100, Math.round((r.dentro / c.capacidad) * 100)) : null;
        return `<div class="rounded-lg border border-stone-200 p-3 ${editCebaderoId === c.id ? 'bg-amber-50' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-semibold">${esc(c.nombre)}</p>
              ${c.ubicacion ? `<p class="text-xs text-stone-500">${esc(c.ubicacion)}</p>` : ''}
            </div>
            <div class="whitespace-nowrap text-sm">
              <button type="button" data-action="edit-cebadero" data-id="${esc(c.id)}" class="text-blue-600 hover:underline mr-2">Editar</button>
              <button type="button" data-action="del-cebadero" data-id="${esc(c.id)}" class="text-red-600 hover:underline">Eliminar</button>
            </div>
          </div>
          <p class="text-sm mt-2">${r.dentro} ${r.dentro === 1 ? 'animal dentro' : 'animales dentro'}${c.capacidad ? ` de ${c.capacidad} plazas` : ''}</p>
          ${pct !== null ? `<div class="h-2 rounded-full bg-stone-200 mt-1 overflow-hidden"><div class="h-2 ${pct >= 100 ? 'bg-red-500' : 'bg-emerald-600'}" style="width:${pct}%"></div></div>` : ''}
          <p class="text-xs text-stone-500 mt-2">${r.terminados} ${r.terminados === 1 ? 'salida' : 'salidas'}${r.diasMedios !== null ? ` · ${formatoNum(r.diasMedios, 0)} días de media` : ''}${r.gmdMedia !== null ? ` · GMD ${formatoNum(r.gmdMedia, 2)} kg/día` : ''}</p>
        </div>`;
      }).join('')
    : '<p class="text-sm text-stone-500">Todavía no hay cebaderos. Añade el primero con el formulario.</p>';

  renderTablasCebo();
}

// Filtro de texto común a las dos tablas (crotal, nombre o raza)
function coincideTextoCebo(r, texto) {
  const a = vacaAnyPorId(r.animalId) || {};
  return !texto || [a.crotal, a.nombre, a.raza].some((c) => String(c || '').toLowerCase().includes(texto));
}

// Terneros que están ahora en un cebadero
function cebosActuales() {
  const texto = $('cebo-actual-buscar').value.trim().toLowerCase();
  const ceb = $('cebo-actual-cebadero').value;
  return cebos
    .filter((r) => !r.salida && (!ceb || r.cebaderoId === ceb) && coincideTextoCebo(r, texto))
    .sort((a, b) => b.entrada.localeCompare(a.entrada));
}

// Histórico: solo los que ya salieron. Con periodo, los que estuvieron dentro en algún momento de él.
function cebosFiltrados() {
  const texto = $('cebo-buscar').value.trim().toLowerCase();
  const ceb = $('cebo-filtro-cebadero').value;
  const { desde, hasta } = rangoCebo();
  return cebos
    .filter((r) => {
      if (!r.salida) return false;
      if (ceb && r.cebaderoId !== ceb) return false;
      if (hasta && r.entrada > hasta) return false;
      if (desde && r.salida < desde) return false;
      return coincideTextoCebo(r, texto);
    })
    .sort((a, b) => b.salida.localeCompare(a.salida) || b.entrada.localeCompare(a.entrada));
}

function celdasAnimalCebo(r) {
  const a = vacaAnyPorId(r.animalId);
  return `<td class="py-2 pr-4">${a ? enlaceVaca(a) : '—'}${a && a.baja ? ' <span class="text-xs text-stone-500">(baja)</span>' : ''}</td>
      <td class="py-2 pr-4 whitespace-nowrap">${a ? SIMBOLO_SEXO[sexoDe(a)] + ' ' + esc(a.raza || '') : ''}</td>
      <td class="py-2 pr-4">${esc(nombreCebadero(r.cebaderoId))}</td>`;
}

function renderTablasCebo() {
  const nada = '<span class="text-stone-400">—</span>';
  const kg = (v) => (v ? formatoNum(v, 1) : nada);
  const botones = (r) => `
        <button type="button" data-action="edit-cebo" data-id="${esc(r.id)}" class="text-blue-600 hover:underline text-sm mr-3">Editar</button>
        <button type="button" data-action="del-cebo" data-id="${esc(r.id)}" class="text-red-600 hover:underline text-sm">Borrar</button>`;

  // 1) En el cebadero ahora
  const actuales = cebosActuales();
  const totalDentro = cebos.filter((r) => !r.salida).length;
  $('cebo-actual-total').textContent = totalDentro ? `(${totalDentro})` : '';
  $('cebo-actual-body').innerHTML = actuales.map((r) => `<tr class="border-b last:border-0 hover:bg-stone-50">
      ${celdasAnimalCebo(r)}
      <td class="py-2 pr-4 whitespace-nowrap">${formatearFecha(r.entrada)}</td>
      <td class="py-2 pr-4 text-right">${kg(r.pesoEntrada)}</td>
      <td class="py-2 pr-4 text-right">${metricasCebo(r).dias}</td>
      <td class="py-2 text-right whitespace-nowrap">
        <button type="button" data-action="salida-cebo" data-id="${esc(r.id)}" class="text-emerald-700 hover:underline text-sm font-medium mr-3">Registrar salida</button>${botones(r)}
      </td>
    </tr>`).join('');
  $('cebo-actual-vacio').classList.toggle('hidden', actuales.length > 0);
  $('cebo-actual-vacio').textContent = totalDentro ? 'Ningún ternero coincide con la búsqueda.' : 'Ahora mismo no hay terneros en los cebaderos.';

  // 2) Histórico
  const lista = cebosFiltrados();
  $('cebo-body').innerHTML = lista.map((r) => {
    const m = metricasCebo(r);
    return `<tr class="border-b last:border-0 hover:bg-stone-50">
      ${celdasAnimalCebo(r)}
      <td class="py-2 pr-4 whitespace-nowrap">${formatearFecha(r.entrada)}</td>
      <td class="py-2 pr-4 whitespace-nowrap">${formatearFecha(r.salida)}</td>
      <td class="py-2 pr-4 text-right">${kg(r.pesoEntrada)}</td>
      <td class="py-2 pr-4 text-right">${kg(r.pesoSalida)}</td>
      <td class="py-2 pr-4 text-right">${m.dias}</td>
      <td class="py-2 pr-4 text-right">${m.kg === null ? nada : formatoNum(m.kg, 1)}</td>
      <td class="py-2 pr-4 text-right font-medium">${m.gmd === null ? nada : formatoNum(m.gmd, 2)}</td>
      <td class="py-2 text-right whitespace-nowrap">${botones(r)}</td>
    </tr>`;
  }).join('');
  const totalSalidos = cebos.filter((r) => r.salida).length;
  $('cebo-vacio').classList.toggle('hidden', lista.length > 0);
  $('cebo-vacio').textContent = totalSalidos ? 'Ningún ternero coincide con los filtros.' : 'Todavía no ha salido ningún ternero del cebadero.';

  // Resumen del histórico que se ve (p. ej. un periodo concreto)
  const rf = resumenCebo(lista);
  const { desde, hasta } = rangoCebo();
  const periodo = desde || hasta ? ` entre ${desde ? formatearFecha(desde) : 'el inicio'} y ${hasta ? formatearFecha(hasta) : 'hoy'}` : '';
  $('cebo-resumen').textContent = lista.length
    ? `${lista.length} ${lista.length === 1 ? 'ternero/a' : 'terneros/as'}${periodo}` +
      (rf.diasMedios !== null ? ` · ${formatoNum(rf.diasMedios, 0)} días de media` : '') +
      (rf.gmdMedia !== null ? ` · GMD media ${formatoNum(rf.gmdMedia, 2)} kg/día` : '')
    : '';
  $('cebo-resumen').classList.toggle('hidden', !lista.length);
}

function clicTablaCebo(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const r = cebos.find((x) => x.id === btn.dataset.id);
  if (!r) return;
  if (btn.dataset.action === 'salida-cebo') iniciarEdicionCebo(r.id, true);
  else if (btn.dataset.action === 'edit-cebo') iniciarEdicionCebo(r.id);
  else if (btn.dataset.action === 'del-cebo') {
    const a = vacaAnyPorId(r.animalId);
    if (!confirm(`¿Borrar el registro de cebo de ${a ? etiquetaVaca(a) : 'este animal'} (entrada del ${formatearFecha(r.entrada)})?`)) return;
    const nuevos = cebos.filter((x) => x.id !== r.id);
    if (!guardarTransaccion([[KEYS.cebos, nuevos]])) return;
    cebos = nuevos;
    if (editCeboId === r.id) resetFormCebo();
    renderCebaderos();
  }
}
$('cebo-actual-body').addEventListener('click', clicTablaCebo);
$('cebo-body').addEventListener('click', clicTablaCebo);
$('cebo-actual-buscar').addEventListener('input', renderTablasCebo);
$('cebo-actual-cebadero').addEventListener('change', renderTablasCebo);
$('cebo-buscar').addEventListener('input', renderTablasCebo);
$('cebo-filtro-cebadero').addEventListener('change', renderTablasCebo);
$('cebo-desde').addEventListener('change', renderTablasCebo);
$('cebo-hasta').addEventListener('change', renderTablasCebo);
$('cebo-periodo-limpiar').addEventListener('click', () => {
  $('cebo-desde').value = '';
  $('cebo-hasta').value = '';
  renderTablasCebo();
});

const CABECERA_CEBO = ['Crotal', 'Nombre', 'Sexo', 'Raza', 'Fecha de nacimiento', 'Cebadero', 'Fecha de entrada', 'Peso de entrada (kg)',
  'Fecha de salida', 'Peso de salida (kg)', 'Días de cebo', 'Kg ganados', 'Ganancia media diaria (kg/día)', 'Observaciones'];
$('btn-export-cebo').addEventListener('click', () => {
  const filas = cebosFiltrados().map((r) => {
    const a = vacaAnyPorId(r.animalId) || {};
    const m = metricasCebo(r);
    return [a.crotal || '', a.nombre || '', SEXOS[sexoDe(a)], a.raza || '', fechaCSV(a.nacimiento), nombreCebadero(r.cebaderoId),
      fechaCSV(r.entrada), r.pesoEntrada || '', fechaCSV(r.salida), r.pesoSalida || '', m.dias,
      m.kg === null ? '' : Math.round(m.kg * 10) / 10, m.gmd === null ? '' : Math.round(m.gmd * 1000) / 1000, r.observaciones || ''];
  });
  descargarCSV(`cebo_${hoyISO()}.csv`, CABECERA_CEBO.map((h) => (h === 'Crotal' ? vocab().crotal : h)), filas);
});

/* ============================================================
   ECONOMÍA (solo ganadero): gastos e ingresos de la explotación
   Cada movimiento: { id, fecha, tipo: 'gasto'|'ingreso', categoria, concepto, importe, animalId, origen }
   origen 'baja' = ingreso creado al vender o sacrificar un animal (se quita si el animal se reactiva).
   ============================================================ */
const CATEGORIAS_ECO = {
  gasto: ['Pienso y forraje', 'Veterinario y medicamentos', 'Compra de animales', 'Mano de obra', 'Combustible',
    'Luz y agua', 'Maquinaria y reparaciones', 'Seguros', 'Cuotas y tasas', 'Otros gastos'],
  ingreso: ['Venta de animales', 'Matadero', 'Subvenciones (PAC)', 'Otros ingresos']
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const IMPORTE_MAX = 99999999;
let ecoTipo = 'gasto';
let editEcoId = null;

const euros = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const sumaImportes = (lista) => Math.round(lista.reduce((s, m) => s + Number(m.importe || 0), 0) * 100) / 100;

// Periodo elegido: año y, opcionalmente, mes ('01'…'12')
function periodoEco() {
  const anio = $('eco-anio').value || hoyISO().slice(0, 4);
  const mes = $('eco-mes').value;
  return { anio, mes, prefijo: mes ? `${anio}-${mes}` : anio };
}
const textoPeriodo = () => {
  const { anio, mes } = periodoEco();
  return mes ? `· ${MESES[Number(mes) - 1]} ${anio}` : `· ${anio}`;
};

function renderSelectsEco() {
  const actualAnio = $('eco-anio').value;
  const actualMes = $('eco-mes').value;
  const anios = new Set([hoyISO().slice(0, 4), ...economia.map((m) => String(m.fecha || '').slice(0, 4)).filter(Boolean)]);
  const lista = [...anios].sort().reverse();
  $('eco-anio').innerHTML = lista.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  $('eco-anio').value = lista.includes(actualAnio) ? actualAnio : hoyISO().slice(0, 4);
  $('eco-mes').innerHTML = '<option value="">Todo el año</option>' +
    MESES.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${cap(m)}</option>`).join('');
  $('eco-mes').value = actualMes || '';

  const cat = $('eco-categoria').value;
  $('eco-categoria').innerHTML = CATEGORIAS_ECO[ecoTipo].map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (CATEGORIAS_ECO[ecoTipo].includes(cat)) $('eco-categoria').value = cat;

  const ani = $('eco-animal').value;
  const todos = [...vacas, ...bajas].sort((a, b) => String(a.crotal).localeCompare(String(b.crotal), 'es'));
  $('eco-animal').innerHTML = '<option value="">— Ninguno —</option>' + todos
    .map((a) => `<option value="${esc(a.id)}">${esc(etiquetaVaca(a))}${a.baja ? ' · baja' : ''}</option>`).join('');
  $('eco-animal').value = todos.some((a) => a.id === ani) ? ani : '';
  const ceb = $('eco-cebadero').value;
  $('eco-cebadero').innerHTML = '<option value="">— Ninguno —</option>' + cebaderos.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
  $('eco-cebadero').value = cebaderos.some((c) => c.id === ceb) ? ceb : '';
  $('eco-cebadero-wrap').classList.toggle('hidden', ecoTipo !== 'gasto' || !cebaderos.length);

  document.querySelectorAll('.eco-tipo-btn').forEach((b) => {
    const activo = b.dataset.ecoTipo === ecoTipo;
    b.classList.remove('bg-white', 'shadow', 'text-red-700', 'text-emerald-800');
    if (activo) b.classList.add('bg-white', 'shadow', ecoTipo === 'gasto' ? 'text-red-700' : 'text-emerald-800');
  });
}

function movimientosEcoFiltrados() {
  const { prefijo } = periodoEco();
  const texto = $('eco-buscar').value.trim().toLowerCase();
  const tipo = $('eco-filtro-tipo').value;
  return economia
    .filter((m) => String(m.fecha || '').startsWith(prefijo) && (!tipo || m.tipo === tipo))
    .filter((m) => {
      if (!texto) return true;
      const a = vacaAnyPorId(m.animalId) || {};
      return [m.concepto, m.categoria, a.crotal, a.nombre].some((c) => String(c || '').toLowerCase().includes(texto));
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function barrasCategorias(lista, clase) {
  const total = sumaImportes(lista);
  if (!total) return '<p class="text-sm text-stone-500">Nada en este periodo.</p>';
  const porCat = new Map();
  lista.forEach((m) => porCat.set(m.categoria, (porCat.get(m.categoria) || 0) + Number(m.importe || 0)));
  return [...porCat].sort((a, b) => b[1] - a[1]).map(([cat, imp]) => {
    const pct = Math.round((imp / total) * 100);
    return `<div>
      <div class="flex justify-between text-sm"><span>${esc(cat)}</span><span class="font-medium">${euros(imp)} <span class="text-xs text-stone-500">(${pct} %)</span></span></div>
      <div class="h-2 rounded-full bg-stone-100 mt-1 overflow-hidden"><div class="h-2 ${clase}" style="width:${Math.max(pct, 2)}%"></div></div>
    </div>`;
  }).join('');
}

function renderEconomia() {
  if (esVeterinario()) return;
  $('eco-aviso-nube').classList.toggle('hidden', !window.Nube || Nube.economiaEnNube());
  renderSelectsEco();
  const { anio, mes, prefijo } = periodoEco();
  const delPeriodo = economia.filter((m) => String(m.fecha || '').startsWith(prefijo));
  const ingresos = sumaImportes(delPeriodo.filter((m) => m.tipo === 'ingreso'));
  const gastos = sumaImportes(delPeriodo.filter((m) => m.tipo === 'gasto'));
  const balance = Math.round((ingresos - gastos) * 100) / 100;
  $('eco-ingresos').textContent = euros(ingresos);
  $('eco-gastos').textContent = euros(gastos);
  $('eco-balance').textContent = (balance > 0 ? '+' : '') + euros(balance);
  $('eco-balance').classList.toggle('text-emerald-700', balance > 0);
  $('eco-balance').classList.toggle('text-red-600', balance < 0);
  $('eco-balance').classList.toggle('text-stone-800', balance === 0);
  document.querySelectorAll('.eco-periodo').forEach((el) => { el.textContent = textoPeriodo(); });

  // Gráfica de los 12 meses del año elegido
  const porMes = MESES.map((_, i) => {
    const p = `${anio}-${String(i + 1).padStart(2, '0')}`;
    const del = economia.filter((m) => String(m.fecha || '').startsWith(p));
    return { ing: sumaImportes(del.filter((m) => m.tipo === 'ingreso')), gas: sumaImportes(del.filter((m) => m.tipo === 'gasto')) };
  });
  const maximo = Math.max(1, ...porMes.flatMap((x) => [x.ing, x.gas]));
  $('eco-grafica-titulo').textContent = `Mes a mes · ${anio}`;
  $('eco-grafica').innerHTML = porMes.map((x, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const alto = (v) => (v ? Math.max(3, Math.round((v / maximo) * 140)) : 0);
    const bal = x.ing - x.gas;
    return `<button type="button" data-eco-mes="${mm}" title="${cap(MESES[i])}: ingresos ${euros(x.ing)} · gastos ${euros(x.gas)} · balance ${euros(bal)}"
      class="flex flex-col items-center gap-1 rounded-lg py-1 hover:bg-stone-50 ${mes === mm ? 'bg-amber-50 ring-1 ring-amber-300' : ''}">
      <div class="flex items-end justify-center gap-0.5 h-[140px] w-full">
        <div class="w-1/3 max-w-[14px] rounded-t bg-emerald-600" style="height:${alto(x.ing)}px"></div>
        <div class="w-1/3 max-w-[14px] rounded-t bg-red-500" style="height:${alto(x.gas)}px"></div>
      </div>
      <span class="text-[11px] text-stone-600">${MESES[i].slice(0, 3)}</span>
      <span class="text-[10px] ${bal > 0 ? 'text-emerald-700' : bal < 0 ? 'text-red-600' : 'text-stone-400'}">${x.ing || x.gas ? (bal > 0 ? '+' : '') + Math.round(bal).toLocaleString('es-ES') : '·'}</span>
    </button>`;
  }).join('');

  $('eco-cat-gastos').innerHTML = barrasCategorias(delPeriodo.filter((m) => m.tipo === 'gasto'), 'bg-red-500');
  $('eco-cat-ingresos').innerHTML = barrasCategorias(delPeriodo.filter((m) => m.tipo === 'ingreso'), 'bg-emerald-600');
  renderRentabilidad();

  // Listado
  const lista = movimientosEcoFiltrados();
  $('eco-body').innerHTML = lista.map((m) => {
    const a = vacaAnyPorId(m.animalId);
    const ingreso = m.tipo === 'ingreso';
    return `<tr class="border-b last:border-0 hover:bg-stone-50 ${editEcoId === m.id ? 'bg-amber-50' : ''}">
      <td class="py-2 pr-4 whitespace-nowrap">${formatearFecha(m.fecha)}</td>
      <td class="py-2 pr-4"><span class="inline-block rounded-full px-2 py-0.5 text-xs ${ingreso ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${ingreso ? 'Ingreso' : 'Gasto'}</span></td>
      <td class="py-2 pr-4">${esc(m.categoria)}</td>
      <td class="py-2 pr-4">${m.concepto ? esc(m.concepto) : '<span class="text-stone-400">—</span>'}${m.origen === 'baja' ? ' <span class="text-xs text-stone-500">(baja)</span>' : ''}</td>
      <td class="py-2 pr-4">${a ? enlaceVaca(a) : (m.cebaderoId ? '🐂 ' + esc(nombreCebadero(m.cebaderoId)) : '<span class="text-stone-400">—</span>')}</td>
      <td class="py-2 pr-4 text-right font-medium whitespace-nowrap ${ingreso ? 'text-emerald-700' : 'text-red-600'}">${ingreso ? '+' : '−'}${euros(m.importe)}</td>
      <td class="py-2 text-right whitespace-nowrap">
        <button type="button" data-action="edit-eco" data-id="${esc(m.id)}" class="text-blue-600 hover:underline text-sm mr-3">Editar</button>
        <button type="button" data-action="del-eco" data-id="${esc(m.id)}" class="text-red-600 hover:underline text-sm">Borrar</button>
      </td>
    </tr>`;
  }).join('');
  $('eco-vacio').classList.toggle('hidden', lista.length > 0);
  $('eco-vacio').textContent = economia.length ? 'No hay movimientos en este periodo con esos filtros.' : 'Todavía no has anotado ningún gasto ni ingreso.';
}

function ponerTipoEco(tipo) {
  ecoTipo = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  renderSelectsEco();
}

function resetFormEco() {
  editEcoId = null;
  $('eco-form').reset();
  $('eco-fecha').value = hoyISO();
  ocultarError($('eco-error'));
  $('eco-form-titulo').textContent = 'Añadir gasto o ingreso';
  $('eco-submit').textContent = 'Añadir';
  $('eco-cancel').classList.add('hidden');
  ponerTipoEco('gasto');
}

function iniciarEdicionEco(id) {
  const m = economia.find((x) => x.id === id);
  if (!m) return;
  editEcoId = id;
  ponerTipoEco(m.tipo);
  $('eco-fecha').value = m.fecha;
  $('eco-importe').value = m.importe;
  if (![...$('eco-categoria').options].some((o) => o.value === m.categoria)) {
    $('eco-categoria').insertAdjacentHTML('beforeend', `<option value="${esc(m.categoria)}">${esc(m.categoria)}</option>`);
  }
  $('eco-categoria').value = m.categoria;
  $('eco-animal').value = m.animalId || '';
  $('eco-cebadero').value = m.cebaderoId || '';
  $('eco-concepto').value = m.concepto || '';
  ocultarError($('eco-error'));
  $('eco-form-titulo').textContent = 'Editar movimiento';
  $('eco-submit').textContent = 'Guardar cambios';
  $('eco-cancel').classList.remove('hidden');
  renderEconomia();
  $('eco-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Lee un importe en euros («1.250,50», «1250.5», «35»); devuelve { valor } o { error }
function leerImporte(texto) {
  let t = String(texto || '').trim().replace(/\s|€/g, '');
  if (!t) return { error: 'Escribe el importe.' };
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return { error: 'El importe debe ser un número mayor que 0.' };
  if (n > IMPORTE_MAX) return { error: 'El importe es demasiado grande.' };
  return { valor: Math.round(n * 100) / 100 };
}

$('eco-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('eco-error');
  ocultarError(error);
  if (esVeterinario()) return;
  const fecha = $('eco-fecha').value;
  const imp = leerImporte($('eco-importe').value);
  const categoria = $('eco-categoria').value;
  const concepto = $('eco-concepto').value.trim();
  const animalId = $('eco-animal').value;
  if (!fecha) return mostrarError(error, 'La fecha es obligatoria.');
  if (imp.error) return mostrarError(error, imp.error);
  if (!categoria) return mostrarError(error, 'Elige una categoría.');
  if (concepto.length > 200) return mostrarError(error, 'El concepto no puede superar los 200 caracteres.');
  if (animalId && !vacaAnyPorId(animalId)) return mostrarError(error, 'El animal elegido ya no existe.');
  const cebaderoId = ecoTipo === 'gasto' ? $('eco-cebadero').value : '';
  if (cebaderoId && !cebaderoPorId(cebaderoId)) return mostrarError(error, 'El cebadero elegido ya no existe.');

  const previo = editEcoId ? economia.find((m) => m.id === editEcoId) : null;
  const datos = { fecha, tipo: ecoTipo, categoria, concepto, importe: imp.valor, animalId, cebaderoId, origen: previo ? previo.origen || '' : '' };
  const nuevos = previo ? economia.map((m) => (m.id === previo.id ? { ...m, ...datos } : m)) : [...economia, { id: uid(), ...datos }];
  if (!guardarTransaccion([[KEYS.economia, nuevos]])) return mostrarError(error, 'No se pudo guardar en este navegador.');
  economia = nuevos;
  // Se muestra el periodo del movimiento guardado
  $('eco-anio').value = fecha.slice(0, 4);
  if ($('eco-mes').value && $('eco-mes').value !== fecha.slice(5, 7)) $('eco-mes').value = fecha.slice(5, 7);
  resetFormEco();
  renderEconomia();
});
$('eco-cancel').addEventListener('click', () => { resetFormEco(); renderEconomia(); });
document.querySelectorAll('.eco-tipo-btn').forEach((b) => b.addEventListener('click', () => ponerTipoEco(b.dataset.ecoTipo)));

$('eco-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const m = economia.find((x) => x.id === btn.dataset.id);
  if (!m) return;
  if (btn.dataset.action === 'edit-eco') iniciarEdicionEco(m.id);
  else if (btn.dataset.action === 'del-eco') {
    if (!confirm(`¿Borrar ${m.tipo === 'ingreso' ? 'el ingreso' : 'el gasto'} «${m.categoria}» de ${euros(m.importe)} del ${formatearFecha(m.fecha)}?`)) return;
    const nuevos = economia.filter((x) => x.id !== m.id);
    if (!guardarTransaccion([[KEYS.economia, nuevos]])) return;
    economia = nuevos;
    if (editEcoId === m.id) resetFormEco();
    renderEconomia();
  }
});
$('eco-grafica').addEventListener('click', (e) => {
  const b = e.target.closest('[data-eco-mes]');
  if (!b) return;
  $('eco-mes').value = $('eco-mes').value === b.dataset.ecoMes ? '' : b.dataset.ecoMes;
  renderEconomia();
});
['eco-anio', 'eco-mes', 'eco-filtro-tipo'].forEach((id) => $(id).addEventListener('change', renderEconomia));
$('eco-buscar').addEventListener('input', renderEconomia);

const CABECERA_ECO = ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Crotal', 'Importe (€)'];
$('btn-export-eco').addEventListener('click', () => {
  const lista = movimientosEcoFiltrados();
  if (!lista.length) return alert('No hay movimientos que exportar en este periodo.');
  const filas = lista.map((m) => [fechaCSV(m.fecha), m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', m.categoria, m.concepto || '',
    (vacaAnyPorId(m.animalId) || {}).crotal || '', m.tipo === 'ingreso' ? Number(m.importe) : -Number(m.importe)]);
  descargarCSV(`economia_${periodoEco().prefijo}.csv`, CABECERA_ECO, filas);
});

// Importe en la baja: solo para venta o sacrificio
const CATEGORIA_BAJA = { Venta: 'Venta de animales', Sacrificio: 'Matadero' };
function actualizarImporteBaja() {
  const motivo = $('baja-motivo').value;
  const visible = !!CATEGORIA_BAJA[motivo] && !esVeterinario();
  $('baja-importe-wrap').classList.toggle('hidden', !visible);
  $('baja-importe-label').textContent = motivo === 'Sacrificio' ? 'Importe del matadero (€)' : 'Importe de la venta (€)';
}
$('baja-motivo').addEventListener('change', actualizarImporteBaja);

// Movimientos económicos de un animal (para su ficha)
function seccionEconomiaFicha(id) {
  if (esVeterinario()) return '';
  const lista = economia.filter((m) => m.animalId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!lista.length) return '';
  const ing = sumaImportes(lista.filter((m) => m.tipo === 'ingreso'));
  const gas = sumaImportes(lista.filter((m) => m.tipo === 'gasto'));
  const bal = Math.round((ing - gas) * 100) / 100;
  return `<section>
    <h3 class="font-semibold mb-2">💶 Economía · balance <span class="${bal >= 0 ? 'text-emerald-700' : 'text-red-600'}">${bal > 0 ? '+' : ''}${euros(bal)}</span></h3>
    <ul class="divide-y">${lista.map((m) => `<li class="py-1.5 text-sm flex justify-between gap-3">
      <span><span class="font-mono text-stone-600">${formatearFecha(m.fecha)}</span> · ${esc(m.categoria)}${m.concepto ? ' · ' + esc(m.concepto) : ''}</span>
      <span class="font-medium whitespace-nowrap ${m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-600'}">${m.tipo === 'ingreso' ? '+' : '−'}${euros(m.importe)}</span>
    </li>`).join('')}</ul>
  </section>`;
}

/* ============================================================
   TIEMPO DE ESPERA DE MEDICAMENTOS
   Cada tratamiento puede llevar días de retirada de carne (no puede ir a matadero) y de leche.
   La retirada cuenta desde la fecha del tratamiento y solo si ya se aplicó (fecha ≤ hoy).
   ============================================================ */
function retiradaDe(v) {
  const hoy = hoyISO();
  let carne = '';
  let leche = '';
  (v && v.tratamientos || []).forEach((t) => {
    if (!t.fecha || t.fecha > hoy) return;
    if (t.retiradaCarne > 0) { const f = sumarDias(t.fecha, t.retiradaCarne); if (f > carne) carne = f; }
    if (t.retiradaLeche > 0) { const f = sumarDias(t.fecha, t.retiradaLeche); if (f > leche) leche = f; }
  });
  return { carne: carne > hoy ? carne : '', leche: leche > hoy ? leche : '' };
}

function avisoRetirada(v) {
  if (!v || v.baja) return '';
  const r = retiradaDe(v);
  if (!r.carne && !r.leche) return '';
  return `<section class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
    <p class="font-semibold">⏳ Tiempo de espera de medicamentos</p>
    ${r.carne ? `<p>🚫 No puede ir a matadero hasta el <span class="font-semibold">${formatearFecha(r.carne)}</span> (quedan ${diasHasta(r.carne)} días).</p>` : ''}
    ${r.leche ? `<p>🥛 Su leche no se puede vender hasta el <span class="font-semibold">${formatearFecha(r.leche)}</span> (quedan ${diasHasta(r.leche)} días).</p>` : ''}
  </section>`;
}

// Lee los días de retirada de un campo (vacío = sin retirada)
function leerDiasRetirada(id) {
  const t = String($(id).value || '').trim();
  if (!t) return { valor: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 999) return { error: 'Los días de retirada deben ser un número entero entre 0 y 999.' };
  return { valor: n || null };
}

/* ============================================================
   PESAJES Y GRÁFICA DE CRECIMIENTO (ficha del animal, solo ganadero)
   Se juntan los pesajes anotados y los pesos de entrada / salida del cebadero.
   ============================================================ */
function puntosPeso(id) {
  const pts = pesajes.filter((p) => p.animalId === id).map((p) => ({ fecha: p.fecha, peso: Number(p.peso), origen: 'pesaje', id: p.id, obs: p.observaciones || '' }));
  cebos.filter((r) => r.animalId === id).forEach((r) => {
    if (r.pesoEntrada > 0) pts.push({ fecha: r.entrada, peso: Number(r.pesoEntrada), origen: 'Entrada en ' + nombreCebadero(r.cebaderoId) });
    if (r.salida && r.pesoSalida > 0) pts.push({ fecha: r.salida, peso: Number(r.pesoSalida), origen: 'Salida de ' + nombreCebadero(r.cebaderoId) });
  });
  return pts.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Ganancia media diaria entre dos puntos
const gmdEntre = (a, b) => {
  const d = diasEntre(a.fecha, b.fecha);
  return d > 0 ? (b.peso - a.peso) / d : null;
};

function graficaPeso(pts) {
  if (pts.length < 2) return '';
  const W = 560, H = 190, PI = 46, PD = 14, PA = 14, PB = 28;
  const t0 = Date.parse(pts[0].fecha), t1 = Date.parse(pts[pts.length - 1].fecha);
  const pesos = pts.map((p) => p.peso);
  let min = Math.min(...pesos), max = Math.max(...pesos);
  if (max - min < 10) { min -= 5; max += 5; }
  const margen = (max - min) * 0.1; min = Math.max(0, min - margen); max += margen;
  const x = (f) => PI + ((Date.parse(f) - t0) / Math.max(1, t1 - t0)) * (W - PI - PD);
  const y = (p) => PA + (1 - (p - min) / (max - min)) * (H - PA - PB);
  const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.fecha).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ');
  const marcas = [min, (min + max) / 2, max].map((v) => `
    <line x1="${PI}" x2="${W - PD}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e7e5e4" />
    <text x="${PI - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#78716c">${Math.round(v)}</text>`).join('');
  const puntos = pts.map((p) => `<circle cx="${x(p.fecha).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="4"
      fill="${p.origen === 'pesaje' ? '#15803d' : '#d97706'}" stroke="#fff" stroke-width="1.5">
      <title>${esc(formatearFecha(p.fecha))}: ${esc(formatoNum(p.peso, 1))} kg${p.origen === 'pesaje' ? '' : ' (' + esc(p.origen) + ')'}</title></circle>`).join('');
  const fx = [pts[0], pts[pts.length - 1]].map((p, i) => `<text x="${x(p.fecha).toFixed(1)}" y="${H - 8}" font-size="11" fill="#78716c"
      text-anchor="${i ? 'end' : 'start'}">${esc(formatearFecha(p.fecha))}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Evolución del peso">
    ${marcas}<path d="${linea}" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linejoin="round" />${puntos}${fx}
  </svg>`;
}

function seccionPesoFicha(v) {
  if (esVeterinario()) return '';
  const pts = puntosPeso(v.id);
  const ultimo = pts[pts.length - 1];
  const total = pts.length >= 2 ? gmdEntre(pts[0], ultimo) : null;
  const reciente = pts.length >= 2 ? gmdEntre(pts[pts.length - 2], ultimo) : null;
  const lista = pesajes.filter((p) => p.animalId === v.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return `<section id="peso-seccion">
    <h3 class="font-semibold mb-2">⚖️ Peso y crecimiento</h3>
    ${ultimo ? `<p class="text-sm mb-2">Último peso: <span class="font-semibold">${formatoNum(ultimo.peso, 1)} kg</span> (${formatearFecha(ultimo.fecha)})
      ${total !== null ? ` · GMD total <span class="font-semibold">${formatoNum(total, 2)} kg/día</span>` : ''}
      ${reciente !== null && pts.length > 2 ? ` · último tramo ${formatoNum(reciente, 2)} kg/día` : ''}</p>` : '<p class="text-sm text-stone-500 mb-2">Todavía no tiene pesos anotados.</p>'}
    ${graficaPeso(pts)}
    ${pts.some((p) => p.origen !== 'pesaje') ? '<p class="text-xs text-stone-500 mt-1"><span class="text-amber-600">●</span> pesos del cebadero · <span class="text-green-700">●</span> pesajes</p>' : ''}
    ${v.baja ? '' : `<form id="pesaje-form" class="mt-3 flex flex-wrap items-end gap-2" novalidate>
      <div><label class="block text-xs font-medium mb-1" for="pesaje-fecha">Fecha</label>
        <input id="pesaje-fecha" type="date" value="${hoyISO()}" class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" /></div>
      <div><label class="block text-xs font-medium mb-1" for="pesaje-peso">Peso (kg)</label>
        <input id="pesaje-peso" type="number" min="0" step="0.1" inputmode="decimal" placeholder="250" class="w-28 rounded-lg border border-stone-300 px-3 py-1.5 text-sm" /></div>
      <div class="flex-1 min-w-[10rem]"><label class="block text-xs font-medium mb-1" for="pesaje-obs">Observaciones</label>
        <input id="pesaje-obs" maxlength="300" placeholder="Báscula, estimado…" class="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm" /></div>
      <button type="submit" class="bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg px-4 py-1.5 text-sm">Añadir pesaje</button>
      <p id="pesaje-error" class="hidden w-full text-sm text-red-600"></p>
    </form>`}
    ${lista.length ? `<ul class="divide-y mt-2">${lista.map((p) => `<li class="py-1.5 text-sm flex justify-between gap-3">
      <span><span class="font-mono text-stone-600">${formatearFecha(p.fecha)}</span> · <span class="font-medium">${formatoNum(p.peso, 1)} kg</span>${p.observaciones ? ' · ' + esc(p.observaciones) : ''}</span>
      ${v.baja ? '' : `<button type="button" data-action="del-pesaje" data-id="${esc(p.id)}" class="text-red-600 hover:underline text-xs">Borrar</button>`}
    </li>`).join('')}</ul>` : ''}
  </section>`;
}

$('vaca-modal-ficha').addEventListener('submit', (e) => {
  if (e.target.id !== 'pesaje-form') return;
  e.preventDefault();
  const v = vacaPorId(fichaActualId);
  const error = $('pesaje-error');
  ocultarError(error);
  if (!v || esVeterinario()) return;
  const fecha = $('pesaje-fecha').value;
  const peso = leerPeso('pesaje-peso');
  const obs = $('pesaje-obs').value.trim();
  if (!fecha) return mostrarError(error, 'Indica la fecha del pesaje.');
  if (fecha > hoyISO()) return mostrarError(error, 'La fecha no puede ser futura.');
  if (v.nacimiento && fecha < v.nacimiento) return mostrarError(error, 'La fecha no puede ser anterior al nacimiento.');
  if (peso.error) return mostrarError(error, peso.error);
  if (peso.valor === null) return mostrarError(error, 'Escribe el peso en kg.');
  if (pesajes.some((p) => p.animalId === v.id && p.fecha === fecha)) return mostrarError(error, 'Ya hay un pesaje en esa fecha: bórralo antes si quieres corregirlo.');
  const nuevos = [...pesajes, { id: uid(), animalId: v.id, fecha, peso: peso.valor, observaciones: obs.slice(0, 300) }];
  if (!guardarTransaccion([[KEYS.pesajes, nuevos]])) return mostrarError(error, 'No se pudo guardar en este navegador.');
  pesajes = nuevos;
  abrirFicha(v.id);
  renderAvisos();
});

$('vaca-modal-ficha').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-pesaje"]');
  if (!btn) return;
  const p = pesajes.find((x) => x.id === btn.dataset.id);
  if (!p || !confirm(`¿Borrar el pesaje de ${formatoNum(p.peso, 1)} kg del ${formatearFecha(p.fecha)}?`)) return;
  const nuevos = pesajes.filter((x) => x.id !== p.id);
  if (!guardarTransaccion([[KEYS.pesajes, nuevos]])) return;
  pesajes = nuevos;
  abrirFicha(fichaActualId);
});

/* ============================================================
   FOTOS DE LOS ANIMALES (se guardan comprimidas en la nube; el veterinario las ve)
   ============================================================ */
const FOTO_LADO_MAX = 900;
const FOTO_MAX_CARACTERES = 380000;
const FOTOS_MAX_ANIMAL = 8;
let fotosFicha = { id: null, lista: [] };

function seccionFotosFicha(v) {
  const puedeSubir = !esVeterinario() && !v.baja;
  return `<section>
    <div class="flex items-center justify-between gap-2 mb-2">
      <h3 class="font-semibold">📷 Fotos</h3>
      ${puedeSubir ? '<button type="button" data-action="add-foto" class="bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg px-3 py-1 text-sm">➕ Añadir foto</button>' : ''}
    </div>
    <div id="fotos-galeria" class="flex flex-wrap gap-2"><p class="text-sm text-stone-500">Cargando fotos…</p></div>
    <p id="fotos-error" class="hidden text-sm text-red-600 mt-1"></p>
  </section>`;
}

function pintarFotos() {
  const cont = $('fotos-galeria');
  if (!cont) return;
  const puedeBorrar = !esVeterinario();
  cont.innerHTML = fotosFicha.lista.length
    ? fotosFicha.lista.map((f) => `<div class="relative">
        <button type="button" data-action="ver-foto" data-id="${esc(f.id)}" class="block">
          <img src="${esc(f.imagen)}" alt="Foto del animal" class="h-28 w-28 object-cover rounded-lg border border-stone-200" loading="lazy" />
        </button>
        ${puedeBorrar ? `<button type="button" data-action="del-foto" data-id="${esc(f.id)}" title="Borrar foto" aria-label="Borrar foto"
          class="absolute top-1 right-1 bg-white/90 hover:bg-white text-red-600 rounded-full w-6 h-6 text-sm leading-none shadow">×</button>` : ''}
      </div>`).join('')
    : '<p class="text-sm text-stone-500">Sin fotos todavía.</p>';
}

async function cargarFotosFicha(id) {
  if (fotosFicha.id === id && fotosFicha.cargadas) return pintarFotos(); // misma ficha: no se vuelven a descargar
  fotosFicha = { id, lista: [] };
  if (!window.Nube) return;
  try {
    const lista = await Nube.fotosDe(id);
    if (fichaActualId !== id) return;
    fotosFicha = { id, lista, cargadas: true };
  } catch (err) {
    if (fichaActualId !== id || !$('fotos-galeria')) return;
    $('fotos-galeria').innerHTML = `<p class="text-sm text-stone-500">No se pudieron cargar las fotos (${esc(err.message)}).</p>`;
    return;
  }
  pintarFotos();
}

// Reduce la foto (lado máximo y calidad JPEG) hasta que quepa
function comprimirFoto(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let lado = FOTO_LADO_MAX;
      let calidad = 0.75;
      for (let intento = 0; intento < 8; intento++) {
        const escala = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * escala));
        c.height = Math.max(1, Math.round(img.height * escala));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const datos = c.toDataURL('image/jpeg', calidad);
        if (datos.length <= FOTO_MAX_CARACTERES) return resolve(datos);
        if (calidad > 0.45) calidad -= 0.15; else lado = Math.round(lado * 0.75);
      }
      reject(new Error('La foto es demasiado grande.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ese archivo no es una imagen válida.')); };
    img.src = url;
  });
}

$('foto-archivo').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  const id = fichaActualId;
  if (!archivo || !id || esVeterinario()) return;
  const error = $('fotos-error');
  if (error) ocultarError(error);
  if (fotosFicha.id === id && fotosFicha.lista.length >= FOTOS_MAX_ANIMAL) {
    return error && mostrarError(error, `Cada animal puede tener hasta ${FOTOS_MAX_ANIMAL} fotos: borra alguna antes.`);
  }
  try {
    if ($('fotos-galeria')) $('fotos-galeria').insertAdjacentHTML('afterbegin', '<p id="foto-subiendo" class="text-sm text-stone-500 w-full">Subiendo foto…</p>');
    const imagen = await comprimirFoto(archivo);
    const f = await Nube.subirFoto(id, imagen);
    if (fotosFicha.id === id) fotosFicha.lista = [f, ...fotosFicha.lista];
    if (fichaActualId === id) pintarFotos();
  } catch (err) {
    if ($('foto-subiendo')) $('foto-subiendo').remove();
    if ($('fotos-error')) mostrarError($('fotos-error'), 'No se pudo subir la foto: ' + err.message);
  }
});

function verFotoGrande(imagen) {
  const capa = document.createElement('div');
  capa.className = 'fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 cursor-zoom-out';
  capa.innerHTML = `<img src="${esc(imagen)}" alt="Foto del animal" class="max-h-full max-w-full rounded-lg shadow-2xl" />`;
  capa.addEventListener('click', () => capa.remove());
  document.addEventListener('keydown', function cerrar(ev) { if (ev.key === 'Escape') { capa.remove(); document.removeEventListener('keydown', cerrar, true); } }, true);
  document.body.appendChild(capa);
}

$('vaca-modal-ficha').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="add-foto"], [data-action="ver-foto"], [data-action="del-foto"]');
  if (!btn) return;
  if (btn.dataset.action === 'add-foto') return $('foto-archivo').click();
  const f = fotosFicha.lista.find((x) => x.id === btn.dataset.id);
  if (!f) return;
  if (btn.dataset.action === 'ver-foto') return verFotoGrande(f.imagen);
  if (!confirm('¿Borrar esta foto?')) return;
  try {
    await Nube.borrarFoto(f.id);
    fotosFicha.lista = fotosFicha.lista.filter((x) => x.id !== f.id);
    pintarFotos();
  } catch (err) {
    mostrarError($('fotos-error'), 'No se pudo borrar la foto: ' + err.message);
  }
});

/* ============================================================
   TRATAMIENTO O VACUNA EN GRUPO (veterinario)
   ============================================================ */
function abrirGrupo() {
  if (!esVeterinario()) return;
  $('grupo-form').reset();
  $('grupo-fecha').value = hoyISO();
  $('grupo-vet').value = usuarioActual.usuario;
  $('grupo-estado').innerHTML = '<option value="">Todos los estados</option>' +
    estadosCuenta().map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  ocultarError($('grupo-error'));
  renderGrupoLista();
  $('grupo-modal').classList.remove('hidden');
  $('grupo-modal').classList.add('flex');
}

function cerrarGrupo() {
  $('grupo-modal').classList.add('hidden');
  $('grupo-modal').classList.remove('flex');
}

function animalesGrupoVisibles() {
  const texto = $('grupo-buscar').value.trim().toLowerCase();
  const estado = $('grupo-estado').value;
  return vacas
    .filter((v) => (!estado || v.estado === estado) &&
      (!texto || [v.crotal, v.nombre, v.raza].some((c) => String(c || '').toLowerCase().includes(texto))))
    .sort((a, b) => a.crotal.localeCompare(b.crotal, 'es'));
}

function renderGrupoLista() {
  const marcados = new Set([...document.querySelectorAll('input[name="grupo-animal"]:checked')].map((c) => c.value));
  const lista = animalesGrupoVisibles();
  $('grupo-lista').innerHTML = lista.length
    ? lista.map((v) => `<label class="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" name="grupo-animal" value="${esc(v.id)}" ${marcados.has(v.id) ? 'checked' : ''} />
        <span class="font-mono">${esc(v.crotal)}</span>${v.nombre ? ' · ' + esc(v.nombre) : ''}
        <span class="text-xs text-stone-500">${SIMBOLO_SEXO[sexoDe(v)]} ${esc(v.estado)}</span>
      </label>`).join('')
    : '<p class="text-sm text-stone-500">Ningún animal coincide.</p>';
  actualizarGrupoCuenta();
}

function actualizarGrupoCuenta() {
  const n = document.querySelectorAll('input[name="grupo-animal"]:checked').length;
  $('grupo-cuenta').textContent = `${n} ${n === 1 ? 'animal seleccionado' : 'animales seleccionados'}`;
}

$('grupo-btn').addEventListener('click', abrirGrupo);
$('grupo-cancelar').addEventListener('click', cerrarGrupo);
$('grupo-modal').addEventListener('click', (e) => { if (e.target === $('grupo-modal')) cerrarGrupo(); });
$('grupo-buscar').addEventListener('input', renderGrupoLista);
$('grupo-estado').addEventListener('change', renderGrupoLista);
$('grupo-lista').addEventListener('change', actualizarGrupoCuenta);
$('grupo-todos').addEventListener('click', () => {
  const casillas = [...document.querySelectorAll('input[name="grupo-animal"]')];
  const marcar = casillas.some((c) => !c.checked);
  casillas.forEach((c) => { c.checked = marcar; });
  actualizarGrupoCuenta();
});

$('grupo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = $('grupo-error');
  ocultarError(error);
  if (!esVeterinario()) return;
  const ids = [...document.querySelectorAll('input[name="grupo-animal"]:checked')].map((c) => c.value);
  const fecha = $('grupo-fecha').value;
  const tipo = $('grupo-tipo').value.trim().replace(/\s+/g, ' ');
  const vet = $('grupo-vet').value.trim().slice(0, 120);
  const obs = $('grupo-obs').value.trim().slice(0, 1000);
  const rc = leerDiasRetirada('grupo-ret-carne');
  const rl = leerDiasRetirada('grupo-ret-leche');
  if (!ids.length) return mostrarError(error, 'Marca al menos un animal.');
  if (!fecha) return mostrarError(error, 'La fecha es obligatoria.');
  if (!tipo) return mostrarError(error, 'Indica el tratamiento o la vacuna.');
  if (tipo.length > 120) return mostrarError(error, 'El nombre no puede superar los 120 caracteres.');
  if (rc.error || rl.error) return mostrarError(error, rc.error || rl.error);
  let creados = 0;
  const saltados = [];
  const ahora = Date.now();
  const vacasNuevas = vacas.map((v) => {
    if (!ids.includes(v.id)) return v;
    const repetido = (v.tratamientos || []).some((t) => t.fecha === fecha && String(t.tipo || '').toLowerCase() === tipo.toLowerCase());
    if (repetido || (v.nacimiento && fecha < v.nacimiento)) { saltados.push(v.crotal); return v; }
    creados++;
    return { ...v, tratamientos: [...(v.tratamientos || []), { id: uid(), fecha, tipo, veterinario: vet, observaciones: obs,
      creado: ahora, creadoPor: usuarioActual.id, retiradaCarne: rc.valor, retiradaLeche: rl.valor }] };
  });
  if (!creados) return mostrarError(error, 'Todos los animales marcados ya tenían ese tratamiento en esa fecha (o nacieron después).');
  if (!guardarTransaccion([[KEYS.vacas, vacasNuevas]])) return mostrarError(error, 'No se pudo guardar en este navegador.');
  vacas = vacasNuevas;
  cerrarGrupo();
  renderTodo();
  mostrarAvisoVaca(`✔ «${tipo}» registrado en ${creados} ${creados === 1 ? 'animal' : 'animales'}` +
    (saltados.length ? ` (se saltaron ${saltados.length} que ya lo tenían: ${saltados.slice(0, 5).join(', ')}${saltados.length > 5 ? '…' : ''}).` : '.'));
});

/* ============================================================
   PANEL DE AVISOS (al entrar)
   ============================================================ */
const DIAS_AVISO = 7;           // partos y tratamientos de la próxima semana
const DIAS_CEBO_LARGO = 300;    // terneros que llevan mucho en el cebadero
const DIAS_SIN_PESAR = 45;      // terneros en cebadero sin pesar

function avisosActuales() {
  const hoy = hoyISO();
  const lista = [];
  const enlace = (v) => enlaceVaca(v);
  // Partos
  vacas.filter((v) => v.estado === 'Gestante' && v.fechaParto).forEach((v) => {
    const d = diasHasta(v.fechaParto);
    if (d < 0) lista.push({ orden: 0, ico: '🍼', clase: 'text-red-700', html: `${enlace(v)}: el parto estaba previsto el ${formatearFecha(v.fechaParto)} (hace ${-d} días).` });
    else if (d <= DIAS_AVISO) lista.push({ orden: 1, ico: '🍼', clase: 'text-amber-800', html: `${enlace(v)} pare ${d === 0 ? 'hoy' : `en ${d} ${d === 1 ? 'día' : 'días'}`} (${formatearFecha(v.fechaParto)}).` });
  });
  // Tratamientos programados
  vacas.forEach((v) => (v.tratamientos || []).forEach((t) => {
    const d = diasHasta(t.fecha);
    if (t.fecha >= hoy && d <= DIAS_AVISO) {
      lista.push({ orden: 2, ico: '💉', clase: 'text-sky-800', html: `${esc(t.tipo)} a ${enlace(v)} ${d === 0 ? 'hoy' : `en ${d} ${d === 1 ? 'día' : 'días'}`}.` });
    }
  }));
  // Tiempo de espera de medicamentos
  vacas.forEach((v) => {
    const r = retiradaDe(v);
    if (r.carne) lista.push({ orden: 3, ico: '🚫', clase: 'text-red-700', html: `${enlace(v)} no puede ir a matadero hasta el ${formatearFecha(r.carne)}.` });
    if (r.leche) lista.push({ orden: 3, ico: '🥛', clase: 'text-red-700', html: `La leche de ${enlace(v)} no se puede vender hasta el ${formatearFecha(r.leche)}.` });
  });
  if (!esVeterinario()) {
    // Cebadero: mucho tiempo dentro o sin pesar
    cebos.filter((r) => !r.salida).forEach((r) => {
      const v = vacaPorId(r.animalId);
      if (!v) return;
      const dias = diasEntre(r.entrada, hoy);
      if (dias >= DIAS_CEBO_LARGO) lista.push({ orden: 4, ico: '🐂', clase: 'text-amber-800', html: `${enlace(v)} lleva ${dias} días en ${esc(nombreCebadero(r.cebaderoId))}.` });
      const ultimo = puntosPeso(v.id).pop();
      const desde = ultimo ? ultimo.fecha : r.entrada;
      if (diasEntre(desde, hoy) >= DIAS_SIN_PESAR) {
        lista.push({ orden: 5, ico: '⚖️', clase: 'text-stone-700', html: `${enlace(v)} no se pesa desde el ${formatearFecha(desde)}.` });
      }
    });
    // Gastos del mes frente al mes anterior
    if (economia.length) {
      const mes = hoy.slice(0, 7);
      const anterior = sumarDias(mes + '-01', -1).slice(0, 7);
      const g = (p) => sumaImportes(economia.filter((m) => m.tipo === 'gasto' && m.fecha.startsWith(p)));
      const gm = g(mes), ga = g(anterior);
      if (gm || ga) {
        const dif = ga ? Math.round(((gm - ga) / ga) * 100) : null;
        lista.push({ orden: 6, ico: '💶', clase: 'text-stone-700', html: `Gastos de este mes: <span class="font-semibold">${euros(gm)}</span> (el mes pasado ${euros(ga)}${dif !== null ? `, ${dif > 0 ? '+' : ''}${dif} %` : ''}).` });
      }
    }
  }
  return lista.sort((a, b) => a.orden - b.orden);
}

function renderAvisos() {
  const lista = avisosActuales();
  const MAX = 8;
  $('avisos-lista').innerHTML = lista.length
    ? lista.slice(0, MAX).map((a) => `<li class="py-1.5 text-sm flex gap-2 ${a.clase}"><span aria-hidden="true">${a.ico}</span><span>${a.html}</span></li>`).join('') +
      (lista.length > MAX ? `<li class="py-1.5 text-xs text-stone-500">…y ${lista.length - MAX} avisos más.</li>` : '')
    : '<li class="py-1.5 text-sm text-green-800">✅ Todo en orden: nada urgente para los próximos días.</li>';
  $('avisos-resumen').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'aviso' : 'avisos'}` : '';
}

/* ============================================================
   RENTABILIDAD POR TERNERO Y POR TORO (pestaña Economía)
   Los gastos ligados a un cebadero se reparten entre los terneros que estuvieron dentro ese mes,
   en proporción a los días que pasó cada uno.
   ============================================================ */
function repartoGastosCebadero() {
  const porAnimal = new Map();
  let sinReparto = 0;
  economia.filter((m) => m.tipo === 'gasto' && m.cebaderoId).forEach((m) => {
    const ini = m.fecha.slice(0, 7) + '-01';
    const fin = sumarDias(sumarDias(ini, 32).slice(0, 7) + '-01', -1);
    const dias = new Map();
    cebos.filter((r) => r.cebaderoId === m.cebaderoId).forEach((r) => {
      const desde = r.entrada > ini ? r.entrada : ini;
      const hasta = (r.salida || '9999-12-31') < fin ? r.salida : fin;
      const d = diasEntre(desde, hasta) + 1;
      if (d > 0) dias.set(r.animalId, (dias.get(r.animalId) || 0) + d);
    });
    const total = [...dias.values()].reduce((a, b) => a + b, 0);
    if (!total) { sinReparto += Number(m.importe); return; }
    dias.forEach((d, id) => porAnimal.set(id, (porAnimal.get(id) || 0) + (Number(m.importe) * d) / total));
  });
  return { porAnimal, sinReparto: Math.round(sinReparto * 100) / 100 };
}

function rentabilidadAnimales() {
  const { porAnimal, sinReparto } = repartoGastosCebadero();
  const ids = new Set([...cebos.map((r) => r.animalId), ...economia.filter((m) => m.animalId).map((m) => m.animalId), ...porAnimal.keys()]);
  const filas = [...ids].map((id) => vacaAnyPorId(id)).filter(Boolean).map((a) => {
    const mov = economia.filter((m) => m.animalId === a.id);
    const ingresos = sumaImportes(mov.filter((m) => m.tipo === 'ingreso'));
    const directos = sumaImportes(mov.filter((m) => m.tipo === 'gasto'));
    const cebadero = Math.round((porAnimal.get(a.id) || 0) * 100) / 100;
    const estancias = cebos.filter((r) => r.animalId === a.id);
    const dias = estancias.reduce((s, r) => s + metricasCebo(r).dias, 0);
    const kg = estancias.map(metricasCebo).filter((m) => m.kg !== null).reduce((s, m) => s + m.kg, 0);
    const gmds = estancias.map(metricasCebo).filter((m) => m.gmd !== null).map((m) => m.gmd);
    return { a, ingresos, directos, cebadero, balance: Math.round((ingresos - directos - cebadero) * 100) / 100, dias,
      kg: kg || null, gmd: gmds.length ? gmds.reduce((x, y) => x + y, 0) / gmds.length : null, padre: textoPadre(a) || 'Padre desconocido' };
  });
  return { filas: filas.sort((x, y) => y.balance - x.balance), sinReparto };
}

function renderRentabilidad() {
  const { filas, sinReparto } = rentabilidadAnimales();
  const nada = '<span class="text-stone-400">—</span>';
  const col = (n) => `<span class="${n > 0 ? 'text-emerald-700' : n < 0 ? 'text-red-600' : ''}">${n > 0 ? '+' : ''}${euros(n)}</span>`;
  $('renta-body').innerHTML = filas.map((f) => `<tr class="border-b last:border-0">
      <td class="py-2 pr-4">${enlaceVaca(f.a)}${f.a.baja ? ` <span class="text-xs text-stone-500">(${esc(f.a.baja.motivo.toLowerCase())})</span>` : ''}</td>
      <td class="py-2 pr-4">${esc(f.padre)}</td>
      <td class="py-2 pr-4 text-right">${f.dias || nada}</td>
      <td class="py-2 pr-4 text-right">${f.kg !== null ? formatoNum(f.kg, 1) : nada}</td>
      <td class="py-2 pr-4 text-right">${f.ingresos ? euros(f.ingresos) : nada}</td>
      <td class="py-2 pr-4 text-right">${f.directos + f.cebadero ? euros(f.directos + f.cebadero) : nada}</td>
      <td class="py-2 text-right font-semibold">${col(f.balance)}</td>
    </tr>`).join('');
  $('renta-vacio').classList.toggle('hidden', filas.length > 0);
  $('renta-nota').textContent = sinReparto
    ? `Hay ${euros(sinReparto)} de gastos de cebadero en meses sin terneros dentro: no se han repartido.` : '';

  // Por toro (padre)
  const grupos = new Map();
  filas.forEach((f) => { if (!grupos.has(f.padre)) grupos.set(f.padre, []); grupos.get(f.padre).push(f); });
  const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  $('renta-padres').innerHTML = [...grupos].map(([padre, fs]) => {
    const gmd = media(fs.map((f) => f.gmd).filter((x) => x !== null));
    return { padre, n: fs.length, balance: media(fs.map((f) => f.balance)), gmd };
  }).sort((a, b) => b.balance - a.balance).map((g) => `<tr class="border-b last:border-0">
      <td class="py-2 pr-4 font-medium">${esc(g.padre)}</td>
      <td class="py-2 pr-4 text-right">${g.n}</td>
      <td class="py-2 pr-4 text-right">${g.gmd !== null ? formatoNum(g.gmd, 2) + ' kg/día' : nada}</td>
      <td class="py-2 text-right font-semibold">${col(Math.round(g.balance * 100) / 100)}</td>
    </tr>`).join('');
}

/* ============================================================
   LIBRO DE REGISTRO (altas, movimientos y bajas de un año)
   ============================================================ */
const CABECERA_LIBRO = ['Fecha', 'Crotal', 'Especie', 'Sexo', 'Raza', 'Fecha de nacimiento', 'Madre (crotal)', 'Suceso', 'Detalle', 'Nº de documento'];

function textoMovimiento(m) {
  if (m.campo === 'Cebadero') return m.desde ? ['Salida de cebadero', `${m.desde}${m.hasta ? ' → finca ' + m.hasta : ''}`] : ['Entrada en cebadero', m.hasta];
  if (m.campo === 'Finca') return m.hasta ? ['Entrada en finca', `${m.hasta}${m.desde ? ' (desde ' + m.desde + ')' : ''}`] : ['Salida de finca', m.desde];
  return ['Cambio de lote', `${m.desde || 'Sin lote'} → ${m.hasta || 'Sin lote'}`];
}

function filasLibro(anio) {
  const sucesos = [];
  [...vacas, ...bajas].forEach((a) => {
    const base = [a.crotal, ESPECIES[especieDe(a)].corto, SEXOS[sexoDe(a)], a.raza || '', fechaCSV(a.nacimiento),
      (vacaAnyPorId(a.madreId) || {}).crotal || ''];
    if (a.nacimiento && a.nacimiento.startsWith(anio)) sucesos.push([a.nacimiento, ...base, 'Nacimiento', textoPadre(a) ? 'Padre: ' + textoPadre(a) : '', '']);
    (a.movimientos || []).filter((m) => String(m.fecha || '').startsWith(anio)).forEach((m) => {
      const [suceso, detalle] = textoMovimiento(m);
      sucesos.push([m.fecha, ...base, suceso, detalle || '', '']);
    });
    if (a.baja && String(a.baja.fecha || '').startsWith(anio)) {
      sucesos.push([a.baja.fecha, ...base, `Baja: ${a.baja.motivo}`, a.baja.detalle || '', a.baja.documento || '']);
    }
  });
  return sucesos.sort((x, y) => x[0].localeCompare(y[0]) || String(x[1]).localeCompare(String(y[1]), 'es'))
    .map((f) => [fechaCSV(f[0]), ...f.slice(1)]);
}

function renderSelectLibro() {
  const anios = new Set([hoyISO().slice(0, 4)]);
  [...vacas, ...bajas].forEach((a) => {
    if (a.nacimiento) anios.add(a.nacimiento.slice(0, 4));
    (a.movimientos || []).forEach((m) => m.fecha && anios.add(m.fecha.slice(0, 4)));
    if (a.baja && a.baja.fecha) anios.add(a.baja.fecha.slice(0, 4));
  });
  const actual = $('libro-anio').value;
  const lista = [...anios].sort().reverse();
  $('libro-anio').innerHTML = lista.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  $('libro-anio').value = lista.includes(actual) ? actual : lista[0];
  $('libro-resumen').textContent = `${filasLibro($('libro-anio').value).length} anotaciones en ${$('libro-anio').value}.`;
}

$('libro-anio').addEventListener('change', renderSelectLibro);
$('libro-csv').addEventListener('click', () => {
  const anio = $('libro-anio').value;
  const filas = filasLibro(anio);
  if (!filas.length) return alert(`No hay anotaciones en ${anio}.`);
  descargarCSV(`libro_registro_${anio}.csv`, CABECERA_LIBRO.map((h) => (h === 'Crotal' ? vocab().crotal : h)), filas);
});
$('libro-imprimir').addEventListener('click', () => {
  const anio = $('libro-anio').value;
  const filas = filasLibro(anio);
  if (!filas.length) return alert(`No hay anotaciones en ${anio}.`);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Libro de registro ${esc(anio)}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 12px;color:#555}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}
    th{background:#eee}tr{page-break-inside:avoid}</style></head><body>
    <h1>Libro de registro de la explotación · ${esc(anio)}</h1>
    <p>Titular: ${esc(usuarioActual.usuario)}${usuarioActual.email ? ' · ' + esc(usuarioActual.email) : ''} · Generado el ${esc(formatearFecha(hoyISO()))} · ${filas.length} anotaciones</p>
    <table><thead><tr>${CABECERA_LIBRO.map((h) => `<th>${esc(h === 'Crotal' ? vocab().crotal : h)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  const marco = document.createElement('iframe');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(marco);
  marco.contentDocument.open();
  marco.contentDocument.write(html);
  marco.contentDocument.close();
  setTimeout(() => { marco.contentWindow.focus(); marco.contentWindow.print(); setTimeout(() => marco.remove(), 2000); }, 300);
});

// Arranque: si hay sesión de Supabase se abre la app; sin conexión, con la copia guardada en el navegador
async function iniciarApp() {
  if (!window.Nube || !Nube.disponible()) {
    mostrarLogin();
    mostrarError($('login-error'), 'No se pudo conectar con la nube (¿sin internet?). Comprueba la conexión y recarga la página.');
    return;
  }
  Nube.configurar({
    obtenerEstado: () => ({ fincas, vacas, bajas, cebaderos, cebos, economia, pesajes }),
    alCambiarEstadoSync: marcarEstadoNube
  });
  Nube.alCambiarAuth((evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY') { setTimeout(pedirPasswordNueva, 300); return; }
    // Las pestañas del mismo navegador comparten la sesión: si en otra se entra con otra cuenta o se cierra sesión,
    // esta pestaña se recarga para no mezclar cuentas (seguiría mostrando una y hablando con la nube como la otra)
    if (!usuarioActual) return;
    const otraCuenta = sesion && sesion.user && sesion.user.id !== usuarioActual.id;
    if (otraCuenta || evento === 'SIGNED_OUT') {
      alert(otraCuenta
        ? 'Se ha iniciado sesión con otra cuenta en otra pestaña de este navegador. Esta pestaña se recargará con esa cuenta.\n\nPara tener abiertas a la vez una cuenta de ganadero y otra de veterinario, usa una ventana de incógnito (Ctrl + Mayús + N) u otro navegador.'
        : 'Se ha cerrado la sesión en otra pestaña. Esta pestaña se recargará.');
      location.reload();
    }
  });
  try {
    const p = await Nube.miPerfil();
    if (p) return iniciarSesion(p);
  } catch {
    try {
      const sesion = await Nube.sesion();
      const p = sesion && perfilLocal(sesion.user.id);
      if (p) return iniciarSesion(p);
    } catch { /* sin sesión */ }
  }
  mostrarLogin();
}

asegurarLogo();
renderSelectsEstado();
iniciarApp();

/* ============================================================
   ÁRBOL GENEALÓGICO (ventana propia)
   - Arriba: ascendencia en forma de pedigrí (animal → padre y madre → abuelos → bisabuelos).
   - Abajo: descendencia en forma de árbol (hijos, nietos…), por madre o por padre.
   Al pulsar un animal el árbol se recentra en él. Protegido frente a ciclos.
   ============================================================ */
const GENERACIONES_ARBOL = 4;      // animal + 3 generaciones hacia atrás
const PROFUNDIDAD_DESC_ARBOL = 4;  // generaciones de descendencia que se dibujan
let arbolActualId = null;

function cajaArbol(a, { central = false, rol = '', externo = '' } = {}) {
  const rotulo = rol ? `<p class="arbol-rol">${esc(rol)}</p>` : '';
  if (!a) {
    return `<div class="arbol-caja arbol-vacia">${rotulo}<p class="text-sm ${externo ? 'text-stone-700' : 'text-stone-400'}">${externo ? esc(externo) : 'Desconocido'}</p>${externo ? '<p class="text-xs text-stone-500">Externo</p>' : ''}</div>`;
  }
  const estado = a.baja ? `Baja · ${a.baja.motivo}` : (a.estado || '');
  const clase = a.baja ? 'bg-stone-200 text-stone-600' : (ESTADO_CLASE[a.estado] || 'bg-stone-100 text-stone-700');
  const anio = a.nacimiento ? a.nacimiento.slice(0, 4) : '';
  return `<button type="button" data-action="ver-arbol" data-id="${esc(a.id)}" title="Centrar el árbol en ${esc(etiquetaVaca(a))}"
      class="arbol-caja ${central ? 'arbol-central' : ''} ${a.baja ? 'opacity-75' : ''}">
      ${rotulo}
      <p class="font-mono text-sm font-semibold text-green-900">${emojiAnimal(a)} ${esc(a.crotal)} <span class="text-stone-500" title="${SEXOS[sexoDe(a)]}">${SIMBOLO_SEXO[sexoDe(a)]}</span></p>
      ${a.nombre ? `<p class="text-sm">${esc(a.nombre)}</p>` : ''}
      <p class="text-xs text-stone-500">${esc(a.raza || '')}${a.raza && anio ? ' · ' : ''}${anio}</p>
      <span class="inline-block rounded-full ${clase} px-2 py-0.5 text-[11px] mt-1">${esc(estado)}</span>
    </button>`;
}

// Pedigrí hacia atrás: cada animal con sus dos padres a la derecha
function pedigri(a, gen, rol, vistos, central = false) {
  const caja = cajaArbol(a, { central, rol });
  if (!a || gen >= GENERACIONES_ARBOL || vistos.has(a.id)) return `<div class="ped">${caja}</div>`;
  const v2 = new Set(vistos).add(a.id);
  const padre = vacaAnyPorId(a.padreId);
  const madre = vacaAnyPorId(a.madreId);
  const rolP = gen === 1 ? 'Padre' : gen === 2 ? 'Abuelo' : 'Bisabuelo';
  const rolM = gen === 1 ? 'Madre' : gen === 2 ? 'Abuela' : 'Bisabuela';
  const ramaPadre = padre ? pedigri(padre, gen + 1, rolP, v2)
    : `<div class="ped">${cajaArbol(null, { rol: rolP, externo: a.padreExterno || '' })}</div>`;
  const ramaMadre = madre ? pedigri(madre, gen + 1, rolM, v2)
    : `<div class="ped">${cajaArbol(null, { rol: rolM })}</div>`;
  return `<div class="ped">${caja}<div class="ped-padres">${ramaPadre}${ramaMadre}</div></div>`;
}

// Descendencia hacia abajo (organigrama)
function ramaDescendencia(id, nivel, vistos) {
  if (nivel > PROFUNDIDAD_DESC_ARBOL) return '';
  const hijos = criasFicha(id)
    .filter((h) => !vistos.has(h.id))
    .sort((a, b) => (a.nacimiento || '').localeCompare(b.nacimiento || ''));
  if (!hijos.length) return '';
  hijos.forEach((h) => vistos.add(h.id));
  if (nivel === PROFUNDIDAD_DESC_ARBOL) {
    return `<ul><li><div class="arbol-caja arbol-vacia"><p class="text-xs text-stone-500">+${hijos.length} más…</p></div></li></ul>`;
  }
  return '<ul>' + hijos.map((h) => `<li>${cajaArbol(h)}${ramaDescendencia(h.id, nivel + 1, vistos)}</li>`).join('') + '</ul>';
}

function abrirArbol(id) {
  const a = vacaAnyPorId(id);
  if (!a) return;
  arbolActualId = id;
  const total = totalDescendientes(id);
  $('arbol-modal-titulo').textContent = `🌳 Árbol genealógico · ${etiquetaVaca(a)}`;
  $('arbol-ascendencia').innerHTML = pedigri(a, 1, '', new Set(), true);
  const desc = ramaDescendencia(id, 1, new Set([id]));
  $('arbol-descendencia').innerHTML = desc
    ? `<div class="arbol-desc"><ul><li>${cajaArbol(a, { central: true })}${desc}</li></ul></div>`
    : '<p class="text-sm text-stone-500">Sin descendencia registrada.</p>';
  $('arbol-desc-titulo').textContent = `Descendencia (${total})`;
  $('arbol-modal').classList.remove('hidden');
  $('arbol-modal').classList.add('flex');
  $('arbol-modal-body').scrollTop = 0;
}

function cerrarArbol() {
  $('arbol-modal').classList.add('hidden');
  $('arbol-modal').classList.remove('flex');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="ver-arbol"]');
  if (btn) abrirArbol(btn.dataset.id);
});
$('arbol-modal-x').addEventListener('click', cerrarArbol);
$('arbol-modal-cerrar').addEventListener('click', cerrarArbol);
$('arbol-modal').addEventListener('click', (e) => { if (e.target === $('arbol-modal')) cerrarArbol(); });
$('arbol-modal-ficha').addEventListener('click', () => {
  const id = arbolActualId;
  cerrarArbol();
  abrirFicha(id);
});
// Escape cierra primero el árbol (va por encima de la ficha)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('arbol-modal').classList.contains('hidden')) {
    e.stopPropagation();
    cerrarArbol();
  }
}, true);
