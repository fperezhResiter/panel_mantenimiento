const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('es-CL'), fechaCorta=s=>s.split('-').reverse().join('-');
let reporte=null, visibles=[], plegadas=new Set();
let serieFija=null,serieHover=null,elementosSeries=[];
let lineasPlegadas=new Set();
const claveUnidad=(region,ceco)=>JSON.stringify([region,ceco]);
function seriesGraficos(){
 const zona=Boolean(window.PortalZona?.activa());
 const region=$('region').value,unidad=$('buscar').value;
 const grupos=visibles.filter(r=>!region||r.region===region);
 const porUnidad=Boolean(region||unidad);
 const porLinea=zona&&Boolean(unidad);
 const series=porLinea?grupos.flatMap(r=>r.cecos.filter(c=>c.ceco===unidad).flatMap(c=>(c.lineas||[]).map(l=>({nombre:l.linea,cecos:[l]})))):porUnidad?grupos.flatMap(r=>r.cecos.map(c=>({nombre:c.ceco,cecos:[c]}))):grupos.map(r=>({nombre:r.region,cecos:r.cecos}));
 return {series,nivel:porLinea?'linea':porUnidad?'unidad':'region',titulo:porLinea?'línea de negocio · '+unidad:porUnidad?'Unidad'+(region?' · '+region:''):zona?'zona':'región'};
}
function elegirSerie(nombre){
 const {nivel}=seriesGraficos();
 if(nivel==='region'){$('region').value=nombre;$('buscar').value='';plegadas.delete(nombre);}
 else if(nivel==='unidad'&&!$('buscar').value){$('buscar').value=nombre;}
 else {serieFija=serieFija===nombre?null:nombre;destacarSeries();return;}
 serieFija=null;serieHover=null;render();
}
function destacarSeries(){const activa=serieHover??serieFija;for(const {elemento,nombre} of elementosSeries){elemento.style.opacity=activa&&nombre!==activa?'0.15':'1';elemento.setAttribute('aria-pressed',String(nombre===serieFija));}}
function conectarSerie(elemento,nombre){
 elementosSeries.push({elemento,nombre});elemento.style.cursor='pointer';elemento.setAttribute('tabindex','0');elemento.setAttribute('role','button');const nivel=seriesGraficos().nivel;const accion=nivel==='region'?'Filtrar por ':nivel==='unidad'&&!$('buscar').value?'Filtrar por unidad ':'Destacar ';elemento.setAttribute('aria-label',accion+nombre);
 elemento.onmouseenter=elemento.onfocus=()=>{serieHover=nombre;destacarSeries();};
 elemento.onmouseleave=elemento.onblur=()=>{serieHover=null;destacarSeries();};
 elemento.onclick=()=>elegirSerie(nombre);
 elemento.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();elemento.onclick();}if(e.key==='Escape'){serieFija=null;serieHover=null;destacarSeries();}};
}
function lineasAbiertas(){const unidades=visibles.flatMap(r=>r.cecos.filter(c=>c.lineas?.length).map(c=>claveUnidad(r.region,c.ceco)));return unidades.length>0&&unidades.every(clave=>!lineasPlegadas.has(clave));}
function elegirTabla(region,ceco=null){const conjunto=ceco===null?plegadas:lineasPlegadas,clave=ceco===null?region:claveUnidad(region,ceco);conjunto.has(clave)?conjunto.delete(clave):conjunto.add(clave);render();}
function seleccionados(regiones){return regiones.filter(r=>PortalConfig.incluida(r.region)).map(r=>({...r,cecos:r.cecos.filter(c=>PortalConfig.cecoIncluido(c.ceco))})).filter(r=>r.cecos.length);}
function actualizarRegiones(){if(!reporte)return;const previa=$('region').value;const incluidas=seleccionados(reporte.regiones);$('region').replaceChildren(new Option('Todas las regiones incluidas',''));incluidas.forEach(r=>$('region').add(new Option(r.region,r.region)));if(incluidas.some(r=>r.region===previa))$('region').value=previa;}
function actualizarCecos(regiones){
 const selector=$('buscar'),previo=selector.value;
 const cecos=[...new Set(regiones.filter(r=>!$('region').value||r.region===$('region').value).flatMap(r=>r.cecos.map(c=>c.ceco)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 selector.replaceChildren(new Option('Todas las unidades',''));
 cecos.forEach(ceco=>selector.add(new Option(PortalConfig.nombreCeco?.(ceco) ?? ceco,ceco)));
 selector.value=cecos.includes(previo)?previo:'';
}
function mostrarConfiguracion(){if(reporte)PortalConfig.registrar(reporte.regiones.map(r=>r.region),reporte.regiones.flatMap(r=>r.cecos.map(c=>c.ceco)));}
window.addEventListener('portal-config',()=>{actualizarRegiones();render();});
const hoy=PortalDatos.fechaActual();hoy.setDate(hoy.getDate()+1-(hoy.getDay()+6)%7);
$('fecha').min='2026-08-04';$('fecha').step='7';
$('fecha').value=[`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`,'2026-08-04'].sort().at(-1);
function celda(fila,texto,tipo='td'){const c=document.createElement(tipo);c.textContent=texto;fila.append(c);return c;}
const porcentaje=(reportadas,total)=>total?(100*reportadas/total).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
function validarReporte(datos){
 const cantidad=n=>Number.isInteger(n)&&n>=0;
 const valido=datos&&datos.version_reporte===2&&Array.isArray(datos.semanas)&&datos.semanas.length>0&&datos.semanas.length<=4&&cantidad(datos.reportadas)&&cantidad(datos.total)&&Array.isArray(datos.regiones)&&datos.regiones.every(r=>Array.isArray(r.cecos)&&r.cecos.every(c=>cantidad(c.reportadas)&&cantidad(c.total)&&cantidad(c.fuera_maestro)&&Array.isArray(c.historico)&&c.historico.length===datos.semanas.length&&c.historico.every(cantidad)));
 const completo=valido&&Array.isArray(datos.semanas_completas)&&datos.semanas_completas.length===datos.semana&&datos.regiones.every(r=>r.cecos.every(c=>Array.isArray(c.historico_completo)&&c.historico_completo.length===datos.semanas_completas.length&&c.historico_completo.every(cantidad)));
 if(!completo)throw new Error('El servidor está usando una versión anterior o incompatible del reporte. Detén la ventana del servidor con Ctrl+C, vuelve a ejecutar Iniciar_Panel.bat y recarga esta página con Ctrl+F5.');
}
function estadoSemaforo(reportadas,total){return !total?{clase:'neutro',nombre:'Sin base'}:reportadas/total>=.9?{clase:'verde',nombre:'Verde'}:reportadas/total>=.75?{clase:'amarillo',nombre:'Amarillo'}:{clase:'rojo',nombre:'Rojo'};}
function pintarPorcentaje(elemento,reportadas,total){
 const estado=estadoSemaforo(reportadas,total);
 if(elemento===$('porcentaje')){
  const indicador=document.createElement('span');
  indicador.className='semaforo '+estado.clase;
  indicador.textContent=porcentaje(reportadas,total);
  elemento.replaceChildren(indicador);
  elemento.parentElement?.setAttribute('data-kpi-color',estado.clase);
  return;
 }
 const indicador=document.createElement('span');indicador.className='semaforo '+estado.clase;indicador.textContent=porcentaje(reportadas,total)+' · '+estado.nombre;elemento.replaceChildren(indicador);
}
function serieCumplimiento(cecos,completa=false){const total=cecos.reduce((s,c)=>s+c.total,0);return (completa?reporte.semanas_completas:reporte.semanas).map((_,i)=>total?100*cecos.reduce((s,c)=>s+(completa?c.historico_completo:c.historico)[i],0)/total:null);}
function promedioCumplimiento(valores){const validos=valores.filter(Number.isFinite);return validos.length?validos.reduce((a,b)=>a+b,0)/validos.length:null;}
const formatoIndice=n=>Number.isFinite(n)?n.toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
function metricas(fila,reportadas,total,cecos){celda(fila,fmt(reportadas));pintarPorcentaje(celda(fila,''),reportadas,total);celda(fila,fmt(total));const valores=serieCumplimiento(cecos);valores.slice(0,-1).forEach(v=>celda(fila,formatoIndice(v)));celda(fila,formatoIndice(promedioCumplimiento(valores)));}
function graficoCumplimiento(){
 elementosSeries=[];serieHover=null;
 const contenedor=$('reporte-grafico');contenedor.replaceChildren();$('reporte-leyenda').replaceChildren();
 graficoBarrasCumplimiento();
 const semanas=reporte.semanas_completas.slice(-8);
 const vista=seriesGraficos(),series=vista.series.map(s=>({...s,valores:serieCumplimiento(s.cecos,true).slice(-8)}));
 $('reporte-grafico-titulo').textContent='Cumplimiento semanal por '+vista.titulo;
 $('reporte-volver').hidden=!$('region').value&&!$('buscar').value;
 if(!series.some(s=>s.valores.some(Number.isFinite))){contenedor.textContent='No hay datos con base de patentes para graficar estos filtros.';return;}
 const nodo=(tag,atributos={},texto='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(atributos).forEach(([k,v])=>e.setAttribute(k,v));if(texto)e.textContent=texto;return e;};
 const w=640,h=360,m={l:75,r:35,t:25,b:70},max=Math.max(100,...series.flatMap(s=>s.valores).filter(Number.isFinite)),techo=Math.ceil(max/25)*25;
 const x=i=>semanas.length===1?(w+m.l-m.r)/2:m.l+i*(w-m.l-m.r)/(semanas.length-1),y=v=>h-m.b-v*(h-m.t-m.b)/techo;
 const svg=nodo('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':$('reporte-grafico-titulo').textContent});svg.append(nodo('title',{},'Evolución de la semana seleccionada y hasta siete anteriores. Cada punto indica su porcentaje.'));
 for(let valor=0;valor<=techo;valor+=25){svg.append(nodo('line',{x1:m.l,y1:y(valor),x2:w-m.r,y2:y(valor),stroke:'#dce3eb'}),nodo('text',{x:m.l-10,y:y(valor)+4,'text-anchor':'end'},formatoIndice(valor)));}
 svg.append(nodo('text',{x:15,y:15},'% cumplimiento'));
 semanas.forEach((s,i)=>{svg.append(nodo('text',{x:x(i),y:h-42,'text-anchor':'middle'},'S'+s.numero),nodo('text',{x:x(i),y:h-22,'text-anchor':'middle'},fechaCorta(s.fecha)));});
 const colores=['#0e81c5','#b64b23','#21854b','#854fc2','#a82f6b','#557022','#176b75','#965a12'];
 series.forEach((s,i)=>{const color=window.PanelTema?.colorGrafico(colores[i%colores.length])||colores[i%colores.length],guion=i>=colores.length?'7 4':'';let previo=null;const leyenda=document.createElement('span');leyenda.style.color=color;leyenda.textContent=(guion?'┄ ':'━ ')+s.nombre;leyenda.setAttribute('data-pdf-leyenda',s.nombre);conectarSerie(leyenda,s.nombre);$('reporte-leyenda').append(leyenda);
  s.valores.forEach((v,j)=>{if(!Number.isFinite(v)){previo=null;return;}const punto={x:x(j),y:y(v)};if(previo){const linea=nodo('line',{x1:previo.x,y1:previo.y,x2:punto.x,y2:punto.y,stroke:color,'stroke-width':4,'stroke-dasharray':guion});conectarSerie(linea,s.nombre);svg.append(linea);}const circulo=nodo('circle',{cx:punto.x,cy:punto.y,r:5,fill:color,tabindex:0});circulo.append(nodo('title',{},`${s.nombre} · S${semanas[j].numero}: ${formatoIndice(v)}`));conectarSerie(circulo,s.nombre);svg.append(circulo);previo=punto;});
 });contenedor.append(svg);if(serieFija&&!series.some(s=>s.nombre===serieFija))serieFija=null;destacarSeries();
}
function graficoBarrasCumplimiento(){
 const contenedor=$('reporte-barras');contenedor.replaceChildren();
 const vista=seriesGraficos();
 $('reporte-barras-titulo').textContent=`Cumplimiento por ${vista.titulo} · S${reporte.semana} · ${fechaCorta(reporte.fecha)}`;
 const cecos=vista.series.map(s=>{const total=s.cecos.reduce((n,c)=>n+c.total,0),reportadas=s.cecos.reduce((n,c)=>n+c.reportadas,0);return {ceco:s.nombre,region:$('region').value||s.nombre,valor:total?100*reportadas/total:null};});
 if(!cecos.length){contenedor.textContent='No hay datos para estos filtros.';return;}
 const nodo=(tag,a={},texto='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));e.textContent=texto;return e;};
 const w=640,h=360,m={l:65,r:25,t:35,b:110},techo=Math.ceil(Math.max(100,...cecos.map(c=>c.valor||0))/25)*25;
 const y=v=>h-m.b-v*(h-m.t-m.b)/techo,paso=(w-m.l-m.r)/cecos.length;
 const svg=nodo('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':$('reporte-barras-titulo').textContent});
 for(let v=0;v<=techo;v+=25){svg.append(nodo('line',{x1:m.l,y1:y(v),x2:w-m.r,y2:y(v),stroke:'#dce3eb'}),nodo('text',{x:m.l-8,y:y(v)+4,'text-anchor':'end'},formatoIndice(v)));}
 svg.append(nodo('text',{x:10,y:15},'% cumplimiento'));
 cecos.forEach((c,i)=>{const x=m.l+paso*(i+.5),color=c.valor===null?'#7b8794':c.valor>=90?'#21854b':c.valor>=75?'#b78912':'#bc3e3e';
  if(c.valor!==null){const barra=nodo('rect',{x:x-paso*.3,y:y(c.valor),width:paso*.6,height:y(0)-y(c.valor),fill:color,tabindex:0});barra.append(nodo('title',{},`${c.region} · ${c.ceco}: ${formatoIndice(c.valor)}`));conectarSerie(barra,c.ceco);svg.append(barra);}
  const fuente=Math.max(5,Math.min(12,paso/4)),angulo=cecos.length>8?70:35;
  const valor=nodo('text',{x,y:c.valor===null?y(0)-10:y(c.valor)-8,'text-anchor':'middle','font-size':fuente},c.valor===null?'Sin base':formatoIndice(c.valor));conectarSerie(valor,c.ceco);svg.append(valor);
  const etiqueta=nodo('text',{x,y:h-m.b+18,'font-size':fuente,transform:`rotate(${angulo} ${x} ${h-m.b+18})`},c.ceco.length>22?c.ceco.slice(0,21)+'…':c.ceco);etiqueta.append(nodo('title',{},`${c.region} · ${c.ceco}`));conectarSerie(etiqueta,c.ceco);svg.append(etiqueta);
 });contenedor.append(svg);
}
function render(){
 if(!reporte)return;
 const incluidas=seleccionados(reporte.regiones);
 actualizarCecos(incluidas);
 const ceco=$('buscar').value;
 visibles=incluidas.filter(r=>!$('region').value||r.region===$('region').value).map(r=>({...r,cecos:r.cecos.filter(c=>!ceco||c.ceco===ceco)})).filter(r=>r.cecos.length);
 $('resumen-config').textContent=`Configuración: ${incluidas.length} de ${reporte.regiones.length} regiones y ${incluidas.reduce((n,r)=>n+r.cecos.length,0)} de ${reporte.regiones.reduce((n,r)=>n+r.cecos.length,0)} unidades incluidas. Los filtros de región y Unidad se aplican además de esta selección. Los avisos de calidad corresponden al archivo consultado completo.`;
 $('cabecera').replaceChildren();const head=document.createElement('tr');['Región / Unidad','Reportadas','% semana seleccionada','Total patentes',...reporte.semanas.slice(0,-1).map(s=>`S${s.numero} · ${fechaCorta(s.fecha)} (%)`),`Promedio ${reporte.semanas.length} semanas`].forEach(t=>celda(head,t,'th'));$('cabecera').append(head);
 $('detalle').replaceChildren();let total=0,reportadas=0,cecos=0;
 for(const r of visibles){const sum=r.cecos.reduce((a,c)=>a+c.total,0), report=r.cecos.reduce((a,c)=>a+c.reportadas,0);total+=sum;reportadas+=report;cecos+=r.cecos.filter(c=>c.ceco!=='SIN CECO').length;
 const tr=document.createElement('tr');tr.className='region';const boton=document.createElement('button');boton.type='button';boton.textContent=(plegadas.has(r.region)?'▸ ':'▾ ')+r.region;boton.setAttribute('aria-label',(plegadas.has(r.region)?'Expandir ':'Contraer ')+r.region);boton.setAttribute('aria-expanded',String(!plegadas.has(r.region)));boton.onclick=()=>elegirTabla(r.region);celda(tr,'').append(boton);metricas(tr,report,sum,r.cecos);$('detalle').append(tr);
 if(!plegadas.has(r.region))for(const c of r.cecos){const fila=document.createElement('tr');fila.className='ceco';const nombre=celda(fila,'');const enlace=document.createElement(c.lineas?.length?'button':'span');if(c.lineas?.length)enlace.type='button';enlace.className='reporte-ceco-enlace';enlace.textContent=PortalConfig.nombreCeco?.(c.ceco) ?? c.ceco;if(c.lineas?.length){const abierta=!lineasPlegadas.has(claveUnidad(r.region,c.ceco));enlace.textContent=(abierta?'▾ ':'▸ ')+enlace.textContent;enlace.setAttribute('aria-expanded',String(abierta));enlace.onclick=()=>elegirTabla(r.region,c.ceco);}nombre.append(enlace);if(c.fuera_maestro){const nota=document.createElement('div');nota.className='nota-fuera-maestro';nota.textContent=`${fmt(c.fuera_maestro)} reportadas fuera del maestro de esta unidad`;nombre.append(nota);}metricas(fila,c.reportadas,c.total,[c]);$('detalle').append(fila);for(const l of lineasPlegadas.has(claveUnidad(r.region,c.ceco))?[]:c.lineas||[]){const f=document.createElement('tr');f.className='zona-linea';celda(f,'Línea: '+l.linea);metricas(f,l.reportadas,l.total,[l]);$('detalle').append(f);}}
 }
 if(!visibles.length){const tr=document.createElement('tr');celda(tr,'No hay centros de costo para estos filtros.').colSpan=4+reporte.semanas.length;$('detalle').append(tr);}
 $('pie').replaceChildren();const pie=document.createElement('tr');celda(pie,'Total general');metricas(pie,reportadas,total,visibles.flatMap(r=>r.cecos));$('pie').append(pie);graficoCumplimiento();
 $('total').textContent=fmt(total);$('reportadas').textContent=fmt(reportadas);pintarPorcentaje($('porcentaje'),reportadas,total);$('cecos').textContent=fmt(cecos);$('mostrar-regiones').hidden=!window.PortalZona?.activa();$('mostrar-regiones').textContent=lineasAbiertas()?'Contraer líneas':'Expandir líneas';$('expandir').textContent=visibles.length&&visibles.every(r=>plegadas.has(r.region))?'Expandir regiones':'Contraer regiones';
}
async function consultar(event){
 event?.preventDefault();$('consultar').disabled=true;$('exportar').disabled=true;$('resultados').hidden=true;$('avisos').hidden=true;$('estado').className='';$('estado').textContent='Consultando BD y calculando reportabilidad…';reporte=null;mostrarConfiguracion();
 try{

  const respuesta=await PortalDatos.consultar('/api/reporte?fecha='+encodeURIComponent($('fecha').value),{cache:'no-store'});const datos=await respuesta.json();if(!respuesta.ok)throw new Error(datos.error||'No se pudo consultar la BD.');validarReporte(datos);reporte=datos;PortalConfig.registrarCecos?.(datos);plegadas.clear();lineasPlegadas=new Set(datos.regiones.flatMap(r=>r.cecos.map(c=>claveUnidad(r.region,c.ceco))));serieFija=null;
  actualizarRegiones();mostrarConfiguracion();
  $('fecha').value=datos.fecha;
  $('periodo').textContent=`Semana ${datos.semana} · Martes ${fechaCorta(datos.fecha)} · Lecturas del ${fechaCorta(datos.inicio)} al ${fechaCorta(datos.fin)} (−1 / +3 días, ambos incluidos)`;
  $('avisos').replaceChildren();datos.advertencias.forEach(a=>{const p=document.createElement('p');p.textContent=PortalConfig.textoUnidad?.(a) ?? a;$('avisos').append(p)});$('avisos').hidden=!datos.advertencias.length;
  $('estado').textContent=datos.reportadas?'Consulta completada.':'No hay patentes válidas reportadas en el período; se muestran los totales del maestro.';
  $('fuente').textContent=`Fuente: ${datos.fuente} / ${datos.hoja} · ${fmt(datos.filas_fuente)} filas leídas · Fechas disponibles: ${datos.min_fecha?fechaCorta(datos.min_fecha):'—'} a ${datos.max_fecha?fechaCorta(datos.max_fecha):'—'} · Actualizado: ${datos.actualizado.replace('T',' ')}`;
  render();$('resultados').hidden=false;$('exportar').disabled=false;
 }catch(error){reporte=null;visibles=[];$('resultados').hidden=true;$('avisos').hidden=true;$('exportar').disabled=true;$('estado').className='error';$('estado').textContent=error.message;}finally{$('consultar').disabled=false;}
}
$('formulario').onsubmit=consultar;$('region').onchange=()=>{serieFija=null;serieHover=null;render();};$('buscar').onchange=()=>{serieFija=null;serieHover=null;render();};
$('expandir').onclick=()=>{const todas=visibles.every(r=>plegadas.has(r.region));visibles.forEach(r=>todas?plegadas.delete(r.region):plegadas.add(r.region));render();};
$('mostrar-regiones').onclick=()=>{if(!window.PortalZona?.activa())return;const contraer=lineasAbiertas();visibles.forEach(r=>{if(!contraer)plegadas.delete(r.region);r.cecos.forEach(c=>{const clave=claveUnidad(r.region,c.ceco);contraer?lineasPlegadas.add(clave):lineasPlegadas.delete(clave);});});render();};
$('reporte-volver').onclick=()=>{if($('buscar').value)$('buscar').value='';else $('region').value='';serieFija=null;serieHover=null;render();};
$('exportar').onclick=()=>{if(!reporte)return;const rows=[['Fecha de referencia',window.PortalZona?.activa()?'Zona':'Región','Unidad',...(window.PortalZona?.activa()?['Línea de negocio']:[]),'Reportadas','% respecto del total','Total patentes','Semáforo','Reportadas fuera del maestro',...reporte.semanas.slice(0,-1).map(s=>`S${s.numero} ${s.fecha} (%)`),`Promedio ${reporte.semanas.length} semanas (%)`]];visibles.forEach(r=>r.cecos.flatMap(c=>c.lineas?.length?c.lineas:[c]).forEach(c=>{const valores=serieCumplimiento([c]);rows.push([reporte.fecha,r.region,c.ceco,...(window.PortalZona?.activa()?[c.linea||'']:[]),c.reportadas,porcentaje(c.reportadas,c.total),c.total,estadoSemaforo(c.reportadas,c.total).nombre,c.fuera_maestro,...valores.slice(0,-1).map(formatoIndice),formatoIndice(promedioCumplimiento(valores))]);}));const csv=rows.map(row=>row.map(v=>'"'+String(typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Reportabilidad_${reporte.fecha}.csv`;a.click();URL.revokeObjectURL(url);};
consultar();
