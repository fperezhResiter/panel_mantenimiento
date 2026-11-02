const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('es-CL'), fechaCorta=s=>s.split('-').reverse().join('-');
let reporteEfectivo=document.body?.dataset?.reportabilidad==='efectiva'||Boolean(window.location&&new URLSearchParams(window.location.search).get('reportabilidad')==='efectiva');
const criteriosEfectiva=[
 {id:'criterio-mayor-cero',valor:1,texto:'lectura actual mayor que cero'},
 {id:'criterio-mayor-anterior',valor:2,texto:'mayor o igual que la lectura anterior'},
 {id:'criterio-maximo-doble',valor:4,texto:'menor o igual al doble de la anterior'}
];
let etiquetaPatentes=reporteEfectivo?'Patentes efectivas':'Patentes reportadas';
let reporte=null, visibles=[], plegadas=new Set();
let serieFija=null,serieHover=null,elementosSeries=[],marcaHover=null,guiasGraficos=[],rangoHover=null,rangoFoco=null,elementosRangos=[],vistaSemanalActual=null;
let vistaComparativaActual=null;
function actualizarModoReporte(){
 const boton=$('reporte-modo');if(!document.body?.dataset||!boton)return;
 const modo=reporteEfectivo?'efectiva':'total';
 document.body.dataset.reportabilidad=modo;
 etiquetaPatentes=reporteEfectivo?'Patentes efectivas':'Patentes reportadas';
 document.title=(reporteEfectivo?'Reportabilidad efectiva':'Reportabilidad')+' — Resiter Minería';
 document.querySelector('header h1').textContent=reporteEfectivo?'Panel de reportabilidad efectiva':'Panel de reportabilidad';
 $('reporte-titulo').textContent=reporteEfectivo?'Reportabilidad efectiva de patentes':'Reportabilidad total de patentes';
 $('reporte-badge').textContent=reporteEfectivo?'Patentes efectivas por Unidad':'Patentes distintas por Unidad';
 $('reportadas-etiqueta').textContent=etiquetaPatentes;
 $('porcentaje-etiqueta').textContent=reporteEfectivo?'Efectivas / base vigente':'Reportadas / base vigente';
 $('reporte-tabla-caption').textContent=`Patentes distintas ${reporteEfectivo?'efectivas':'reportadas'} frente a la base vigente de cada martes por Unidad.`;
 $('reporte-tabla-nota').textContent='Cada patente cuenta una vez por semana y se atribuye a la región, Unidad y línea de su período vigente al martes, aunque Sheet1 declare otro CeCo. Inicio y fin se incluyen. Cada porcentaje histórico usa su propia base semanal; sin base se muestra —. Los reportes sin asignación vigente única se conservan aparte.';
 document.querySelectorAll('[data-modo-reporte]').forEach(el=>el.hidden=el.dataset.modoReporte!==modo);
 document.querySelectorAll('[data-vista-total]').forEach(el=>{
  el.dataset.vista=el.dataset[reporteEfectivo?'vistaEfectiva':'vistaTotal'];
  const descripcion=el.dataset[reporteEfectivo?'pdfDescripcionEfectiva':'pdfDescripcionTotal'];
  if(descripcion)el.dataset.pdfDescripcion=descripcion;
 });
 for(const id of ['reporte-semanal','reporte-comparativo'])$(id).replaceChildren();
 boton.textContent=reporteEfectivo?'Mostrar reportabilidad total':'Mostrar reportabilidad efectiva';
 boton.setAttribute('aria-pressed',String(reporteEfectivo));
 PortalConfig.aplicarVistas?.();
 try{const url=new URL(window.location.href);if(reporteEfectivo)url.searchParams.set('reportabilidad','efectiva');else url.searchParams.delete('reportabilidad');window.history.replaceState(null,'',url);}catch{}
}
const rangosReporte={rojo:'Rojo: menos de 75 %',amarillo:'Amarillo: desde 75 % y menos de 90 %',verde:'Verde: 90 % o más',neutro:'Sin base: total de patentes igual a 0'};
const rangoValor=valor=>!Number.isFinite(valor)?'neutro':valor>=90?'verde':valor>=75?'amarillo':'rojo';
const colorCumplimiento=valor=>({rojo:'#bc3e3e',amarillo:'#b78912',verde:'#21854b',neutro:'#7b8794'})[rangoValor(valor)];
const coloresReporte=['#0e81c5','#b64b23','#21854b','#854fc2','#a82f6b','#557022','#176b75','#965a12','#4056a1','#9b4d74','#457d69','#755c36'],coloresSeries=new Map();
function colorSerie(nombre){if(!coloresSeries.has(nombre))coloresSeries.set(nombre,coloresReporte[coloresSeries.size%coloresReporte.length]);const color=coloresSeries.get(nombre);return window.PanelTema?.colorGrafico(color)||color;}
const nodoGrafico=(tag,atributos={},texto='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(atributos).forEach(([k,v])=>e.setAttribute(k,v));if(texto)e.textContent=tag==='title'?texto.replaceAll(' · ','\n'):texto;return e;};
let lineasPlegadas=new Set();
const claveUnidad=(region,ceco)=>JSON.stringify([region,ceco]);
function seriesGraficos(){
 const zona=Boolean(window.PortalZona?.activa());
 const region=PortalFiltros.unico('region'),unidad=PortalFiltros.unico('buscar');
 const grupos=visibles;
 const porUnidad=PortalFiltros.hay('region')||PortalFiltros.hay('buscar');
 const porLinea=zona&&Boolean(unidad)&&grupos.length===1;
 const series=porLinea?grupos.flatMap(r=>r.cecos.filter(c=>c.ceco===unidad).flatMap(c=>(c.lineas||[]).map(l=>({nombre:l.linea,cecos:[l]})))):porUnidad?grupos.flatMap(r=>r.cecos.map(c=>({nombre:c.ceco,cecos:[c]}))):grupos.map(r=>({nombre:r.region,cecos:r.cecos}));
 return {series,nivel:porLinea?'linea':porUnidad?'unidad':'region',titulo:porLinea?'línea de negocio · '+unidad:porUnidad?'Unidad'+(region?' · '+region:''):zona?'zona':'región'};
}
function elegirSerie(nombre){
 const {nivel}=seriesGraficos();
 if(nivel==='region'){PortalFiltros.asignar('region',nombre);PortalFiltros.asignar('buscar');plegadas.delete(nombre);}
 else if(nivel==='unidad'&&!PortalFiltros.unico('buscar')){PortalFiltros.asignar('buscar',nombre);}
 else {serieFija=serieFija===nombre?null:nombre;destacarSeries();return;}
 serieFija=null;serieHover=null;render();
}
function destacarSeries(){
 const activa=serieHover??serieFija,rango=serieHover?null:rangoHover??rangoFoco;
 const entidadesEnRango=new Set(rango?elementosSeries.filter(e=>e.rangos?.includes(rango)).map(e=>e.nombre):[]);
 for(const {elemento,nombre,semana,tipo,rangos,segmento,grafico} of elementosSeries){
  const coincide=rango?(rangos?rangos.includes(rango):entidadesEnRango.has(nombre)):(!activa||nombre===activa)&&(!marcaHover||semana==null||semana===marcaHover.semana)&&(!marcaHover?.segmento||!segmento||segmento===marcaHover.segmento);
  elemento.style.opacity=coincide?'1':'0.15';elemento.setAttribute('aria-pressed',String(nombre===serieFija));
  if(tipo==='barra'||tipo==='punto'){elemento.setAttribute('stroke-width',(marcaHover||rango)&&coincide?3:0);elemento.setAttribute('stroke','var(--tinta)');}
 }
 for(const {elemento,clase} of elementosRangos){elemento.setAttribute('data-activo',String(clase===rango));elemento.style.opacity=rango&&clase!==rango?'0.35':'1';}
 for(const {id,guia} of guiasGraficos){
  const punto=!rango&&marcaHover&&(elementosSeries.find(e=>e.grafico===id&&e.nombre===marcaHover.nombre&&e.semana===marcaHover.semana&&(!marcaHover.segmento||e.segmento===marcaHover.segmento))||elementosSeries.find(e=>e.grafico===id&&e.nombre===marcaHover.nombre&&e.semana===marcaHover.semana));
  guia.style.display=punto?'':'none';
  if(punto){guia.setAttribute('x1',punto.x);guia.setAttribute('x2',punto.x);}
  const cantidad=rango?elementosSeries.filter(e=>e.grafico===id&&(e.tipo==='barra'||e.tipo==='punto')&&e.rangos.includes(rango)).length:0;
  $(id+'-detalle').textContent=rango?`${rangosReporte[rango]} · ${cantidad} ${id==='reporte-grafico'?'puntos':'barras'} en este rango.`:punto?punto.detalle:reporteEfectivo?'Pasa el mouse o enfoca un tramo para ver efectivas, no efectivas y reportadas totales.':`Pasa el mouse o enfoca una marca para ver su entidad, semana y ${etiquetaPatentes.toLowerCase()} / total.`;
 }
}
function posicionarTooltip(elemento,event){
 const tooltip=$('reporte-tooltip'),rect=elemento.getBoundingClientRect?.()||{left:0,top:0,bottom:0};
 const x=event?.clientX??rect.left,y=event?.clientY??rect.bottom,ancho=tooltip.offsetWidth||320,alto=tooltip.offsetHeight||110;
 tooltip.style.left=Math.max(8,Math.min(x+14,(window.innerWidth||1000)-ancho-8))+'px';
 tooltip.style.top=Math.max(8,y+alto+20>(window.innerHeight||800)?y-alto-12:y+14)+'px';
}
function ocultarTooltip(){$('reporte-tooltip').hidden=true;}
function formatearTooltipReporte(detalle){
 const partes=detalle.split(' · ');
 return [partes.slice(0,3).join(' · '),...partes.slice(3)].join('\n');
}
function conectarSerie(elemento,nombre,marca={}){
 if(Object.hasOwn(marca,'valor'))marca.rangos=[rangoValor(marca.valor)];
 elementosSeries.push({elemento,nombre,...marca});elemento.style.cursor='pointer';elemento.setAttribute('tabindex','0');elemento.setAttribute('role','button');const nivel=seriesGraficos().nivel;const accion=nivel==='region'?'Filtrar por ':nivel==='unidad'&&!PortalFiltros.unico('buscar')?'Filtrar por unidad ':'Destacar ';elemento.setAttribute('aria-label',(marca.detalle?marca.detalle+'. ':'')+accion+nombre);
 elemento.onmouseenter=elemento.onfocus=event=>{serieHover=nombre;marcaHover=marca.semana==null?null:{nombre,semana:marca.semana,segmento:marca.segmento,grafico:marca.grafico};rangoHover=null;destacarSeries();if(marca.detalle){const tooltip=$('reporte-tooltip');tooltip.setAttribute('data-rango',rangoValor(marca.valor));tooltip.textContent=formatearTooltipReporte(marca.detalle);tooltip.hidden=false;posicionarTooltip(elemento,event);}};
 elemento.onmousemove=event=>{if(marca.detalle)posicionarTooltip(elemento,event);};
 elemento.onmouseleave=elemento.onblur=()=>{serieHover=null;marcaHover=null;ocultarTooltip();destacarSeries();};
 elemento.onclick=()=>elegirSerie(nombre);
 elemento.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();elemento.onclick();}if(e.key==='Escape'){serieFija=null;serieHover=null;marcaHover=null;rangoHover=null;rangoFoco=null;ocultarTooltip();destacarSeries();}};
}
function conectarRango(elemento,clase){
 elementosRangos.push({elemento,clase});elemento.setAttribute('tabindex','0');elemento.setAttribute('aria-label',rangosReporte[clase]+'. Destacar barras y puntos de este rango.');
 elemento.onmouseenter=()=>{rangoHover=clase;serieHover=null;marcaHover=null;ocultarTooltip();destacarSeries();};
 elemento.onmouseleave=()=>{rangoHover=null;destacarSeries();};
 elemento.onfocus=()=>{rangoFoco=clase;serieHover=null;marcaHover=null;ocultarTooltip();destacarSeries();};
 elemento.onblur=()=>{rangoFoco=null;destacarSeries();};
 elemento.onkeydown=e=>{if(e.key==='Escape'){rangoHover=null;rangoFoco=null;destacarSeries();}};
}
function bandasCumplimiento(svg,y,izquierda,derecha,techo){
 for(const [clase,min,max] of [['rojo',0,75],['amarillo',75,90],['verde',90,techo]]){const franja=nodoGrafico('rect',{x:izquierda,y:y(max),width:derecha-izquierda,height:y(min)-y(max),class:'reporte-rango reporte-rango-'+clase,'data-rango':clase,role:'img'});conectarRango(franja,clase);svg.append(franja);}
 for(const [valor,clase] of [[75,'rojo'],[90,'verde']])svg.append(nodoGrafico('line',{x1:izquierda,y1:y(valor),x2:derecha,y2:y(valor),class:'reporte-umbral reporte-umbral-'+clase,'stroke-dasharray':'6 4','pointer-events':'none'}));
}
function registrarGuia(id,svg,arriba,abajo){const guia=nodoGrafico('line',{y1:arriba,y2:abajo,class:'reporte-guia','stroke-dasharray':'3 3','pointer-events':'none'});guia.style.display='none';svg.append(guia);guiasGraficos.push({id,guia});}
function detalleCumplimiento(nombre,semana,valor,reportadas,total){return `${nombre} · S${semana.numero} · ${fechaCorta(semana.fecha)} · Cumplimiento: ${formatoIndice(valor)} · Rango: ${valor===null?'Sin base':valor>=90?'Verde':valor>=75?'Amarillo':'Rojo'} · ${etiquetaPatentes}: ${fmt(reportadas)} · Base vigente: ${fmt(total)}`;}
function detalleComparativo(nombre,semana,efectivas,reportadas,total,segmento,estilo='barra'){const parte=segmento==='no-efectiva'?(estilo==='linea'?'Línea discontinua: reportadas no efectivas':'Tramo achurado: reportadas no efectivas'):segmento==='efectiva'?(estilo==='linea'?'Línea continua: efectivas':'Tramo sólido: efectivas'):'Reportabilidad total';return `${nombre} · S${semana.numero} · ${fechaCorta(semana.fecha)} · ${parte} · Patentes efectivas: ${fmt(efectivas)} (${porcentaje(efectivas,total)}) · Reportadas no efectivas: ${fmt(reportadas-efectivas)} (${porcentaje(reportadas-efectivas,total)}) · Reportadas totales: ${fmt(reportadas)} (${porcentaje(reportadas,total)}) · Base vigente: ${fmt(total)}`;}
function datosSerieSemanal(serie){const total=serie.cecos.reduce((s,c)=>s+c.total,0),totales=reporte.semanas_completas.map((_,i)=>serie.cecos.reduce((s,c)=>s+(c.historico_completo_base?.[i]??c.total),0)),reportadas=reporte.semanas_completas.map((_,i)=>serie.cecos.reduce((s,c)=>s+c.historico_completo[i],0)),reportadasTotales=reporteEfectivo?reporte.semanas_completas.map((_,i)=>serie.cecos.reduce((s,c)=>s+c.historico_completo_reportadas[i],0)):reportadas;return {...serie,total,totales,reportadas,reportadasTotales,valores:reportadas.map((n,i)=>totales[i]?100*n/totales[i]:null),valoresTotales:reportadasTotales.map((n,i)=>totales[i]?100*n/totales[i]:null)};}
function patronesAchurados(svg,prefijo,series=null){
 const defs=nodoGrafico('defs');
 const colores=series?series.map((s,i)=>['serie-'+i,colorSerie(s.nombre)]):[['rojo',0],['amarillo',75],['verde',90],['neutro',null]].map(([clase,valor])=>[clase,colorCumplimiento(valor)]);
 for(const [clase,color] of colores){const patron=nodoGrafico('pattern',{id:prefijo+'-'+clase,patternUnits:'userSpaceOnUse',width:7,height:7});patron.append(nodoGrafico('rect',{width:7,height:7,fill:color,'fill-opacity':.12}),nodoGrafico('path',{d:'M-2 2 L2 -2 M0 7 L7 0 M5 9 L9 5',fill:'none',stroke:color,'stroke-width':1.8}));defs.append(patron);}svg.append(defs);
}
function barraApilada(svg,{nombre,semana,efectivas,reportadas,total,x,ancho,y,grafico,patron,indice,color=null,clavePatron=null}){
 const valor=total?100*efectivas/total:null,valorTotal=total?100*reportadas/total:null,marca={semana:semana.numero,detalle:detalleComparativo(nombre,semana,efectivas,reportadas,total),grafico,x,tipo:'barra',valor};
 const grupo=nodoGrafico('g',{transform:`translate(${x} 0)`,'data-pdf-barra':'apilada','data-entidad':nombre,'data-semana':semana.numero,'data-valor':valorTotal===null?'':valorTotal,'data-valor-efectivo':valor===null?'':valor,'data-rango-efectivo':rangoValor(valor),'data-pdf-y':y(valorTotal||0),'data-reportadas':reportadas,'data-efectivas':efectivas});
 const solida=nodoGrafico('rect',{x:-ancho/2,y:valor?y(valor):y(0)-(valorTotal?0:3),width:ancho,height:valor?y(0)-y(valor):valorTotal?0:3,fill:color||colorCumplimiento(valor),'data-entidad':nombre,'data-semana':semana.numero,'data-segmento':'efectiva','data-valor':valor===null?'':valor});
 conectarSerie(solida,nombre,{...marca,segmento:'efectiva',detalle:detalleComparativo(nombre,semana,efectivas,reportadas,total,'efectiva')});grupo.append(solida);
 const diferencia=reportadas-efectivas;
 if(diferencia>0){const achurada=nodoGrafico('rect',{x:-ancho/2,y:valorTotal===null?y(0)-3:y(valorTotal),width:ancho,height:valorTotal===null?3:y(valor)-y(valorTotal),fill:`url(#${patron}-${clavePatron||rangoValor(valor)})`,'data-entidad':nombre,'data-semana':semana.numero,'data-segmento':'no-efectiva','data-valor':total?100*diferencia/total:''});conectarSerie(achurada,nombre,{...marca,segmento:'no-efectiva',detalle:detalleComparativo(nombre,semana,efectivas,reportadas,total,'no-efectiva')});grupo.append(achurada);}
 if(indice)grupo.append(nodoGrafico('text',{x:0,y:y(0)+14,'text-anchor':'middle','font-size':10,'data-indice-entidad':indice},String(indice)));
 svg.append(grupo);return marca;
}
function lineasAbiertas(){const unidades=visibles.flatMap(r=>r.cecos.filter(c=>c.lineas?.length).map(c=>claveUnidad(r.region,c.ceco)));return unidades.length>0&&unidades.every(clave=>!lineasPlegadas.has(clave));}
function elegirTabla(region,ceco=null){const conjunto=ceco===null?plegadas:lineasPlegadas,clave=ceco===null?region:claveUnidad(region,ceco);conjunto.has(clave)?conjunto.delete(clave):conjunto.add(clave);render();}
function sumarStatus(filas){
 const suma={};
 for(const campo of ['reportadas','reportadas_totales','total','fuera_maestro'])if(filas.some(f=>campo in f))suma[campo]=filas.reduce((n,f)=>n+(f[campo]||0),0);
 for(const campo of ['historico','historico_completo','historico_reportadas','historico_completo_reportadas','historico_base','historico_completo_base'])if(filas.some(f=>Array.isArray(f[campo])))suma[campo]=Array.from({length:Math.max(...filas.map(f=>f[campo]?.length||0))},(_,i)=>filas.reduce((n,f)=>n+(f[campo]?.[i]||0),0));
 suma.porcentaje=suma.total?100*suma.reportadas/suma.total:null;
 return suma;
}
function criteriosSeleccionados(){return criteriosEfectiva.filter(c=>$(c.id)?.checked??true);}
function mascaraCriterios(){return criteriosSeleccionados().reduce((m,c)=>m|c.valor,0);}
function textoCriterios(){const elegidos=criteriosSeleccionados();return elegidos.length?elegidos.map(c=>c.texto).join('; '):'Ninguno: todas las patentes reportadas se consideran efectivas';}
function actualizarCriterios(){
 if(!reporteEfectivo||!$('criterios-efectiva-resumen'))return;
 const disponible=reporte?.version_criterios_efectiva===1;
 criteriosEfectiva.forEach(c=>{const input=$(c.id);if(input){input.disabled=!disponible;if(!disponible)input.checked=true;}});
 $('criterios-efectiva-resumen').textContent='Criterios aplicados: '+textoCriterios()+'.';
 $('criterios-efectiva-ayuda').textContent=disponible?'Los cambios se aplican a todas las semanas, tarjetas, gráficos, tablas y descargas. Sin criterios seleccionados, todas las patentes reportadas se consideran efectivas.':'Actualiza la publicación para poder elegir los criterios. Se muestran los resultados con los tres criterios originales.';
 const mascara=mascaraCriterios(),validar=n=>(!(mascara&1)||n>0)&&(!(mascara&2)||n>=1000)&&(!(mascara&4)||n<=2000);
 $('ejemplo-efectiva').textContent='Ejemplo: con una lectura anterior de 1.000, '+[1100,1000,0,2100].map(n=>`una actual de ${fmt(n)} ${validar(n)?'es efectiva':'no es efectiva'}`).join('; ')+'.';
}
function aplicarCriterios(unidad){
 if(!reporteEfectivo||reporte?.version_criterios_efectiva!==1)return unidad;
 const variante=unidad.por_criterios?.[mascaraCriterios()];
 if(!variante)throw new Error('Actualiza la publicación para aplicar los criterios de reportabilidad efectiva.');
 const {por_status:estados,...cantidades}=variante;
 const datos={...unidad,...cantidades};datos.porcentaje=datos.total?100*datos.reportadas/datos.total:null;
 datos.por_status=(unidad.por_status||[]).map(s=>{const actual={...s,...estados.find(e=>e.status===s.status)};actual.porcentaje=actual.total?100*actual.reportadas/actual.total:null;return actual;});
 if(unidad.lineas)datos.lineas=unidad.lineas.map(aplicarCriterios);
 return datos;
}
function filtrarStatus(unidad,elegidos){
 if(!elegidos.length)return unidad;
 const filas=(unidad.por_status||[]).filter(s=>elegidos.includes(s.status));
 if(!filas.length)return null;
 return {...unidad,...sumarStatus(filas),...(unidad.lineas?{lineas:unidad.lineas.map(l=>filtrarStatus(l,elegidos)).filter(Boolean)}:{})};
}
function seleccionados(regiones){
 const elegidos=$('status-equipo')&&reporte?.status_equipo_disponibles?PortalFiltros.valores('status-equipo'):[];
 return regiones.filter(r=>PortalConfig.incluida(r.region)).map(r=>{
  const cecos=r.cecos.filter(c=>PortalConfig.cecoIncluido(c.ceco)).map(c=>filtrarStatus(aplicarCriterios(c),elegidos)).filter(Boolean);
  return {...r,cecos,...(elegidos.length||reporteEfectivo?sumarStatus(cecos):{})};
 }).filter(r=>r.cecos.length);
}
function actualizarStatus(){
 const selector=$('status-equipo');if(!selector)return;
 const estados=reporte?.status_equipo_disponibles;
 if(!Array.isArray(estados)){selector.disabled=true;selector.title='Actualiza la publicación para filtrar por status del equipo.';return;}
 selector.disabled=false;selector.title='Status actual de BD ACTIVOS MOVILES; se aplica a reportadas y a la base vigente semanal.';
 PortalFiltros.opciones(selector,estados.map(s=>[s,s==='SIN STATUS'?'Sin status':s]),'Todos los status');
}
function actualizarRegiones(){if(!reporte)return;PortalFiltros.opciones('region',seleccionados(reporte.regiones).map(r=>r.region),'Todas las regiones incluidas');}
function actualizarCecos(regiones){
 const cecos=[...new Set(regiones.filter(r=>PortalFiltros.coincide('region',r.region)).flatMap(r=>r.cecos.map(c=>c.ceco)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 PortalFiltros.opciones('buscar',cecos.map(c=>[c,PortalConfig.nombreCeco?.(c) ?? c]),'Todas las unidades');
}
function mostrarConfiguracion(){if(reporte)PortalConfig.registrar(reporte.regiones.map(r=>r.region),reporte.regiones.flatMap(r=>r.cecos.map(c=>c.ceco)));}
window.addEventListener('portal-config',()=>{actualizarRegiones();render();});
const hoy=PortalDatos.fechaActual();hoy.setDate(hoy.getDate()+1-(hoy.getDay()+6)%7);
$('fecha').min='2026-08-04';$('fecha').step='7';
$('fecha').value=[`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`,'2026-08-04'].sort().at(-1);
function celda(fila,texto,tipo='td'){const c=document.createElement(tipo);c.textContent=texto;fila.append(c);return c;}
const porcentaje=(reportadas,total)=>total?(100*reportadas/total).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
function validarReporte(datos){
 if(reporteEfectivo&&!datos?.reportabilidad_efectiva)throw new Error('Actualiza la publicación para consultar Reportabilidad efectiva.');
 const cantidad=n=>Number.isInteger(n)&&n>=0;
 const valido=datos&&[2,3].includes(datos.version_reporte)&&Array.isArray(datos.semanas)&&datos.semanas.length>0&&datos.semanas.length<=4&&cantidad(datos.reportadas)&&cantidad(datos.total)&&Array.isArray(datos.regiones)&&datos.regiones.every(r=>Array.isArray(r.cecos)&&r.cecos.every(c=>cantidad(c.reportadas)&&cantidad(c.total)&&cantidad(c.fuera_maestro)&&Array.isArray(c.historico)&&c.historico.length===datos.semanas.length&&c.historico.every(cantidad)));
 const completo=valido&&Array.isArray(datos.semanas_completas)&&datos.semanas_completas.length===datos.semana&&datos.regiones.every(r=>r.cecos.every(c=>Array.isArray(c.historico_completo)&&c.historico_completo.length===datos.semanas_completas.length&&c.historico_completo.every(cantidad)));
 if(!completo)throw new Error('El servidor está usando una versión anterior o incompatible del reporte. Detén la ventana del servidor con Ctrl+C, vuelve a ejecutar Iniciar_Panel.bat y recarga esta página con Ctrl+F5.');
 if(datos.version_reporte===3&&!datos.regiones.every(r=>r.cecos.every(c=>Array.isArray(c.historico_base)&&c.historico_base.length===datos.semanas.length&&Array.isArray(c.historico_completo_base)&&c.historico_completo_base.length===datos.semanas_completas.length&&c.historico_completo_base.every((n,i)=>cantidad(n)&&c.historico_completo[i]<=n))))throw new Error('La publicación no contiene una base vigente válida para cada semana. Actualiza la BD.');
 if(reporteEfectivo&&!datos.regiones.every(r=>r.cecos.every(c=>cantidad(c.reportadas_totales)&&c.reportadas_totales>=c.reportadas&&Array.isArray(c.historico_completo_reportadas)&&c.historico_completo_reportadas.length===datos.semanas_completas.length&&c.historico_completo_reportadas.every((n,i)=>cantidad(n)&&n>=c.historico_completo[i]))))throw new Error('Actualiza la publicación para incluir la comparación de reportadas efectivas y no efectivas. Si usas el modo interactivo, reinicia Iniciar_Panel.bat.');
}
function estadoSemaforo(reportadas,total){return !total?{clase:'neutro',nombre:'Sin base'}:reportadas/total>=.9?{clase:'verde',nombre:'Verde'}:reportadas/total>=.75?{clase:'amarillo',nombre:'Amarillo'}:{clase:'rojo',nombre:'Rojo'};}
function pintarPorcentaje(elemento,reportadas,total){
 const estado=estadoSemaforo(reportadas,total);
 if(elemento===$('porcentaje')||elemento===$('porcentaje-reportadas')){
  const indicador=document.createElement('span');
  indicador.className='semaforo '+estado.clase;
  indicador.textContent=porcentaje(reportadas,total);
  elemento.replaceChildren(indicador);
  elemento.parentElement?.setAttribute('data-kpi-color',estado.clase);
  return;
 }
 const indicador=document.createElement('span');indicador.className='semaforo '+estado.clase;indicador.textContent=porcentaje(reportadas,total)+' · '+estado.nombre;elemento.replaceChildren(indicador);
}
function serieCumplimiento(cecos,completa=false){return (completa?reporte.semanas_completas:reporte.semanas).map((_,i)=>{const total=cecos.reduce((s,c)=>s+((completa?c.historico_completo_base:c.historico_base)?.[i]??c.total),0);return total?100*cecos.reduce((s,c)=>s+(completa?c.historico_completo:c.historico)[i],0)/total:null;});}
function promedioCumplimiento(valores){const validos=valores.filter(Number.isFinite);return validos.length?validos.reduce((a,b)=>a+b,0)/validos.length:null;}
const formatoIndice=n=>Number.isFinite(n)?n.toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
function metricas(fila,reportadas,total,cecos){celda(fila,fmt(reportadas));pintarPorcentaje(celda(fila,''),reportadas,total);celda(fila,fmt(total));const valores=serieCumplimiento(cecos);valores.slice(0,-1).forEach(v=>celda(fila,formatoIndice(v)));celda(fila,formatoIndice(promedioCumplimiento(valores)));}
function graficoCumplimiento(){
 elementosSeries=[];serieHover=null;marcaHover=null;guiasGraficos=[];rangoHover=null;rangoFoco=null;elementosRangos=[];ocultarTooltip();
 for(const leyenda of document.querySelectorAll?.('[data-reporte-rango]')||[])conectarRango(leyenda,leyenda.getAttribute('data-reporte-rango'));
 const contenedor=$('reporte-grafico');contenedor.replaceChildren();$('reporte-leyenda').replaceChildren();
 graficoBarrasCumplimiento();
 if(reporteEfectivo)graficoBarrasSemanales(true);else graficoBarrasSemanales();
 const semanas=reporte.semanas_completas;
 const vista=seriesGraficos(),series=vista.series.map(datosSerieSemanal);
 $('reporte-grafico-titulo').textContent=(reporteEfectivo?'Evolución semanal de reportabilidad efectiva por ':'Cumplimiento semanal por ')+vista.titulo;
 $('reporte-volver').hidden=!PortalFiltros.hay('region')&&!PortalFiltros.hay('buscar');
 if(!series.some(s=>s.valores.some(Number.isFinite))){contenedor.textContent='No hay datos con base de patentes para graficar estos filtros.';destacarSeries();return;}
 const nodo=nodoGrafico;
 const w=640,h=360,m={l:75,r:35,t:25,b:70},max=Math.max(100,...series.flatMap(s=>s.valores).filter(Number.isFinite)),techo=Math.ceil(max/25)*25;
 const x=i=>semanas.length===1?(w+m.l-m.r)/2:m.l+i*(w-m.l-m.r)/(semanas.length-1),y=v=>h-m.b-v*(h-m.t-m.b)/techo;
 const svg=nodo('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':$('reporte-grafico-titulo').textContent,'aria-description':'Evolución de todas las semanas disponibles hasta la seleccionada. Cada punto indica su porcentaje.'});
 bandasCumplimiento(svg,y,m.l,w-m.r,techo);
 for(let valor=0;valor<=techo;valor+=25){svg.append(nodo('line',{x1:m.l,y1:y(valor),x2:w-m.r,y2:y(valor),stroke:'#dce3eb'}),nodo('text',{x:m.l-10,y:y(valor)+4,'text-anchor':'end'},formatoIndice(valor)));}
 svg.append(nodo('text',{x:15,y:15},'% cumplimiento'));
 semanas.forEach((s,i)=>{if(i%Math.ceil(semanas.length/12)!==0&&i!==semanas.length-1)return;svg.append(nodo('text',{x:x(i),y:h-42,'text-anchor':'middle'},'S'+s.numero),nodo('text',{x:x(i),y:h-22,'text-anchor':'middle'},semanas.length>8?fechaCorta(s.fecha).slice(0,5):fechaCorta(s.fecha)));});
 series.forEach((s,i)=>{const color=colorSerie(s.nombre),guion=!reporteEfectivo&&i>=coloresReporte.length?'7 4':'',leyenda=document.createElement('span');leyenda.style.color=color;leyenda.textContent=(guion?'┄ ':'━ ')+s.nombre;leyenda.setAttribute('data-pdf-leyenda',s.nombre);conectarSerie(leyenda,s.nombre);$('reporte-leyenda').append(leyenda);
  let previo=null;
  s.valores.forEach((v,j)=>{if(!Number.isFinite(v)){previo=null;return;}const punto={x:x(j),y:y(v),valor:v};
   if(previo){const linea=nodo('line',{x1:previo.x,y1:previo.y,x2:punto.x,y2:punto.y,stroke:color,'stroke-width':4,'stroke-dasharray':guion,...(reporteEfectivo?{'data-tipo-linea':'efectiva'}:{})});conectarSerie(linea,s.nombre,{...(reporteEfectivo?{segmento:'efectiva',grafico:'reporte-grafico'}:{}),rangos:rangoValor(previo.valor)===rangoValor(v)?[rangoValor(v)]:[]});linea.setAttribute('tabindex','-1');svg.append(linea);}
   const circulo=nodo('circle',{cx:punto.x,cy:punto.y,r:6,fill:color,tabindex:0,'data-entidad':s.nombre,'data-semana':semanas[j].numero,'data-valor':v,...(reporteEfectivo?{'data-segmento':'efectiva'}:{})});
   const detalle=reporteEfectivo?detalleComparativo(s.nombre,semanas[j],s.reportadas[j],s.reportadasTotales[j],s.totales[j],'efectiva','linea'):detalleCumplimiento(s.nombre,semanas[j],v,s.reportadas[j],s.totales[j]);
   conectarSerie(circulo,s.nombre,{semana:semanas[j].numero,detalle,grafico:'reporte-grafico',x:punto.x,tipo:'punto',valor:v,...(reporteEfectivo?{segmento:'efectiva'}:{})});svg.append(circulo);previo=punto;
  });
 });registrarGuia('reporte-grafico',svg,m.t,h-m.b);contenedor.append(svg);if(serieFija&&!series.some(s=>s.nombre===serieFija))serieFija=null;destacarSeries();
}
function graficoBarrasCumplimiento(){
 const contenedor=$('reporte-barras');contenedor.replaceChildren();
 const vista=seriesGraficos();
 $('reporte-barras-titulo').textContent=`${reporteEfectivo?'Reportabilidad efectiva y no efectiva':'Cumplimiento'} por ${vista.titulo} · S${reporte.semana} · ${fechaCorta(reporte.fecha)}`;
 const cecos=vista.series.map(s=>{const total=s.cecos.reduce((n,c)=>n+c.total,0),reportadas=s.cecos.reduce((n,c)=>n+c.reportadas,0);return {ceco:s.nombre,region:PortalFiltros.texto('region')||s.nombre,reportadas,total,reportadasTotales:reporteEfectivo?s.cecos.reduce((n,c)=>n+c.reportadas_totales,0):reportadas,valor:total?100*reportadas/total:null};});
 if(!cecos.length){contenedor.textContent='No hay datos para estos filtros.';return;}
 const nodo=(tag,a={},texto='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));e.textContent=texto;return e;};
 const w=640,h=360,m={l:65,r:25,t:35,b:110},techo=Math.ceil(Math.max(100,...cecos.map(c=>c.total?100*c.reportadasTotales/c.total:0))/25)*25;
 const y=v=>h-m.b-v*(h-m.t-m.b)/techo,paso=(w-m.l-m.r)/cecos.length;
 const svg=nodo('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':$('reporte-barras-titulo').textContent});
 if(reporteEfectivo)patronesAchurados(svg,'reporte-barras-achurado');
 bandasCumplimiento(svg,y,m.l,w-m.r,techo);
 for(let v=0;v<=techo;v+=25){svg.append(nodo('line',{x1:m.l,y1:y(v),x2:w-m.r,y2:y(v),stroke:'#dce3eb'}),nodo('text',{x:m.l-8,y:y(v)+4,'text-anchor':'end'},formatoIndice(v)));}
 svg.append(nodo('text',{x:10,y:15},'% cumplimiento'));
 cecos.forEach((c,i)=>{const x=m.l+paso*(i+.5),color=c.valor===null?'#7b8794':c.valor>=90?'#21854b':c.valor>=75?'#b78912':'#bc3e3e';
  const semana={numero:reporte.semana,fecha:reporte.fecha},detalle=reporteEfectivo?detalleComparativo(c.ceco,semana,c.reportadas,c.reportadasTotales,c.total):detalleCumplimiento(c.ceco,semana,c.valor,c.reportadas,c.total),marca={semana:reporte.semana,detalle,grafico:'reporte-barras',x,tipo:'barra',valor:c.valor};
  if(reporteEfectivo)barraApilada(svg,{nombre:c.ceco,semana,efectivas:c.reportadas,reportadas:c.reportadasTotales,total:c.total,x,ancho:paso*.6,y,grafico:'reporte-barras',patron:'reporte-barras-achurado'});
  else{
  const barra=nodo('rect',{x:x-paso*.3,y:c.valor?y(c.valor):y(0)-3,width:paso*.6,height:c.valor?y(0)-y(c.valor):3,fill:color,tabindex:0,'data-entidad':c.ceco,'data-semana':reporte.semana,'data-valor':c.valor===null?'':c.valor});conectarSerie(barra,c.ceco,marca);svg.append(barra);
  }
  const rotulo=c.valor,tope=reporteEfectivo?(c.total?100*c.reportadasTotales/c.total:null):c.valor;
  const fuente=Math.max(5,Math.min(12,paso/4)),angulo=cecos.length>8?70:35;
  const valor=nodo('text',{x,y:tope===null?y(0)-10:y(tope)-8,'text-anchor':'middle','font-size':fuente,...(reporteEfectivo?{'data-porcentaje':rotulo===null?'':rotulo}:{})},rotulo===null?'Sin base':formatoIndice(rotulo));conectarSerie(valor,c.ceco,{...marca,tipo:'etiqueta'});valor.setAttribute('tabindex','-1');svg.append(valor);
  const etiqueta=nodo('text',{x,y:h-m.b+18,'font-size':fuente,transform:`rotate(${angulo} ${x} ${h-m.b+18})`},c.ceco.length>22?c.ceco.slice(0,21)+'…':c.ceco);etiqueta.append(nodo('title',{},`${c.region} · ${c.ceco}`));conectarSerie(etiqueta,c.ceco);svg.append(etiqueta);
 });registrarGuia('reporte-barras',svg,m.t,h-m.b);contenedor.append(svg);
}
function graficoBarrasSemanales(comparativo=false){
 const id=comparativo?'reporte-comparativo':'reporte-semanal';
 const contenedor=$(id),leyendas=$(id+'-leyenda'),desplazamiento=contenedor.scrollLeft||0;contenedor.replaceChildren();leyendas.replaceChildren();
 const vista=seriesGraficos(),semanas=reporte.semanas_completas,series=vista.series.map(datosSerieSemanal);
 const claveVista=JSON.stringify([reporte.fecha,vista.nivel,series.map(s=>s.nombre)]),esNueva=claveVista!==(comparativo?vistaComparativaActual:vistaSemanalActual);if(comparativo)vistaComparativaActual=claveVista;else vistaSemanalActual=claveVista;
 $(id+'-titulo').textContent=(comparativo?'Reportabilidad semanal: efectivas y no efectivas por ':'Cumplimiento semanal en barras por ')+vista.titulo;
 $(id+'-periodo').textContent=`Todas las semanas: S${semanas[0].numero} · ${fechaCorta(semanas[0].fecha)} a S${semanas.at(-1).numero} · ${fechaCorta(semanas.at(-1).fecha)}. Una barra por ${vista.nivel==='linea'?'línea de negocio':vista.nivel==='unidad'?'Unidad':window.PortalZona?.activa()?'zona':'región'} en cada semana.`;
 if(!series.length){contenedor.textContent='No hay datos para estos filtros.';return;}
 const espacio=28,barraAncho=24;
 const m={l:75,r:25,t:40,b:65},paso=Math.max(110,series.length*espacio+28),w=Math.max(1040,m.l+m.r+semanas.length*paso),h=390,ancho=(w-m.l-m.r)/semanas.length;
 const techo=Math.ceil(Math.max(100,...series.flatMap(s=>s.valoresTotales).filter(Number.isFinite))/25)*25,y=v=>h-m.b-v*(h-m.t-m.b)/techo;
 const svg=nodoGrafico('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':$(id+'-titulo').textContent,'data-pdf-titulo':comparativo?'Reportabilidad efectiva y no efectiva':'Cumplimiento semanal en barras','aria-description':'Todas las semanas disponibles, agrupadas por semana y entidad. Fondos rojo: menos de 75 %, amarillo: desde 75 % y menos de 90 %, verde: 90 % o más.','data-pdf-semanas':semanas.length,'data-pdf-paso':ancho,'data-pdf-margen':m.l});svg.style.minWidth=w+'px';
 if(comparativo)patronesAchurados(svg,'reporte-achurado',series);
 bandasCumplimiento(svg,y,m.l,w-m.r,techo);
 for(let v=0;v<=techo;v+=25)svg.append(nodoGrafico('line',{x1:m.l,y1:y(v),x2:w-m.r,y2:y(v),stroke:'#dce3eb'}),nodoGrafico('text',{x:m.l-10,y:y(v)+4,'text-anchor':'end'},formatoIndice(v)));
 svg.append(nodoGrafico('text',{x:10,y:15},'% cumplimiento'));
 const rotulosOcupados=[];
 semanas.forEach((semana,j)=>{
  const inicio=m.l+j*ancho;
  if(j)svg.append(nodoGrafico('line',{x1:inicio,y1:m.t,x2:inicio,y2:h-m.b,stroke:'#dce3eb','stroke-dasharray':'2 4'}));
  svg.append(nodoGrafico('text',{x:inicio+ancho/2,y:h-38,'text-anchor':'middle','font-weight':'bold'},'S'+semana.numero),nodoGrafico('text',{x:inicio+ancho/2,y:h-18,'text-anchor':'middle'},fechaCorta(semana.fecha)));
  series.forEach((s,i)=>{
   const valor=s.valores[j],valorTotal=s.valoresTotales[j],x=inicio+(ancho-series.length*espacio)/2+espacio*(i+.5),detalle=comparativo?detalleComparativo(s.nombre,semana,s.reportadas[j],s.reportadasTotales[j],s.totales[j]):detalleCumplimiento(s.nombre,semana,valor,s.reportadas[j],s.totales[j]),color=valor===null?'#7b8794':colorSerie(s.nombre),marca={semana:semana.numero,detalle,grafico:id,x,tipo:'barra',valor};
   if(comparativo){
    barraApilada(svg,{nombre:s.nombre,semana,efectivas:s.reportadas[j],reportadas:s.reportadasTotales[j],total:s.totales[j],x,ancho:barraAncho,y,grafico:id,patron:'reporte-achurado',indice:i+1,color:colorSerie(s.nombre),clavePatron:'serie-'+i});
   }else{
    const barra=nodoGrafico('rect',{x:x-barraAncho/2,y:valor?y(valor):y(0)-3,width:barraAncho,height:valor?y(0)-y(valor):3,rx:2,fill:color,'fill-opacity':valor===null ? .4 : 1,'data-entidad':s.nombre,'data-semana':semana.numero,'data-valor':valor===null?'':valor});
    conectarSerie(barra,s.nombre,marca);svg.append(barra);
   }
   const rotulo=valor,tope=comparativo?valorTotal:valor,texto=formatoIndice(rotulo),amplitud=texto.length*7,baseRotulo=y(tope||0)-9;
   let altoRotulo=baseRotulo;
   while(rotulosOcupados.some(o=>x-amplitud/2<o.derecha+3&&x+amplitud/2>o.izquierda-3&&Math.abs(altoRotulo-o.y)<14))altoRotulo-=14;
   rotulosOcupados.push({izquierda:x-amplitud/2,derecha:x+amplitud/2,y:altoRotulo});
   const porcentaje=nodoGrafico('text',{x,y:altoRotulo,'text-anchor':'middle',class:'reporte-porcentaje-barra','data-porcentaje':rotulo===null?'':rotulo,'font-size':11,'paint-order':'stroke fill','stroke-linejoin':'round'},texto);
   conectarSerie(porcentaje,s.nombre,{...marca,tipo:'etiqueta'});porcentaje.setAttribute('tabindex','-1');svg.append(porcentaje);
   if(altoRotulo!==baseRotulo){const guia=nodoGrafico('line',{x1:x,x2:x,y1:baseRotulo+4,y2:altoRotulo+3,stroke:'#7c8998','stroke-width':.7,'pointer-events':'none'});elementosSeries.push({elemento:guia,nombre:s.nombre,...marca,tipo:'guia',rangos:[rangoValor(valor)]});svg.append(guia);}
  });
 });
 series.forEach(s=>{const leyenda=document.createElement('span');leyenda.style.color=colorSerie(s.nombre);leyenda.textContent='■ '+s.nombre;leyenda.setAttribute('data-pdf-color',colorSerie(s.nombre));leyenda.setAttribute('data-pdf-leyenda',s.nombre);if(comparativo)leyenda.setAttribute('data-pdf-entidad',s.nombre);conectarSerie(leyenda,s.nombre);leyendas.append(leyenda);});
 registrarGuia(id,svg,m.t,h-m.b);contenedor.append(svg);
 const ajustar=()=>{if(contenedor.children[0]===svg)contenedor.scrollLeft=esNueva?contenedor.scrollWidth-contenedor.clientWidth:desplazamiento;};
 if(window.requestAnimationFrame)window.requestAnimationFrame(ajustar);else ajustar();
}
function render(){
 if(!reporte)return;
 const incluidas=seleccionados(reporte.regiones);
 actualizarCecos(incluidas);

 visibles=incluidas.filter(r=>PortalFiltros.coincide('region',r.region)).map(r=>({...r,cecos:r.cecos.filter(c=>PortalFiltros.coincide('buscar',c.ceco))})).filter(r=>r.cecos.length);
 if(window.PortalZona?.activa()&&$('zona-linea')?.multiple){
  const lineas=[...new Set(visibles.flatMap(r=>r.cecos.flatMap(c=>(c.lineas||[]).map(l=>l.linea))))].sort((a,b)=>a.localeCompare(b,'es'));
  PortalFiltros.opciones('zona-linea',lineas,'Todas las líneas');
  if(PortalFiltros.hay('zona-linea'))visibles=visibles.map(r=>{
   const cecos=r.cecos.flatMap(c=>{const lineas=(c.lineas||[]).filter(l=>PortalFiltros.coincide('zona-linea',l.linea));return lineas.length?[{...c,lineas,...PortalZona.sumar(lineas)}]:[];});
   return {...r,cecos,...PortalZona.sumar(cecos)};
  }).filter(r=>r.cecos.length);
 }
 $('resumen-config').textContent=`Configuración: ${incluidas.length} de ${reporte.regiones.length} regiones y ${incluidas.reduce((n,r)=>n+r.cecos.length,0)} de ${reporte.regiones.reduce((n,r)=>n+r.cecos.length,0)} unidades incluidas. Los filtros de región, Unidad, Línea de negocio y Status del equipo se aplican además de esta selección. Los avisos de calidad corresponden al archivo consultado completo.`;
 $('cabecera').replaceChildren();const head=document.createElement('tr');['Región / Unidad',reporteEfectivo?'Efectivas':'Reportadas','% semana seleccionada','Base vigente',...reporte.semanas.slice(0,-1).map(s=>`S${s.numero} · ${fechaCorta(s.fecha)} (%)`),`Promedio ${reporte.semanas.length} semanas`].forEach(t=>celda(head,t,'th'));$('cabecera').append(head);
 $('detalle').replaceChildren();let total=0,reportadas=0,cecos=0;
 for(const r of visibles){const sum=r.cecos.reduce((a,c)=>a+c.total,0), report=r.cecos.reduce((a,c)=>a+c.reportadas,0);total+=sum;reportadas+=report;cecos+=r.cecos.filter(c=>c.ceco!=='SIN CECO').length;
 const tr=document.createElement('tr');tr.className='region';const boton=document.createElement('button');boton.type='button';boton.textContent=(plegadas.has(r.region)?'▸ ':'▾ ')+r.region;boton.setAttribute('aria-label',(plegadas.has(r.region)?'Expandir ':'Contraer ')+r.region);boton.setAttribute('aria-expanded',String(!plegadas.has(r.region)));boton.onclick=()=>elegirTabla(r.region);celda(tr,'').append(boton);metricas(tr,report,sum,r.cecos);$('detalle').append(tr);
 if(!plegadas.has(r.region))for(const c of r.cecos){const fila=document.createElement('tr');fila.className='ceco';const nombre=celda(fila,'');const enlace=document.createElement(c.lineas?.length?'button':'span');if(c.lineas?.length)enlace.type='button';enlace.className='reporte-ceco-enlace';enlace.textContent=PortalConfig.nombreCeco?.(c.ceco) ?? c.ceco;if(c.lineas?.length){const abierta=!lineasPlegadas.has(claveUnidad(r.region,c.ceco));enlace.textContent=(abierta?'▾ ':'▸ ')+enlace.textContent;enlace.setAttribute('aria-expanded',String(abierta));enlace.onclick=()=>elegirTabla(r.region,c.ceco);}nombre.append(enlace);if(c.fuera_maestro){const nota=document.createElement('div');nota.className='nota-fuera-maestro';nota.textContent=`${fmt(c.fuera_maestro)} ${reporteEfectivo?'efectivas':'reportadas'} fuera del maestro de esta unidad`;nombre.append(nota);}metricas(fila,c.reportadas,c.total,[c]);$('detalle').append(fila);for(const l of lineasPlegadas.has(claveUnidad(r.region,c.ceco))?[]:c.lineas||[]){const f=document.createElement('tr');f.className='zona-linea';celda(f,'Línea: '+l.linea);metricas(f,l.reportadas,l.total,[l]);$('detalle').append(f);}}
 }
 if(!visibles.length){const tr=document.createElement('tr');celda(tr,'No hay centros de costo para estos filtros.').colSpan=4+reporte.semanas.length;$('detalle').append(tr);}
 $('pie').replaceChildren();const pie=document.createElement('tr');celda(pie,'Total general');metricas(pie,reportadas,total,visibles.flatMap(r=>r.cecos));$('pie').append(pie);graficoCumplimiento();
 $('total').textContent=fmt(total);$('reportadas').textContent=fmt(reportadas);pintarPorcentaje($('porcentaje'),reportadas,total);$('cecos').textContent=fmt(cecos);$('mostrar-regiones').hidden=!window.PortalZona?.activa();$('mostrar-regiones').textContent=lineasAbiertas()?'Contraer líneas':'Expandir líneas';$('expandir').textContent=visibles.length&&visibles.every(r=>plegadas.has(r.region))?'Expandir regiones':'Contraer regiones';
 if(reporteEfectivo){const enviadas=visibles.flatMap(r=>r.cecos).reduce((s,c)=>s+c.reportadas_totales,0),noEfectivas=enviadas-reportadas;$('reportadas-totales').textContent=fmt(enviadas);$('no-efectivas').textContent=fmt(noEfectivas);pintarPorcentaje($('porcentaje-reportadas'),enviadas,total);$('porcentaje-no-efectivas').textContent=porcentaje(noEfectivas,total);}
 renderIncidencias();
}
function incidenciasFiltradas(campo){
 return (reporte?.[campo]||[]).filter(i=>PortalConfig.incluida(i.region)&&PortalConfig.cecoIncluido(i.ceco)&&(!window.PortalZona?.activa()||PortalConfig.zonaIncluida(i.zona))&&PortalFiltros.coincide('region',window.PortalZona?.activa()?PortalConfig.agruparZona(i.zona):i.region)&&PortalFiltros.coincide('buscar',i.ceco)&&(!PortalFiltros.hay('status-equipo')||PortalFiltros.coincide('status-equipo',i.status))&&(!PortalFiltros.hay('zona-linea')||PortalFiltros.coincide('zona-linea',i.linea||'SIN LÍNEA')));
}
function renderIncidencias(){
 const bloque=$('fuera-vigencia');if(!bloque||!reporte?.base_semanal)return;
 const filas=incidenciasFiltradas('incidencias_vigencia'),pendientes=incidenciasFiltradas('pendientes_vigencia');
 bloque.hidden=!filas.length&&!pendientes.length;
 $('vigencia-resumen').textContent=`${fmt(new Set(filas.map(i=>i.patente)).size)} patentes reportadas fuera de base · ${fmt(new Set(pendientes.map(i=>i.patente)).size)} patentes con vigencia pendiente. No se suman al cumplimiento.`;
 $('vigencia-detalle').replaceChildren();
 for(const i of [...filas,...pendientes]){const tr=document.createElement('tr');[i.patente,i.region,i.ceco,filas.includes(i)?'Reporte fuera de base':'Vigencia pendiente',i.motivo].forEach(t=>celda(tr,t));$('vigencia-detalle').append(tr);}
}
if($('exportar-incidencias'))$('exportar-incidencias').onclick=()=>{
 if(PortalDatos.consulta||!reporte)return;
 const filas=[['Martes de referencia','Patente','Región de origen','Unidad de origen','Tipo','Motivo'],...['incidencias_vigencia','pendientes_vigencia'].flatMap(c=>incidenciasFiltradas(c).map(i=>[reporte.fecha,i.patente,i.region,i.ceco,c==='incidencias_vigencia'?'Reporte fuera de base':'Vigencia pendiente',i.motivo]))];
 descargarCSV(filas,`Fuera_de_vigencia_${reporte.fecha}.csv`);
};
function descargarCSV(filas,nombre){const csv=filas.map(row=>row.map(v=>'"'+String(typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=nombre;a.click();URL.revokeObjectURL(url);}
async function consultar(event){
 if($('reporte-modo'))$('reporte-modo').disabled=true;
 if($('limpiar-filtros'))$('limpiar-filtros').disabled=true;
 if($('descargar-pdf'))$('descargar-pdf').disabled=true;
 event?.preventDefault();$('consultar').disabled=true;$('exportar').disabled=true;$('resultados').hidden=true;$('avisos').hidden=true;$('estado').className='';$('estado').textContent=reporteEfectivo?'Consultando BD y calculando reportabilidad efectiva…':'Consultando BD y calculando reportabilidad…';reporte=null;vistaSemanalActual=null;vistaComparativaActual=null;ocultarTooltip();mostrarConfiguracion();
 try{

  const respuesta=await PortalDatos.consultar((reporteEfectivo?'/api/reporte-efectivo?fecha=':'/api/reporte?fecha=')+encodeURIComponent($('fecha').value),{cache:'no-store'});const datos=await respuesta.json();if(!respuesta.ok)throw new Error(datos.error||'No se pudo consultar la BD.');validarReporte(datos);reporte=datos;PortalConfig.registrarCecos?.(datos);plegadas.clear();lineasPlegadas=new Set(datos.regiones.flatMap(r=>r.cecos.map(c=>claveUnidad(r.region,c.ceco))));serieFija=null;
  actualizarCriterios();actualizarStatus();actualizarRegiones();mostrarConfiguracion();
  $('fecha').value=datos.fecha;
  $('periodo').textContent=`Semana ${datos.semana} · Martes ${fechaCorta(datos.fecha)} · Lecturas del ${fechaCorta(datos.inicio)} al ${fechaCorta(datos.fin)} (−1 / +3 días, ambos incluidos)`;
  $('avisos').replaceChildren();datos.advertencias.forEach(a=>{const p=document.createElement('p');p.textContent=PortalConfig.textoUnidad?.(a) ?? a;$('avisos').append(p)});$('avisos').hidden=!datos.advertencias.length;
  $('estado').textContent=datos.reportadas?'Consulta completada.':reporteEfectivo?'No hay patentes con lectura efectiva en el período; se muestran las bases vigentes.':'No hay patentes válidas reportadas en el período; se muestran las bases vigentes.';
  $('fuente').textContent=`Fuente: ${datos.fuente} / ${datos.hoja} · ${fmt(datos.filas_fuente)} filas leídas · Fechas disponibles: ${datos.min_fecha?fechaCorta(datos.min_fecha):'—'} a ${datos.max_fecha?fechaCorta(datos.max_fecha):'—'} · Actualizado: ${datos.actualizado.replace('T',' ')}`;
  render();$('resultados').hidden=false;$('exportar').disabled=false;
 }catch(error){reporte=null;visibles=[];$('resultados').hidden=true;$('avisos').hidden=true;$('exportar').disabled=true;$('estado').className='error';$('estado').textContent=error.message;}finally{$('consultar').disabled=false;if($('reporte-modo'))$('reporte-modo').disabled=false;if($('limpiar-filtros'))$('limpiar-filtros').disabled=false;if($('descargar-pdf'))$('descargar-pdf').disabled=!reporte;}
}
$('formulario').onsubmit=consultar;$('region').onchange=()=>{serieFija=null;serieHover=null;render();};$('buscar').onchange=()=>{serieFija=null;serieHover=null;render();};
if($('status-equipo'))$('status-equipo').onchange=()=>{serieFija=null;serieHover=null;actualizarRegiones();render();};
if($('zona-linea'))$('zona-linea').onchange=()=>{serieFija=null;serieHover=null;marcaHover=null;ocultarTooltip();render();};
if($('limpiar-filtros'))$('limpiar-filtros').onclick=()=>{
 if($('consultar').disabled)return;
 for(const id of ['region','buscar','zona-linea','status-equipo'])if($(id))PortalFiltros.asignar(id);
 document.querySelectorAll('#formulario .multi-filtro input[type="search"]').forEach(input=>{input.value='';input.dispatchEvent(new Event('input'));});
 document.querySelectorAll('#formulario .multi-desplegable').forEach(detalle=>detalle.open=false);
 serieFija=null;serieHover=null;marcaHover=null;rangoHover=null;rangoFoco=null;ocultarTooltip();
 if(reporte){actualizarRegiones();render();}else consultar();
};
criteriosEfectiva.forEach(c=>{if($(c.id))$(c.id).onchange=()=>{serieFija=null;serieHover=null;marcaHover=null;ocultarTooltip();actualizarCriterios();actualizarRegiones();render();};});
if($('reporte-modo'))$('reporte-modo').onclick=async()=>{if($('consultar').disabled)return;reporteEfectivo=!reporteEfectivo;actualizarModoReporte();await consultar();};
$('expandir').onclick=()=>{const todas=visibles.every(r=>plegadas.has(r.region));visibles.forEach(r=>todas?plegadas.delete(r.region):plegadas.add(r.region));render();};
$('mostrar-regiones').onclick=()=>{if(!window.PortalZona?.activa())return;const contraer=lineasAbiertas();visibles.forEach(r=>{if(!contraer)plegadas.delete(r.region);r.cecos.forEach(c=>{const clave=claveUnidad(r.region,c.ceco);contraer?lineasPlegadas.add(clave):lineasPlegadas.delete(clave);});});render();};
$('reporte-volver').onclick=()=>{if(PortalFiltros.hay('buscar'))PortalFiltros.asignar('buscar');else PortalFiltros.asignar('region');serieFija=null;serieHover=null;render();};
$('exportar').onclick=()=>{if(!reporte)return;const rows=[['Fecha de referencia',window.PortalZona?.activa()?'Zona':'Región','Unidad',...(window.PortalZona?.activa()?['Línea de negocio']:[]),reporteEfectivo?'Efectivas':'Reportadas',...(reporteEfectivo?['Reportadas no efectivas','Reportadas totales']:[]),'% respecto del total','Base vigente','Semáforo','Reportadas fuera de base (ver pendientes CSV)',...reporte.semanas.slice(0,-1).map(s=>`S${s.numero} ${s.fecha} (%)`),`Promedio ${reporte.semanas.length} semanas (%)`,...reporte.semanas.slice(0,-1).map(s=>`Base vigente S${s.numero} ${s.fecha}`),'Status del equipo (filtro)',...(reporteEfectivo?['Criterios de reportabilidad efectiva']:[])]];visibles.forEach(r=>r.cecos.flatMap(c=>c.lineas?.length?c.lineas:[c]).forEach(c=>{const valores=serieCumplimiento([c]);rows.push([reporte.fecha,r.region,c.ceco,...(window.PortalZona?.activa()?[c.linea||'']:[]),c.reportadas,...(reporteEfectivo?[c.reportadas_totales-c.reportadas,c.reportadas_totales]:[]),porcentaje(c.reportadas,c.total),c.total,estadoSemaforo(c.reportadas,c.total).nombre,c.fuera_maestro,...valores.slice(0,-1).map(formatoIndice),formatoIndice(promedioCumplimiento(valores)),...(c.historico_base||reporte.semanas.map(()=>c.total)).slice(0,-1),$('status-equipo')?PortalFiltros.texto('status-equipo'):'Todos los status',...(reporteEfectivo?[textoCriterios()]:[])]);}));const csv=rows.map(row=>row.map(v=>'"'+String(typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Reportabilidad_${reporteEfectivo?'Efectiva_':''}${reporte.fecha}.csv`;a.click();URL.revokeObjectURL(url);};
actualizarModoReporte();consultar();
