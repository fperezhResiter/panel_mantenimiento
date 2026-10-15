const MT_ESTADOS=['Mantención Vencida','Próxima a vencer','Mantención Vigente','No operativo'];
const MT_COLORES=['rojo','amarillo','verde','neutro'];
const MT_CLASES=['mt-rojo','mt-amarillo','mt-verde','mt-gris'];
function colorPorcentajeMt(porcentaje){
    return !Number.isFinite(porcentaje)?'neutro':porcentaje>=90?'verde':porcentaje>=75?'amarillo':'rojo';
}
function estadoMt(e)
{
    return MT_ESTADOS.includes(e.calculo.estado)?e.calculo.estado:'No operativo';
}
function conteoMt(equipos)
{
    const c={estados:[0,0,0,0],total:equipos.length,porcentaje:null};
    for(const e of equipos)
        c.estados[MT_ESTADOS.indexOf(estadoMt(e))]++;
    const base=c.total-c.estados[3];
    c.porcentaje=base?100*(base-c.estados[0])/base:null;
    return c;
}
function agruparMt(equipos)
{
    const mapa=new Map();
    for(const e of equipos){
        if(!mapa.has(e.region))mapa.set(e.region,new Map());
        const c=mapa.get(e.region);
        if(!c.has(e.ceco))c.set(e.ceco,[]);
        c.get(e.ceco).push(e);
    }
    return [...mapa].sort(([a],[b])=>a.localeCompare(b)).map(([region,cecos])=>({
        region,
        conteo:conteoMt([...cecos.values()].flat()),
        cecos:[...cecos].sort(([a],[b])=>a.localeCompare(b)).map(([ceco,equipos])=>({ceco,conteo:conteoMt(equipos),lineas:typeof window!=='undefined'&&window.PortalZona?.activa()?[...new Set(equipos.map(e=>e.linea))].sort().map(linea=>({linea,conteo:conteoMt(equipos.filter(e=>e.linea===linea))})):[]}))
    }));
}
function mesValidoMt(mes)
{
    return typeof mes==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)&&Number(mes.slice(0,4))>=1000;
}
function periodoMesMt(mes){
    if(!mesValidoMt(mes)||mes<'2026-08')throw new Error('Selecciona un mes desde agosto de 2026.');
    const [y,m]=mes.split('-').map(Number);
    return {inicio:mes==='2026-08'?'2026-08-04':mes+'-01',fecha:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)};
}
function eventosMesMt(equipos,mes,region='')
{
    if(!mesValidoMt(mes))return [];
    const preparar=typeof module!=='undefined'?require('./calendario_descarga.js').equiposCalendarioMt:equiposCalendarioMt;
    return preparar(equipos).filter(e=>e.calculo.fecha_proyectada?.slice(0,7)===mes&&(!region||e.region===region)).sort((a,b)=>a.region.localeCompare(b.region)||a.calculo.fecha_proyectada.localeCompare(b.calculo.fecha_proyectada)||a.patente.localeCompare(b.patente));
}
function celdasCalendarioMt(mes)
{
    if(!mesValidoMt(mes))return [];
    const [y,m]=mes.split('-').map(Number),
          inicio=new Date(Date.UTC(y,m-1,1)),
          dias=new Date(Date.UTC(y,m,0)).getUTCDate();
    const c=Array((inicio.getUTCDay()+6)%7).fill(null);
    for(let d=1;d<=dias;d++)c.push(`${mes}-${String(d).padStart(2,'0')}`);
    while(c.length%7)c.push(null);
    return c;
}
function csvMt(filas)
{
    return '\uFEFF'+filas.map(f=>f.map(v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(';')).join('\r\n');
}
if(typeof module!=='undefined')module.exports={MT_ESTADOS,estadoMt,conteoMt,colorPorcentajeMt,agruparMt,eventosMesMt,celdasCalendarioMt,csvMt,periodoMesMt};

if(typeof document!=='undefined')
{
    const mt$=id=>document.getElementById(id);
    const mtEsCalendario=document.body.dataset.panel==='calendario';
    let mtDatos=null,mtIncluidos=[],mtMes=[],mtDia='',mtGrupos=[];
    let mtConsulta=0;
    const mtRegionesContraidas = new Set(), mtUnidadesExpandidas = new Set();
    let mtModoResumen = null, mtNodosResumen = [];
    let mtMostrarLineasAgenda = false, mtModoAgenda = null;
    const mtGruposAgendaContraidos = new Set();
    let mtNodosAgenda = [];
    const mtNumero=n=>Number.isFinite(n)?n.toLocaleString('es-CL',{maximumFractionDigits:1}):'—',mtFecha=s=>s?s.split('-').reverse().join('-'):'—';
    function mtCelda(tr,texto,tipo='td'){const td=document.createElement(tipo);td.textContent=texto;tr.append(td);return td;}
    function mtBadge(td,estado){const b=document.createElement('span');b.className='semaforo '+MT_COLORES[MT_ESTADOS.indexOf(estado)];b.textContent=estado;td.append(b);}
function mtConfiguracion(){if(mtDatos)PortalConfig.registrar(mtDatos.equipos.map(e=>e.region));}
window.addEventListener('portal-config',()=>mtActualizar());
function mtMetricas(tr,conteo){
 conteo.estados.forEach((v,i)=>{const td=mtCelda(tr,mtNumero(v));td.className=MT_CLASES[i];});
 mtCelda(tr,mtNumero(conteo.total));
 const celda=mtCelda(tr,''),indicador=document.createElement('span');
 indicador.className='semaforo '+colorPorcentajeMt(conteo.porcentaje);
 indicador.textContent=Number.isFinite(conteo.porcentaje)?mtNumero(conteo.porcentaje)+' %':'—';
 celda.append(indicador);
}
function mtEstadoGruposResumen(){
 const regiones = mtNodosResumen.filter(n => n.tipo === 'region');
 const unidades = mtNodosResumen.filter(n => n.tipo === 'unidad');
 const todoExpandido = regiones.every(n => !mtRegionesContraidas.has(n.clave)) && unidades.every(n => mtUnidadesExpandidas.has(n.clave));
 const boton = mt$('mt-alternar-grupos');
 boton.disabled = !regiones.length;
 boton.textContent = todoExpandido ? 'Contraer todo' : 'Expandir todo';
 boton.setAttribute('aria-expanded', String(todoExpandido));
 const lineas = mt$('mt-alternar-lineas');
 lineas.hidden = !window.PortalZona?.activa();
 lineas.disabled = !unidades.length;
 const expandidas = unidades.length > 0 && unidades.every(n => mtUnidadesExpandidas.has(n.clave));
 lineas.textContent = expandidas ? 'Contraer líneas' : 'Expandir líneas';
 lineas.setAttribute('aria-expanded', String(expandidas));
 for(const nodo of mtNodosResumen){
  const expandido = nodo.tipo === 'region' ? !mtRegionesContraidas.has(nodo.clave) : mtUnidadesExpandidas.has(nodo.clave);
  nodo.boton.textContent = `${expandido ? '▾' : '▸'} ${nodo.nombre}`;
  nodo.boton.setAttribute('aria-expanded', String(expandido));
  nodo.boton.title = expandido ? 'Contraer grupo' : 'Expandir grupo';
  if(nodo.tipo === 'region') nodo.hijos.forEach(fila => { fila.hidden = !expandido; });
  else nodo.hijos.forEach(fila => { fila.hidden = mtRegionesContraidas.has(nodo.region) || !expandido; });
 }
}
function mtFilaGrupoResumen(nombre, conteo, clase, tipo, clave, region){
 const fila = document.createElement('tr');
 fila.className = clase;
 const celda = mtCelda(fila, '');
 const boton = document.createElement('button');
 boton.type = 'button'; boton.className = 'mt-grupo-boton';
 boton.setAttribute('aria-controls', 'mt-detalle');
 celda.append(boton); mtMetricas(fila, conteo); mt$('mt-detalle').append(fila);
 const nodo = {tipo, clave, region, nombre, fila, boton, hijos:[]};
 mtNodosResumen.push(nodo);
 boton.onclick = () => {
  const conjunto = tipo === 'region' ? mtRegionesContraidas : mtUnidadesExpandidas;
  if(conjunto.has(clave)) conjunto.delete(clave); else conjunto.add(clave);
  mtEstadoGruposResumen();
 };
 return nodo;
}
function mtResumen(){
 if(mtEsCalendario)return;
 const zona = Boolean(window.PortalZona?.activa());
 if(mtModoResumen !== zona){mtRegionesContraidas.clear();mtUnidadesExpandidas.clear();mtModoResumen=zona;}
 mtNodosResumen = [];
 mtGrupos=agruparMt(mtIncluidos);mt$('mt-detalle').replaceChildren();mt$('mt-totales').replaceChildren();mt$('mt-kpis').replaceChildren();const total=conteoMt(mtIncluidos);
 for(let i=0;i<MT_ESTADOS.length;i++){const k=document.createElement('div');k.className='kpi';k.dataset.kpiColor=['rojo','amarillo','verde','neutro'][i];const n=document.createElement('b'),t=document.createElement('span');n.textContent=mtNumero(total.estados[i]);t.textContent=MT_ESTADOS[i];k.append(n,t);mt$('mt-kpis').append(k);}
 for(const r of mtGrupos){
  const region = mtFilaGrupoResumen(r.region, r.conteo, 'region', 'region', r.region);
  for(const c of r.cecos){
   const nombre = PortalConfig.nombreCeco?.(c.ceco) ?? c.ceco;
   let unidad;
   if(zona && c.lineas.length){
    unidad = mtFilaGrupoResumen(nombre, c.conteo, 'mt-ceco', 'unidad', JSON.stringify([r.region,c.ceco]), r.region);
   }else{
    const fila=document.createElement('tr');fila.className='mt-ceco';mtCelda(fila,nombre);mtMetricas(fila,c.conteo);mt$('mt-detalle').append(fila);
    unidad={fila,hijos:[]};
   }
   region.hijos.push(unidad.fila);
   for(const l of c.lineas){
    const fila=document.createElement('tr');fila.className='zona-linea';mtCelda(fila,'Línea: '+(l.linea || 'SIN LÍNEA'));mtMetricas(fila,l.conteo);mt$('mt-detalle').append(fila);
    unidad.hijos.push(fila);region.hijos.push(fila);
   }
  }
 }
 mtEstadoGruposResumen();
 if(!mtGrupos.length){const tr=document.createElement('tr');mtCelda(tr,'No hay patentes para los filtros y las regiones incluidas.').colSpan=7;mt$('mt-detalle').append(tr);}
 const general=document.createElement('tr');mtCelda(general,'Total general');mtMetricas(general,total);mt$('mt-totales').append(general);
 mt$('mt-patentes').replaceChildren();for(const e of mtIncluidos){const tr=document.createElement('tr');[e.patente,e.region,(PortalConfig.nombreCeco?.(e.ceco) ?? e.ceco)+(window.PortalZona?.activa()?' / '+e.linea:'')].forEach(v=>mtCelda(tr,v));mtBadge(mtCelda(tr,''),estadoMt(e));[e.estado_equipo||'Sin estado reportado',mtFecha(e.fecha_estado_equipo),e.calculo.motivo||'—'].forEach(v=>mtCelda(tr,v));mt$('mt-patentes').append(tr);}
}
function mtActualizar(){if(!mtDatos)return;mtIncluidos=mtDatos.equipos.filter(e=>PortalConfig.incluida(e.region)&&(PortalConfig.cecoIncluido?.(e.ceco) ?? true)&&(!mtEsCalendario||!PortalDatos.consulta||PortalConfig.calendarioIncluida(e.patente)));const regiones=[...new Set(mtIncluidos.map(e=>e.region))].sort();if(mtEsCalendario){const previa=mt$('mt-region-cal').value;mt$('mt-region-cal').replaceChildren(new Option('Todas las regiones incluidas',''));regiones.forEach(r=>mt$('mt-region-cal').add(new Option(r,r)));if(regiones.includes(previa))mt$('mt-region-cal').value=previa;}
 if(!mtEsCalendario){
  const selectorRegion=mt$('mt-region-resumen'),selectorCeco=mt$('mt-ceco-resumen');
  const regionPrevia=selectorRegion.value,cecoPrevio=selectorCeco.value;
  selectorRegion.replaceChildren(new Option('Todas las regiones incluidas',''));
  regiones.forEach(r=>selectorRegion.add(new Option(r,r)));
  selectorRegion.value=regiones.includes(regionPrevia)?regionPrevia:'';
  mtIncluidos=mtIncluidos.filter(e=>!selectorRegion.value||e.region===selectorRegion.value);
  const cecos=[...new Set(mtIncluidos.map(e=>e.ceco))].sort();
  selectorCeco.replaceChildren(new Option('Todas las unidades',''));
  cecos.forEach(c=>selectorCeco.add(new Option(PortalConfig.nombreCeco?.(c) ?? c,c)));
  selectorCeco.value=cecos.includes(cecoPrevio)?cecoPrevio:'';
  mtIncluidos=mtIncluidos.filter(e=>!selectorCeco.value||e.ceco===selectorCeco.value);
 }
 if(mtEsCalendario){
  mtIncluidos=mtIncluidos.filter(e=>!mt$('mt-region-cal').value||e.region===mt$('mt-region-cal').value);
  const selector=mt$('mt-ceco-cal'),previo=selector.value;
  const cecos=[...new Set(mtIncluidos.map(e=>e.ceco))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  selector.replaceChildren(new Option('Todas las unidades',''));cecos.forEach(c=>selector.add(new Option(PortalConfig.nombreCeco?.(c) ?? c,c)));selector.value=cecos.includes(previo)?previo:'';
  mtIncluidos=mtIncluidos.filter(e=>!selector.value||e.ceco===selector.value);
 }
 mt$('mt-alcance').textContent=`${new Set(mtIncluidos.map(e=>e.region)).size} regiones y ${mtIncluidos.length} patentes incluidas. ${mtEsCalendario?'':`Mes de lecturas: ${mtDatos.fecha.slice(0,7)}. `}Lecturas disponibles: ${mtFecha(mtDatos.inicio)} a ${mtFecha(mtDatos.semanas.at(-1).fecha)}. La última mantención y el estado operativo corresponden al estado actual del Excel.`;
 mtResumen();mtDia='';mtCalendario();}
function mtCalendario(){
 if(!mtDatos||!mtEsCalendario)return;const mes=mt$('mt-mes').value,region=mt$('mt-region-cal').value;mtMes=eventosMesMt(mtIncluidos,mes,region);const grid=mt$('mt-cal-grid');grid.replaceChildren();mt$('mt-exportar-informe').disabled=!region||!mesValidoMt(mes);mtNotaDescarga();
 if(!mesValidoMt(mes)){mt$('mt-cal-nota').textContent='Selecciona un mes válido.';mtMes=[];mtDia='';mtAgenda();mt$('mt-exportar-calendario').disabled=true;return;}
 mt$('mt-exportar-calendario').disabled=false;const candidatos=mtIncluidos.filter(e=>!region||e.region===region),sinFecha=candidatos.filter(e=>!(e.fecha_proyectada_real||e.calculo.fecha_proyectada)).length;
 mt$('mt-cal-nota').textContent=`${mtMes.length} patentes con mantención proyectada en ${mes}. ${sinFecha} patentes de las regiones elegidas no tienen fecha proyectada y quedan fuera del calendario.`;
 const ayudaMes=document.createElement('span');ayudaMes.dataset.pdfOmitir='';ayudaMes.textContent=' Cambiar el mes no cambia el período de lecturas utilizado.';mt$('mt-cal-nota').append(ayudaMes);
 for(const dia of ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']){const n=document.createElement('div');n.className='mt-cal-nombre';n.textContent=dia;grid.append(n);}
 const hoy=new Date(),hoyTexto=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
 for(const fecha of celdasCalendarioMt(mes)){if(!fecha){const vacio=document.createElement('div');vacio.className='mt-cal-vacio';vacio.setAttribute('aria-hidden','true');grid.append(vacio);continue;}const eventos=mtMes.filter(e=>e.calculo.fecha_proyectada===fecha),boton=document.createElement('button');boton.type='button';boton.className='mt-cal-dia'+(eventos.length?' programado':'')+(fecha===hoyTexto?' hoy':'');boton.disabled=!eventos.length;boton.setAttribute('aria-pressed',String(mtDia===fecha));boton.setAttribute('aria-label',`${mtFecha(fecha)}: ${eventos.length} ${eventos.length===1?'mantención preventiva proyectada':'mantenciones preventivas proyectadas'}`);const numero=document.createElement('b');numero.textContent=Number(fecha.slice(-2));boton.append(numero);if(eventos.length){const cuenta=document.createElement('small');cuenta.textContent=`${eventos.length} ${eventos.length===1?'mantención preventiva':'mantenciones preventivas'}`;const ejemplos=document.createElement('small');ejemplos.className='mt-ejemplos';ejemplos.textContent=eventos.slice(0,2).map(e=>e.patente).join(' · ')+(eventos.length>2?'…':'');boton.append(cuenta,ejemplos);boton.onclick=()=>{mtDia=mtDia===fecha?'':fecha;mtCalendario();};}grid.append(boton);}
 mtAgenda();
}
function mtSeleccionDescarga(){return equiposCalendarioMt(mtMes,new Set(PortalConfig.estado().calendario_excluidas||[]));}
function mtNotaDescarga(){
 const region=mt$('mt-region-cal').value;
 mt$('mt-informe-nota').textContent=`${mtSeleccionDescarga().length} de ${mtMes.length} patentes del mes y región seleccionados se incluirán en las descargas PDF por región y CSV. `+(region?`El PDF incluye el calendario y la tabla de ${region}.`:'Elige una región para habilitar el PDF.');
 if(mt$('mt-config-estado'))mt$('mt-config-estado').textContent=PortalConfig.aviso();
}
function mtEstadoGruposAgenda(){
 for(const nodo of mtNodosAgenda){
  const contraido = mtGruposAgendaContraidos.has(nodo.clave);
  nodo.fila.hidden = Boolean(nodo.padre && (nodo.padre.fila.hidden || mtGruposAgendaContraidos.has(nodo.padre.clave)));
  nodo.boton.textContent = `${contraido ? '▸' : '▾'} ${nodo.nombre}`;
  nodo.boton.setAttribute('aria-expanded', String(!contraido));
  nodo.boton.title = contraido ? 'Expandir grupo' : 'Contraer grupo';
  nodo.filas.forEach(fila => { fila.hidden = nodo.fila.hidden || contraido; });
 }
 const expandido = mtNodosAgenda.every(n => !mtGruposAgendaContraidos.has(n.clave));
 const boton = mt$('mt-cal-alternar-grupos');
 boton.disabled = !mtNodosAgenda.length;
 boton.textContent = expandido ? 'Contraer todo' : 'Expandir todo';
 boton.setAttribute('aria-expanded', String(expandido));
}
function mtGrupoAgenda(nombre, clase, clave, padre=null){
 const fila=document.createElement('tr');fila.className=clase;
 const celda=mtCelda(fila,'');celda.colSpan=PortalDatos.consulta?6:7;
 const boton=document.createElement('button');boton.type='button';boton.className='mt-grupo-boton';
 boton.setAttribute('aria-controls','mt-agenda');celda.append(boton);mt$('mt-agenda').append(fila);
 const nodo={nombre,fila,boton,clave,padre,filas:[]};mtNodosAgenda.push(nodo);
 boton.onclick=()=>{
  if(mtGruposAgendaContraidos.has(clave))mtGruposAgendaContraidos.delete(clave);
  else mtGruposAgendaContraidos.add(clave);
  mtEstadoGruposAgenda();
 };
 return nodo;
}
function mtAgenda(){
 const zona = Boolean(window.PortalZona?.activa());
 if(mtModoAgenda !== zona){mtMostrarLineasAgenda=false;mtGruposAgendaContraidos.clear();mtModoAgenda=zona;}
 mtNodosAgenda=[];
 const botonLineas = mt$('mt-cal-alternar-lineas');
 botonLineas.hidden = !zona;
 botonLineas.textContent = mtMostrarLineasAgenda ? 'Ocultar líneas' : 'Mostrar por línea';
 botonLineas.setAttribute('aria-pressed', String(mtMostrarLineasAgenda));
 mt$('mt-agenda').replaceChildren();
 const eventos=mtMes.filter(e=>!mtDia||e.calculo.fecha_proyectada===mtDia).sort((a,b)=>a.region.localeCompare(b.region)||a.ceco.localeCompare(b.ceco)||(zona && mtMostrarLineasAgenda ? (a.linea||'').localeCompare(b.linea||'') : 0)||a.calculo.fecha_proyectada.localeCompare(b.calculo.fecha_proyectada)||a.patente.localeCompare(b.patente));
 botonLineas.disabled = !eventos.length;
 mt$('mt-todo-mes').hidden=!mtDia;
 mt$('mt-dia-titulo').textContent=mtDia?`Detalle del ${mtFecha(mtDia)} · ${eventos.length} patentes`:`Agenda del mes · ${eventos.length} patentes`;
 let region=null,unidad=null,linea=null,grupoRegion=null,grupoUnidad=null,grupoLinea=null;
 for(const e of eventos){
  if(e.region!==region){
   region=e.region;unidad=null;linea=null;grupoUnidad=null;grupoLinea=null;
   grupoRegion=mtGrupoAgenda(region,'region',JSON.stringify([zona,region]));
  }
  if(zona){
    if(unidad!==e.ceco){
     unidad=e.ceco;linea=null;grupoLinea=null;
     grupoUnidad=mtGrupoAgenda('Unidad: '+(PortalConfig.nombreCeco?.(e.ceco) ?? e.ceco),'mt-agenda-unidad',JSON.stringify([zona,region,unidad]),grupoRegion);
    }
    const nombreLinea=e.linea || 'SIN LÍNEA';
    if(mtMostrarLineasAgenda && linea!==nombreLinea){
     linea=nombreLinea;
     grupoLinea=mtGrupoAgenda('Línea: '+linea,'zona-linea',JSON.stringify([zona,region,unidad,linea]),grupoUnidad);
    }
  }
  const tr=document.createElement('tr');
  if(!PortalDatos.consulta){
    const casilla=document.createElement('input');
    casilla.type='checkbox';casilla.checked=PortalConfig.calendarioIncluida(e.patente);
    casilla.setAttribute('aria-label',`Incluir ${e.patente} en la publicación del calendario y descargas`);
    casilla.onchange=()=>{PortalConfig.seleccionar('calendario_excluidas',e.patente,casilla.checked);mtNotaDescarga();};
    mtCelda(tr,'').append(casilla);
  }
  [e.patente,PortalConfig.nombreCeco?.(e.ceco) ?? e.ceco,e.unidad||'—',mtFecha(e.calculo.fecha_proyectada),mtNumero(e.calculo.proxima)].forEach(v=>mtCelda(tr,v));
  mtBadge(mtCelda(tr,''),estadoMt(e));mt$('mt-agenda').append(tr);
  (grupoLinea || grupoUnidad || grupoRegion).filas.push(tr);
 }
 if(!eventos.length){const tr=document.createElement('tr');mtCelda(tr,'No hay mantenciones proyectadas para el mes y las regiones seleccionadas.').colSpan=PortalDatos.consulta?6:7;mt$('mt-agenda').append(tr);}
 mtEstadoGruposAgenda();
}
function descargarMt(filas,nombre){const url=URL.createObjectURL(new Blob([csvMt(filas)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=nombre;a.click();URL.revokeObjectURL(url);}
if(mtEsCalendario)mt$('mt-exportar-informe').onclick=()=>{const region=mt$('mt-region-cal').value,mes=mt$('mt-mes').value;if(!mtDatos||!region||!mesValidoMt(mes))return;const html=informeCalendarioMt(mtSeleccionDescarga(),mes,region,mtDatos.inicio,mtDatos.semanas.at(-1).fecha);return PanelPDF.descargar({html,nombre:`Calendario_y_Patentes_${region.replace(/[^\p{L}\p{N}_-]/gu,'_')}_${mes}.pdf`,titulo:`Calendario ${region} · ${mes}`});};
if(!mtEsCalendario)mt$('mt-exportar-resumen').onclick=()=>{if(!mtDatos)return;const filas=[['Tipo',window.PortalZona?.activa()?'Zona':'Región','Unidad',...(window.PortalZona?.activa()?['Línea de negocio']:[]),...MT_ESTADOS,'Total general','% no vencidas','Fecha referencia']];const agregar=(tipo,region,ceco,c,linea='')=>filas.push([tipo,region,ceco,...(window.PortalZona?.activa()?[linea]:[]),...c.estados,c.total,c.porcentaje,mtDatos.fecha]);for(const r of mtGrupos){agregar('Subtotal región',r.region,'',r.conteo);for(const c of r.cecos){agregar('Unidad',r.region,c.ceco,c.conteo);for(const l of c.lineas||[])agregar('Línea',r.region,c.ceco,l.conteo,l.linea);}}agregar('Total general','','',conteoMt(mtIncluidos));descargarMt(filas,`Reporte_Mantencion_${mtDatos.fecha}.csv`);};
if(mtEsCalendario)mt$('mt-exportar-calendario').onclick=()=>{if(!mtDatos)return;const filas=[['Fecha proyectada','Patente',window.PortalZona?.activa()?'Zona':'Región','Unidad',...(window.PortalZona?.activa()?['Línea de negocio']:[]),'Medida KM/HR','Próxima mantención','Estado','Fecha de última lectura']];mtSeleccionDescarga().forEach(e=>filas.push([e.calculo.fecha_proyectada,e.patente,e.region,e.ceco,...(window.PortalZona?.activa()?[e.linea]:[]),e.unidad,e.calculo.proxima,estadoMt(e),e.calculo.fecha_lectura]));descargarMt(filas,`Calendario_Mantenciones_${mt$('mt-mes').value}.csv`);};

if(mtEsCalendario){
 mt$('mt-cal-alternar-grupos').onclick=()=>{
  if(!mtDatos)return;
  const expandir=mtNodosAgenda.some(n=>mtGruposAgendaContraidos.has(n.clave));
  if(expandir)mtGruposAgendaContraidos.clear();
  else mtNodosAgenda.forEach(n=>mtGruposAgendaContraidos.add(n.clave));
  mtEstadoGruposAgenda();
 };
 mt$('mt-cal-alternar-lineas').onclick=()=>{
  if(!mtDatos || !window.PortalZona?.activa())return;
  mtMostrarLineasAgenda=!mtMostrarLineasAgenda;
  mtAgenda();
 };
 mt$('mt-mes').onchange=()=>{mtDia='';mtCalendario();};mt$('mt-region-cal').onchange=mt$('mt-ceco-cal').onchange=mtActualizar;mt$('mt-todo-mes').onclick=()=>{mtDia='';mtCalendario();};
}
if(!mtEsCalendario){
 mt$('mt-alternar-grupos').onclick=()=>{
  const expandir=mtNodosResumen.some(n=>n.tipo==='region'?mtRegionesContraidas.has(n.clave):!mtUnidadesExpandidas.has(n.clave));
  mtRegionesContraidas.clear();mtUnidadesExpandidas.clear();
  for(const n of mtNodosResumen){if(expandir && n.tipo==='unidad')mtUnidadesExpandidas.add(n.clave);if(!expandir && n.tipo==='region')mtRegionesContraidas.add(n.clave);}
  mtEstadoGruposResumen();
 };
 mt$('mt-alternar-lineas').onclick=()=>{
  const unidades=mtNodosResumen.filter(n=>n.tipo==='unidad');
  const expandir=unidades.some(n=>!mtUnidadesExpandidas.has(n.clave));
  for(const n of unidades){if(expandir){mtUnidadesExpandidas.add(n.clave);mtRegionesContraidas.delete(n.region);}else mtUnidadesExpandidas.delete(n.clave);}
  mtEstadoGruposResumen();
 };
 mt$('mt-region-resumen').onchange=()=>{mt$('mt-ceco-resumen').value='';mtActualizar();};mt$('mt-ceco-resumen').onchange=mtActualizar;mt$('mt-mes-resumen').onchange=consultarMt;
}
function cambiarMesMt(delta){const mes=mt$('mt-mes').value;if(!mesValidoMt(mes))return;const [y,m]=mes.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));mt$('mt-mes').value=d.toISOString().slice(0,7);mtDia='';mtCalendario();}
if(mtEsCalendario){mt$('mt-mes-anterior').onclick=()=>cambiarMesMt(-1);mt$('mt-mes-siguiente').onclick=()=>cambiarMesMt(1);}
async function consultarMt(event){event?.preventDefault();const consulta=++mtConsulta;mtDatos=null;mtIncluidos=[];mtMes=[];mtDia='';mt$('mt-consultar').disabled=true;for(const id of ['mt-exportar-resumen','mt-exportar-calendario','mt-exportar-informe'])if(mt$(id))mt$(id).disabled=true;for(const id of ['mt-detalle','mt-totales','mt-kpis','mt-patentes','mt-cal-grid','mt-agenda'])mt$(id)?.replaceChildren();for(const id of ['mt-alcance','mt-cal-nota','mt-dia-titulo','mt-informe-nota'])if(mt$(id))mt$(id).textContent='';mtConfiguracion();mt$('mt-mensaje').textContent='Consultando estados de mantención y fechas proyectadas…';
 try{const periodo=mtEsCalendario?{inicio:mt$('mt-inicio').value,fecha:mt$('mt-fecha').value}:periodoMesMt(mt$('mt-mes-resumen').value);const q=new URLSearchParams(periodo),r=await PortalDatos.consultar('/api/mantenciones?'+q,{cache:'no-store'});if(r.status===404)throw new Error('Reinicia Iniciar_Panel.bat para habilitar las nuevas vistas.');const datos=await r.json();if(consulta!==mtConsulta)return;if(!r.ok)throw new Error(datos.error||'No se pudo consultar la BD.');if(datos.version!==2||!datos.incluye_estado_equipo)throw new Error('El servidor usa una versión anterior. Reinicia Iniciar_Panel.bat.');mtDatos=datos;PortalConfig.registrarCecos?.(datos);mtConfiguracion();mtActualizar();if(!mtEsCalendario)mt$('mt-exportar-resumen').disabled=false;mt$('mt-mensaje').textContent='Consulta completada. '+(PortalDatos.consulta?'':datos.advertencias.map(a => PortalConfig.textoUnidad?.(a) ?? a).join(' '));
 }catch(error){if(consulta===mtConsulta)mt$('mt-mensaje').textContent=error.message;}finally{if(consulta===mtConsulta)mt$('mt-consultar').disabled=false;}}
const hoyMt=PortalDatos.fechaActual(),fechaHoyMt=`${hoyMt.getFullYear()}-${String(hoyMt.getMonth()+1).padStart(2,'0')}-${String(hoyMt.getDate()).padStart(2,'0')}`;if(mtEsCalendario){mt$('mt-fecha').value=fechaHoyMt;mt$('mt-mes').value=fechaHoyMt.slice(0,7);}else mt$('mt-mes-resumen').value=fechaHoyMt.slice(0,7);mt$('mt-form').onsubmit=consultarMt;consultarMt();
}

