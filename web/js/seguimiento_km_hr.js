const km$ = (id) => document.getElementById(id);
let kmDatos = null,
  kmVisibles = [],
  kmSemanasExpandidas = false,
  kmMostrarLineas = false;
const kmMarcasGraficos = new Map();
const kmLineasContraidas = new Set();
const kmRegionesContraidas = new Set(), kmUnidadesContraidas = new Set();
const kmFmt = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
    : "—";
const kmFecha = (s) => (s ? s.split("-").reverse().join("-") : "—");
const kmMedida = (valor, unidad) =>
  Number.isFinite(valor) ? `${kmFmt(valor)}${unidad ? " " + unidad : ""}` : "—";
function kmCelda(fila, valor, tipo = "td") {
  const td = document.createElement(tipo);
  td.textContent = valor;
  fila.append(td);
  return td;
}
function kmSub(td, texto) {
  const sub = document.createElement("div");
  sub.className = "km-sub";
  sub.textContent = texto;
  td.append(sub);
}
function kmIndicesSemanas() {
  const indices = kmDatos.semanas.map((_, i) => i);
  return kmSemanasExpandidas ? indices : indices.slice(-1);
}
function kmComparacionLectura(equipo) {
  const indice = kmDatos.semanas.length - 1;
  const actual = equipo.lecturas[indice];
  const valida = l => l && Number.isFinite(l.valor) && l.valor > 0 && l.unidad;
  if (!valida(actual)) return null;
  for (let i = indice - 1; i >= 0; i--) {
    const anterior = equipo.lecturas[i];
    if (!valida(anterior) || anterior.unidad !== actual.unidad) continue;
    const diferencia = Math.max(actual.valor, anterior.valor) / Math.min(actual.valor, anterior.valor) - 1;
    return {
      semana: kmDatos.semanas[indice].numero,
      semanaAnterior: kmDatos.semanas[i].numero,
      actual: actual.valor,
      anterior: anterior.valor,
      unidad: actual.unidad,
      diferencia,
      alerta: diferencia > 1.00 + 1e-10,
    };
  }
  return null;
}
function kmTextoAlerta(comparacion) {
  return `Lectura actual: ${kmMedida(comparacion.actual, comparacion.unidad)} · anterior (semana ${comparacion.semanaAnterior}): ${kmMedida(comparacion.anterior, comparacion.unidad)} · la mayor supera a la menor en ${kmFmt(comparacion.diferencia * 100)}%`;
}
function kmColumnas() {
  return [
    "Patente / Unidad",
    "Status mantención",
    ...kmIndicesSemanas().map((i) => {
      const s = kmDatos.semanas[i];
      return `Semana ${s.numero} · ${kmFecha(s.fecha)}`;
    }),
    "KM U HR UM",
    "Fecha UM",
    "Intervalo",
    "Última lectura",
    "Saldo",
    "Próxima mantención",
    "Uso diario",
    "Fecha proyectada",
  ];
}
function kmGruposContraidos() {
  return kmVisibles.length > 0 && kmVisibles.every(e =>
    kmRegionesContraidas.has(e.region) ||
    kmUnidadesContraidas.has(JSON.stringify([e.region, e.ceco])));
}
function kmActualizarBotonGrupos() {
  const contraidos = kmGruposContraidos();
  const boton = km$("km-alternar-grupos");
  boton.textContent = contraidos ? "Expandir todo" : "Contraer todo";
  boton.setAttribute("aria-expanded", String(!contraidos));
  boton.disabled = !kmVisibles.length;
}
function kmRenderGrupos(grupos) {
  const detalle = km$("km-detalle");
  const ordenar = (a, b) => a[0].localeCompare(b[0], "es", { numeric: true });
  function cabecera(nombre, cantidad, clase) {
    const fila = document.createElement("tr");
    fila.className = `km-grupo ${clase}`;
    const celda = kmCelda(fila, "", "th");
    celda.colSpan = kmColumnas().length;
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "km-grupo-boton";
    boton.setAttribute("aria-controls", "km-detalle");
    celda.append(boton);
    detalle.append(fila);
    return { fila, boton, nombre: `${nombre} · ${cantidad} ${cantidad === 1 ? "patente" : "patentes"}` };
  }
  function estado(grupo, contraido) {
    grupo.boton.textContent = `${contraido ? "▸" : "▾"} ${grupo.nombre}`;
    grupo.boton.setAttribute("aria-expanded", String(!contraido));
    grupo.boton.title = contraido ? "Expandir grupo" : "Contraer grupo";
  }
  for (const [region, unidades] of [...grupos].sort(ordenar)) {
    const cantidad = [...unidades.values()].reduce((suma, filas) => suma + filas.length, 0);
    const grupoRegion = cabecera(`Región: ${region || "Sin región"}`, cantidad, "km-grupo-region");
    const hijos = [];
    const actualizar = () => {
      const regionContraida = kmRegionesContraidas.has(region);
      estado(grupoRegion, regionContraida);
      for (const { grupo, clave, filas, lineas } of hijos) {
        const unidadContraida = kmUnidadesContraidas.has(clave);
        grupo.fila.hidden = regionContraida;
        estado(grupo, unidadContraida);
        filas.forEach(fila => { fila.hidden = regionContraida || unidadContraida; });
        for (const linea of lineas) {
          const contraida = kmLineasContraidas.has(linea.clave);
          linea.grupo.fila.hidden = regionContraida || unidadContraida;
          estado(linea.grupo, contraida);
          linea.filas.forEach(fila => { fila.hidden = regionContraida || unidadContraida || contraida; });
        }
      }
    };
    grupoRegion.boton.onclick = () => {
      if (kmRegionesContraidas.has(region)) kmRegionesContraidas.delete(region);
      else kmRegionesContraidas.add(region);
      actualizar();
      kmActualizarBotonGrupos();
    };
    for (const [ceco, filas] of [...unidades].sort(ordenar)) {
      const clave = JSON.stringify([region, ceco]);
      const nombre = PortalConfig.nombreCeco?.(ceco) ?? ceco;
      const grupo = cabecera(`Unidad: ${nombre || "Sin unidad"}`, filas.length, "km-grupo-unidad");
      const lineas = [];
      hijos.push({ grupo, clave, filas, lineas });
      grupo.boton.onclick = () => {
        if (kmUnidadesContraidas.has(clave)) kmUnidadesContraidas.delete(clave);
        else kmUnidadesContraidas.add(clave);
        actualizar();
        kmActualizarBotonGrupos();
      };
      if(window.PortalZona?.activa() && kmMostrarLineas){
        const porLinea=new Map();
        filas.forEach(f=>{const l=f.dataset.linea;if(!porLinea.has(l))porLinea.set(l,[]);porLinea.get(l).push(f);});
        for(const [l,fs] of [...porLinea].sort(([a],[b])=>a.localeCompare(b,'es'))){
          const g=cabecera('Línea: '+l,fs.length,'zona-linea');
          const claveLinea = JSON.stringify([region, ceco, l]);
          lineas.push({ grupo: g, clave: claveLinea, filas: fs });
          g.boton.onclick = () => {
            if (kmLineasContraidas.has(claveLinea)) kmLineasContraidas.delete(claveLinea);
            else kmLineasContraidas.add(claveLinea);
            actualizar();
          };
          fs.forEach(f=>detalle.append(f));
        }
      }else filas.forEach(fila => detalle.append(fila));
    }
    actualizar();
  }
}
function renderKM() {
  const botonLineas = km$("km-alternar-lineas");
  botonLineas.hidden = !window.PortalZona?.activa();
  botonLineas.textContent = kmMostrarLineas ? "Ocultar líneas" : "Mostrar por línea";
  botonLineas.setAttribute("aria-pressed", String(kmMostrarLineas));
  if (!kmDatos) return;
  const previaRegion = km$("km-region").value;
  km$("km-region").replaceChildren(
    new Option("Todas las regiones incluidas", ""),
  );
  [
    ...new Set(
      kmDatos.equipos
        .filter((e) => (PortalConfig.incluida(e.region) && PortalConfig.cecoIncluido(e.ceco)))
        .map((e) => e.region),
    ),
  ]
    .sort()
    .forEach((r) => km$("km-region").add(new Option(r, r)));
  if ([...km$("km-region").options].some((o) => o.value === previaRegion))
    km$("km-region").value = previaRegion;
  const buscar = km$("km-buscar").value.trim().toUpperCase(),
    estado = km$("km-estado").value,
    region = km$("km-region").value;
  const selectorCeco = km$("km-ceco"),
    cecoPrevio = selectorCeco.value;
  const cecos = [
    ...new Set(
      kmDatos.equipos
        .filter(
          (e) =>
            (PortalConfig.incluida(e.region) && PortalConfig.cecoIncluido(e.ceco)) && (!region || e.region === region),
        )
        .map((e) => e.ceco),
    ),
  ].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  selectorCeco.replaceChildren(new Option("Todas las unidades", ""));
  cecos.forEach((c) =>
    selectorCeco.add(new Option(PortalConfig.nombreCeco?.(c) ?? c, c)),
  );
  selectorCeco.value = cecos.includes(cecoPrevio) ? cecoPrevio : "";
  kmVisibles = kmDatos.equipos
    .filter(
      (e) =>
        (PortalConfig.incluida(e.region) && PortalConfig.cecoIncluido(e.ceco)) &&
        e.patente.toUpperCase().includes(buscar) &&
        (!selectorCeco.value || e.ceco === selectorCeco.value) &&
        (!estado || e.calculo.estado === estado) &&
        (!region || e.region === region) &&
        (km$("km-diferencia").value !== "rojo" || kmComparacionLectura(e)?.alerta),
    )
    .sort((a, b) =>
      a.patente.localeCompare(b.patente, "es", { numeric: true }),
    );
  const indicesSemanas = kmIndicesSemanas();
  km$("km-cabecera").replaceChildren();
  const cab = document.createElement("tr");
  kmColumnas().forEach((t, i) => {
    const th = kmCelda(cab, t, "th");
    if (i >= 2 && i < 2 + indicesSemanas.length && kmDatos.semanas.length > 1) {
      th.textContent = "";
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "km-semana-boton";
      boton.textContent = t;
      boton.setAttribute("aria-expanded", String(kmSemanasExpandidas));
      boton.setAttribute("aria-controls", "km-tabla");
      boton.title = kmSemanasExpandidas
        ? "Mostrar solo la última semana"
        : "Mostrar todas las semanas";
      boton.onclick = () => {
        kmSemanasExpandidas = !kmSemanasExpandidas;
        renderKM();
        const botones = km$("km-cabecera").querySelectorAll(".km-semana-boton");
        botones[Math.min(i - 2, botones.length - 1)]?.focus();
      };
      th.append(boton);
    }

  });
  km$("km-cabecera").append(cab);
  km$("km-detalle").replaceChildren();
  const grupos = new Map();
  for (const e of kmVisibles) {
    const comparacion = kmComparacionLectura(e);
    const c = e.calculo,
      tr = document.createElement("tr");
    const nombre = kmCelda(tr, ""),
      boton = document.createElement("button");
    boton.className = "km-patente-boton";
    boton.type = "button";
    boton.textContent = e.patente;
    boton.onclick = () => {
      km$("km-patente").value = e.patente;
      renderGraficos();
      km$("km-resumen-grafico").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };
    nombre.append(boton);
    kmSub(
      nombre,
      e.region + " / " + (PortalConfig.nombreCeco?.(e.ceco) ?? e.ceco),
    );
    const status = kmCelda(tr, ""),
      indicador = document.createElement("span");
    indicador.className = "semaforo " + c.clase;
    indicador.textContent = c.estado;
    status.append(indicador);
    const comentario =
      c.estado === "No operativo" ? e.comentario_tania : c.motivo;
    if (comentario) kmSub(status, comentario);
    for (const i of indicesSemanas) {
      const l = e.lecturas[i],
        td = kmCelda(tr, l ? `${kmFmt(l.valor)} ${l.unidad || ""}` : "—");
      if (l) {
        kmSub(td, kmFecha(l.fecha_lectura));
        td.title = `Lectura: ${kmFecha(l.fecha_lectura)} · fila ${l.fila_excel} de Seguimiento KM-HR${l.unidad_desde_maestro ? " · unidad desde maestro" : ""}${l.fecha_desde_envio ? " · fecha desde envío" : ""}`;
        if (l.unidad_desde_maestro || l.fecha_desde_envio)
          kmSub(
            td,
            [
              l.unidad_desde_maestro ? "Unidad del maestro" : "",
              l.fecha_desde_envio ? "Fecha de envío" : "",
            ]
              .filter(Boolean)
              .join(" · "),
          );
      }
      if (comparacion?.alerta && comparacion.semana === kmDatos.semanas[i].numero) {
        td.className = "km-uso-alerta";
        kmSub(td, kmTextoAlerta(comparacion));
      }
    }
    tr.dataset.linea = e.linea || 'SIN LÍNEA';
    kmCelda(tr, kmMedida(e.ultima_mantencion, e.unidad));
    const um = kmCelda(tr, kmFecha(e.fecha_mantencion));
    kmSub(um, e.origen_mantencion || "Maestro");
    if (e.fila_mantencion)
      kmSub(
        um,
        `Fila ${e.fila_mantencion} · envío ${kmFecha(e.fecha_envio_mantencion)}`,
      );
    if (e.certificado_mantencion) {
      const texto = e.certificado_mantencion;
      try {
        const url = new URL(texto);
        if (!["https:", "http:"].includes(url.protocol))
          throw new Error("Esquema no permitido");
        const a = document.createElement("a");
        a.href = url.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Ver certificado";
        um.append(a);
      } catch {
        kmSub(um, "Certificado: " + texto);
      }
    } else if (e.fila_mantencion) kmSub(um, "Sin certificado");
    kmCelda(tr, `${kmFmt(e.intervalo)} ${e.unidad_intervalo || ""}`);
    const unidadLectura = e.lecturas.find(l => l?.semana === c.semana_actual)?.unidad || e.unidad;
    const actual = kmCelda(tr, kmMedida(c.actual, unidadLectura));
    kmSub(
      actual,
      c.semana_actual
        ? `Semana ${c.semana_actual} · ${kmFecha(c.fecha_lectura)}`
        : "Sin reporte",
    );
    if (comparacion?.alerta) {
      actual.className = "km-uso-alerta";
      actual.title = kmTextoAlerta(comparacion);
    }
    kmCelda(tr, kmMedida(c.saldo, e.unidad));
    kmCelda(tr, kmMedida(c.proxima, e.unidad));
    kmCelda(
      tr,
      c.ritmo_diario === null
        ? "—"
        : `${kmFmt(c.ritmo_diario)} ${e.unidad}/día`,
    );
    const proyectada = kmCelda(tr, kmFecha(c.fecha_proyectada));
    kmSub(
      proyectada,
      c.fecha_proyectada
        ? c.saldo <= 0
          ? "Estimada · objetivo alcanzado"
          : "Estimada"
        : c.motivo_proyeccion,
    );
    if (!grupos.has(e.region)) grupos.set(e.region, new Map());
    const unidades = grupos.get(e.region);
    if (!unidades.has(e.ceco)) unidades.set(e.ceco, []);
    unidades.get(e.ceco).push(tr);
  }
  kmRenderGrupos(grupos);
  kmActualizarBotonGrupos();
  if (!kmVisibles.length) {
    const tr = document.createElement("tr");
    kmCelda(tr, "No hay patentes para estos filtros.").colSpan =
      kmColumnas().length;
    km$("km-detalle").append(tr);
  }
  km$("km-total").textContent = kmVisibles.length;
  for (const [id, nombre] of [
    ["vigentes", "Mantención Vigente"],
    ["proximas", "Próxima a vencer"],
    ["vencidas", "Mantención Vencida"],
    ["revisar", "No operativo"],
  ])
    km$("km-" + id).textContent = kmVisibles.filter(
      (e) => e.calculo.estado === nombre,
    ).length;
  const previa = km$("km-patente").value;
  km$("km-patente").replaceChildren();
  kmVisibles.forEach((e) =>
    km$("km-patente").add(
      new Option(
        `${e.patente} · ${PortalConfig.nombreCeco?.(e.ceco) ?? e.ceco}`,
        e.patente,
      ),
    ),
  );
  if (kmVisibles.some((e) => e.patente === previa))
    km$("km-patente").value = previa;
  else {
    const ejemplo =
      kmVisibles.find((e) => e.calculo.fecha_proyectada) ||
      kmVisibles.find((e) => e.lecturas.some((l) => l && l.valor !== null));
    if (ejemplo) km$("km-patente").value = ejemplo.patente;
  }
  renderGraficos();
}
function svgElemento(tag, atributos = {}, texto) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, String(v));
  if (texto !== undefined) el.textContent = texto;
  return el;
}
function kmDestacarSemana(semana) {
  for (const [numero, marcas] of kmMarcasGraficos) {
    for (const { grupo, etiqueta, guia } of marcas) {
      const activa = numero === semana;
      grupo.setAttribute("class", activa ? "km-marca km-marca-activa" : "km-marca");
      etiqueta.setAttribute("visibility", activa ? "visible" : "hidden");
      guia.setAttribute("visibility", activa ? "visible" : "hidden");
    }
  }
}
function dibujarGrafico(id, puntos, unidad, barras = false, objetivo = null) {
  const cont = km$(id);
  cont.replaceChildren();
  const validos = puntos.filter((p) => Number.isFinite(p.valor));
  if (!validos.length && !(barras && puntos.some(p => p.alerta))) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = "No hay datos suficientes para este gráfico.";
    cont.append(p);
    return;
  }
  const w = 650,
    h = 300,
    m = { l: 80, r: 22, t: 26, b: 50 },
    n = puntos.length;
  const valores = validos.map((p) => p.valor);
  if (!valores.length) valores.push(0);
  if (Number.isFinite(objetivo)) valores.push(objetivo);
  let min = barras ? 0 : Math.min(...valores),
    max = Math.max(...valores);
  const pad = (max - min) * 0.12 || Math.max(max * 0.02, 1);
  min = barras ? 0 : Math.max(0, min - pad);
  max += pad;
  const x = (i) =>
      m.l +
      ((i + (barras ? 0.5 : 0)) * (w - m.l - m.r)) /
        Math.max(1, barras ? n : n - 1),
    y = (v) => h - m.b - ((v - min) / (max - min)) * (h - m.t - m.b);
  const svg = svgElemento("svg", {
    viewBox: `0 0 ${w} ${h}`,
    role: "img",
    "aria-label": `${barras ? "Consumo diario" : "Lectura"} por semana, ${unidad}`,
  });
  svg.append(
    svgElemento(
      "title",
      {},
      `${barras ? "Consumo diario" : "Lecturas semanales"} en ${unidad}`,
    ),
  );
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4,
      py = y(v);
    svg.append(
      svgElemento("line", {
        x1: m.l,
        y1: py,
        x2: w - m.r,
        y2: py,
        class: "km-rejilla",
      }),
    );
    svg.append(
      svgElemento(
        "text",
        { x: m.l - 9, y: py + 4, "text-anchor": "end", class: "km-eje" },
        kmFmt(v),
      ),
    );
  }
  svg.append(svgElemento("text", { x: m.l, y: 16, class: "km-eje" }, unidad));
  if (Number.isFinite(objetivo)) {
    svg.append(
      svgElemento("line", {
        x1: m.l,
        y1: y(objetivo),
        x2: w - m.r,
        y2: y(objetivo),
        class: "km-objetivo",
      }),
    );
    svg.append(
      svgElemento(
        "text",
        {
          x: w - m.r,
          y: y(objetivo) - 5,
          "text-anchor": "end",
          class: "km-eje",
        },
        "Próxima mantención",
      ),
    );
  }
  const paso = Math.max(1, Math.ceil(n / 10));
  let previo = null;
  puntos.forEach((p, i) => {
    const px = x(i);
    const grupo = svgElemento("g", { class: "km-marca", "data-semana": p.semana });
    const guia = svgElemento("line", { x1: px, x2: px, y1: m.t, y2: h - m.b, class: "km-guia-activa", visibility: "hidden" });
    const etiqueta = svgElemento("text", {
      x: Math.max(m.l + 8, Math.min(w - m.r - 8, px)), y: m.t + 16,
      "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
      class: "km-valor-activo", visibility: "hidden",
    }, `S${p.semana}: ${Number.isFinite(p.valor) ? kmMedida(p.valor, unidad) : "Sin datos"}`);
    grupo.append(guia);
    if (!kmMarcasGraficos.has(p.semana)) kmMarcasGraficos.set(p.semana, []);
    kmMarcasGraficos.get(p.semana).push({ grupo, etiqueta, guia });
    grupo.onmouseenter = grupo.onfocus = () => kmDestacarSemana(p.semana);
    grupo.onmouseleave = grupo.onblur = () => kmDestacarSemana(null);
    grupo.setAttribute("tabindex", "0");
    grupo.setAttribute("aria-label", `Semana ${p.semana}: ${Number.isFinite(p.valor) ? kmMedida(p.valor, unidad) : "Sin datos"}. ${p.detalle}`);
    svg.append(grupo);
    if (i % paso === 0 || i === n - 1)
      svg.append(
        svgElemento(
          "text",
          { x: px, y: h - 23, "text-anchor": "middle", class: "km-eje" },
          "S" + p.semana,
        ),
      );
    if (!Number.isFinite(p.valor)) {
      if (barras && p.alerta) {
        const aviso = svgElemento("g", { "aria-label": p.detalle });
        aviso.append(svgElemento("title", {}, p.detalle));
        aviso.append(svgElemento("circle", { cx: px, cy: h - m.b - 12, r: 10, fill: "#b42318" }));
        aviso.append(svgElemento("text", { x: px, y: h - m.b - 8, "text-anchor": "middle", fill: "white", "font-size": 14, "font-weight": "bold" }, "!"));
        grupo.append(aviso);
      }
      previo = null;
      grupo.append(etiqueta);
      return;
    }
    const py = y(p.valor);
    if (barras) {
      const ancho = Math.min(35, ((w - m.l - m.r) / n) * 0.6);
      const bar = svgElemento("rect", {
        x: px - ancho / 2,
        y: py,
        width: ancho,
        height: y(0) - py,
        class: p.alerta ? "km-barra km-barra-alerta" : "km-barra",
        "data-pdf-valor": kmFmt(p.valor),
        "aria-label": p.detalle,
      });
      bar.append(svgElemento("title", {}, p.detalle));
      grupo.append(bar);
      grupo.append(svgElemento("rect", { x: px - ancho / 2, y: Math.min(py, y(0) - 12), width: ancho, height: Math.max(12, y(0) - py), fill: "transparent", class: "km-area" }));
    } else {
      if (previo)
        svg.append(
          svgElemento("line", {
            x1: previo.x,
            y1: previo.y,
            x2: px,
            y2: py,
            class: p.alerta ? "km-linea km-linea-alerta" : "km-linea",
          }),
        );
      const punto = svgElemento("circle", {
        cx: px,
        cy: py,
        r: p.alerta ? 7 : 5,
        class: p.alerta ? "km-punto km-punto-alerta" : "km-punto",
        "data-pdf-valor": kmFmt(p.valor),
        "aria-label": p.detalle,
      });
      punto.append(svgElemento("title", {}, p.detalle));
      grupo.append(punto);
      grupo.append(svgElemento("circle", { cx: px, cy: py, r: 12, fill: "transparent", class: "km-area" }));
      previo = { x: px, y: py };
    }
    grupo.append(etiqueta);
  });
  // Las etiquetas quedan sobre las series y no capturan el mouse.
  for (const marca of kmMarcasGraficos.values()) {
    for (const { grupo, etiqueta } of marca) {
      if (grupo.parentNode === svg) svg.append(etiqueta);
    }
  }
  cont.append(svg);
}
function renderGraficos() {
  kmMarcasGraficos.clear();
  const e = kmVisibles.find((e) => e.patente === km$("km-patente").value);
  if (!e) {
    km$("km-resumen-grafico").textContent = "Sin patentes seleccionadas.";
    km$("km-grafico-lecturas").replaceChildren();
    km$("km-grafico-ritmo").replaceChildren();
    return;
  }
  const c = e.calculo;
  const comparacion = kmComparacionLectura(e);
  km$("km-titulo-lecturas").textContent =
    `Lecturas semanales · ${e.unidad || "unidad sin definir"}`;
  km$("km-titulo-ritmo").textContent =
    `Consumo diario entre lecturas · ${e.unidad || "—"}/día`;
  km$("km-resumen-grafico").textContent =
    `${e.patente} · ${e.ceco} · ${c.estado} · Saldo: ${kmFmt(c.saldo)} ${e.unidad || ""} · Fecha proyectada: ${kmFecha(c.fecha_proyectada)}${c.fecha_proyectada ? " (estimada)" : " · " + c.motivo_proyeccion}${c.motivo ? " · " + c.motivo : ""}`;
  const puntos = kmDatos.semanas.map((s, i) => {
    const l = e.lecturas[i];
    const alerta = Boolean(comparacion?.alerta && comparacion.semana === s.numero);
    return {
      semana: s.numero,
      valor: l && l.unidad === e.unidad ? l.valor : null,
      alerta,
      detalle: `Semana ${s.numero} (${kmFecha(s.fecha)}): ${l ? kmFmt(l.valor) : "sin reporte"} ${l?.unidad || ""}${alerta ? " · " + kmTextoAlerta(comparacion) : ""}`,
    };
  });
  dibujarGrafico(
    "km-grafico-lecturas",
    puntos,
    e.unidad || "—",
    false,
    c.proxima,
  );
  const ritmo = kmDatos.semanas.map((s) => {
    const v = c.variaciones.find((v) => v.semana === s.numero);
    const alerta = Boolean(comparacion?.alerta && comparacion.semana === s.numero);
    return {
      semana: s.numero,
      valor: v?.ritmo ?? null,
      alerta,
      detalle: v
        ? `S${v.desde_semana} a S${v.semana}: ${kmFmt(v.incremento)} ${e.unidad} en ${v.dias} días · ${kmFmt(v.ritmo)} ${e.unidad}/día${alerta ? " · " + kmTextoAlerta(comparacion) : ""}`
        : `Sin consumo diario válido${alerta ? " · " + kmTextoAlerta(comparacion) : ""}`,
    };
  });
  dibujarGrafico("km-grafico-ritmo", ritmo, `${e.unidad || "—"}/día`, true);
}
async function consultarKM(event) {
  event?.preventDefault();
  km$("km-consultar").disabled = true;
  km$("km-exportar").disabled = true;
  km$("km-resultados").hidden = true;
  kmDatos = null;
  kmVisibles = [];
  kmSemanasExpandidas = false;
  km$("km-mensaje").textContent = "Consultando maestro y lecturas semanales…";
  try {
    const consulta = new URLSearchParams({
      inicio: km$("km-inicio").value,
      fecha: km$("km-fecha").value,
    });
    const respuesta = await PortalDatos.consultar(
      "/api/seguimiento-km-hr?" + consulta,
      { cache: "no-store" },
    );
    if (respuesta.status === 404)
      throw new Error("Reinicia Iniciar_Panel.bat para habilitar KM-HR.");
    const datos = await respuesta.json();
    if (!respuesta.ok)
      throw new Error(datos.error || "No se pudo consultar la BD.");
    if (
      datos.version !== 2 ||
      !Array.isArray(datos.semanas) ||
      !Array.isArray(datos.equipos)
    )
      throw new Error(
        "El servidor usa el seguimiento anterior. Detén y vuelve a ejecutar Iniciar_Panel.bat.",
      );
    kmDatos = datos;
    PortalConfig.registrarCecos?.(datos);
    PortalConfig.registrar(datos.equipos.map((e) => e.region));
    const previa = km$("km-region").value;
    km$("km-region").replaceChildren(new Option("Todas", ""));
    [...new Set(datos.equipos.map((e) => e.region))]
      .sort()
      .forEach((r) => km$("km-region").add(new Option(r, r)));
    if ([...km$("km-region").options].some((o) => o.value === previa))
      km$("km-region").value = previa;
    km$("km-periodo").textContent =
      `${datos.semanas.length} semanas · S1: ${kmFecha(datos.inicio)} · Última referencia: ${kmFecha(datos.semanas.at(-1).fecha)}. Fechas tomadas de las columnas del Excel.`;
    renderKM();
    km$("km-resultados").hidden = false;
    km$("km-exportar").disabled = false;
    km$("km-mensaje").textContent =
      "Consulta completada. " +
      (PortalDatos.consulta
        ? ""
        : datos.advertencias
            .map((a) => PortalConfig.textoUnidad?.(a) ?? a)
            .join(" "));
    km$("km-fuente").textContent =
      `Maestro: ${datos.maestro} · Lecturas: ${datos.fuente} / ${datos.hoja}`;
  } catch (error) {
    km$("km-mensaje").textContent = error.message;
    kmDatos = null;
  } finally {
    km$("km-consultar").disabled = false;
  }
}
km$("km-exportar").onclick = () => {
  if (!kmDatos) return;
  const rows = [
    [
      "Patente",
      window.PortalZona?.activa() ? "Zona" : "Región",
      "Unidad",
      ...(window.PortalZona?.activa() ? ["Línea de negocio"] : []),
      "Medida KM/HR",
      ...kmDatos.semanas.map((s) => `Semana ${s.numero} ${s.fecha}`),
      "KM U HR UM",
      "Fecha UM",
      "Intervalo",
      "UN IN",
      "Última lectura",
      "Fecha lectura",
      "Saldo",
      "Próxima mantención",
      "Status mantención",
      "Motivo revisión",
      "Uso diario",
      "Fecha proyectada",
      "Motivo sin proyección",
      "Origen UM",
      "Fila actualización",
      "Envío actualización",
      "Certificado UM",
    ],
  ];
  kmVisibles.forEach((e) => {
    const c = e.calculo;
    rows.push([
      e.patente,
      e.region,
      e.ceco,
      ...(window.PortalZona?.activa() ? [e.linea] : []),
      e.unidad,
      ...e.lecturas.map((l) => (l ? `${l.valor ?? ""} ${l.unidad || ""}` : "")),
      e.ultima_mantencion,
      e.fecha_mantencion,
      e.intervalo,
      e.unidad_intervalo,
      c.actual,
      c.fecha_lectura,
      c.saldo,
      c.proxima,
      c.estado,
      c.motivo,
      c.ritmo_diario,
      c.fecha_proyectada,
      c.motivo_proyeccion,
      e.origen_mantencion,
      e.fila_mantencion,
      e.fecha_envio_mantencion,
      e.certificado_mantencion,
    ]);
  });
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          let s = String(v ?? "");
          if (typeof v === "string" && /^[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `Seguimiento_KM_HR_${kmDatos.fecha}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
km$("km-alternar-grupos").onclick = () => {
  if (!kmDatos) return;
  if (kmGruposContraidos()) {
    kmRegionesContraidas.clear();
    kmUnidadesContraidas.clear();
    kmLineasContraidas.clear();
  } else {
    for (const e of kmDatos.equipos) {
      kmRegionesContraidas.add(e.region);
      kmUnidadesContraidas.add(JSON.stringify([e.region, e.ceco]));
    }
  }
  renderKM();
};
km$("km-alternar-lineas").onclick = () => {
  if (!window.PortalZona?.activa()) return;
  kmMostrarLineas = !kmMostrarLineas;
  renderKM();
};
km$("km-buscar").oninput = renderKM;
km$("km-estado").onchange = renderKM;
km$("km-diferencia").onchange = renderKM;
km$("km-region").onchange = renderKM;
km$("km-ceco").onchange = renderKM;
km$("km-patente").onchange = renderGraficos;
const hoyKM = PortalDatos.fechaActual();
km$("km-fecha").value =
  `${hoyKM.getFullYear()}-${String(hoyKM.getMonth() + 1).padStart(2, "0")}-${String(hoyKM.getDate()).padStart(2, "0")}`;
km$("km-form").onsubmit = consultarKM;
consultarKM();

window.addEventListener("portal-config", renderKM);
