const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('es-CL'), fechaCorta=s=>s.split('-').reverse().join('-');
let reporte=null, visibles=[], plegadas=new Set();
const CLAVE_CONFIG='resiter.reportabilidad.config.v1';
let excluidasRegiones=new Set(), excluidosCecos=new Set();
try{const config=JSON.parse(localStorage.getItem(CLAVE_CONFIG)||'{}');if(Array.isArray(config.regiones)&&config.regiones.every(x=>typeof x==='string'))excluidasRegiones=new Set(config.regiones);if(Array.isArray(config.cecos)&&config.cecos.every(x=>typeof x==='string'))excluidosCecos=new Set(config.cecos);}catch{$('guardado-config').textContent='No se pudo recuperar la selección guardada. Se incluyen todos por defecto.';}
function seleccionados(regiones){return regiones.filter(r=>!excluidasRegiones.has(r.region)).map(r=>({...r,cecos:r.cecos.filter(c=>!excluidosCecos.has(c.ceco))})).filter(r=>r.cecos.length);}
function guardarConfig(){try{localStorage.setItem(CLAVE_CONFIG,JSON.stringify({regiones:[...excluidasRegiones],cecos:[...excluidosCecos]}));$('guardado-config').textContent='Selección guardada en este navegador.';}catch{$('guardado-config').textContent='Selección aplicada en esta sesión. El navegador no permitió guardarla.';}actualizarRegiones();render();}
function actualizarRegiones(){if(!reporte)return;const previa=$('region').value;const incluidas=seleccionados(reporte.regiones);$('region').replaceChildren(new Option('Todas las regiones incluidas',''));incluidas.forEach(r=>$('region').add(new Option(r.region,r.region)));if(incluidas.some(r=>r.region===previa))$('region').value=previa;}
function mostrarConfiguracion(){
 $('lista-configuracion').replaceChildren();$('incluir-todos').disabled=!reporte;$('excluir-todos').disabled=!reporte;
 if(!reporte){$('lista-configuracion').textContent='Consulta el Excel para cargar las regiones y los CeCo.';return;}
 for(const r of reporte.regiones){
  const grupo=document.createElement('section');grupo.className='config-grupo';const label=document.createElement('label');label.className='config-region';const check=document.createElement('input');check.type='checkbox';check.checked=!excluidasRegiones.has(r.region);label.append(check,document.createTextNode(r.region));grupo.append(label);
  const lista=document.createElement('fieldset');lista.className='config-cecos';lista.setAttribute('aria-label','CeCo de '+r.region);lista.disabled=!check.checked;
  check.onchange=()=>{check.checked?excluidasRegiones.delete(r.region):excluidasRegiones.add(r.region);lista.disabled=!check.checked;guardarConfig();};
  for(const c of r.cecos){const l=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.checked=!excluidosCecos.has(c.ceco);cb.onchange=()=>{cb.checked?excluidosCecos.delete(c.ceco):excluidosCecos.add(c.ceco);guardarConfig();};l.append(cb,document.createTextNode(c.ceco));lista.append(l);}
  grupo.append(lista);$('lista-configuracion').append(grupo);
 }
}
function cambiarTab(config){$('vista-configuracion').hidden=!config;$('vista-reporte').hidden=config;$('formulario').hidden=config;for(const id of ['tab-reporte','tab-configuracion']){const activo=(id==='tab-configuracion')===config;$(id).setAttribute('aria-selected',String(activo));$(id).tabIndex=activo?0:-1;}}
$('tab-reporte').onclick=()=>cambiarTab(false);$('tab-configuracion').onclick=()=>cambiarTab(true);
for(const id of ['tab-reporte','tab-configuracion'])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const config=e.key==='End'||(e.key!=='Home'&&id==='tab-reporte');cambiarTab(config);$(config?'tab-configuracion':'tab-reporte').focus();}};
$('incluir-todos').onclick=()=>{excluidasRegiones.clear();excluidosCecos.clear();mostrarConfiguracion();guardarConfig();};
$('excluir-todos').onclick=()=>{if(!reporte)return;reporte.regiones.forEach(r=>excluidasRegiones.add(r.region));mostrarConfiguracion();guardarConfig();};
const hoy=new Date();$('fecha').value=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
function celda(fila,texto,tipo='td'){const c=document.createElement(tipo);c.textContent=texto;fila.append(c);return c;}
const porcentaje=(reportadas,total)=>total?(100*reportadas/total).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
function validarReporte(datos){
 const cantidad=n=>Number.isInteger(n)&&n>=0;
 const valido=datos&&datos.version_reporte===2&&cantidad(datos.reportadas)&&cantidad(datos.total)&&Array.isArray(datos.regiones)&&datos.regiones.every(r=>Array.isArray(r.cecos)&&r.cecos.every(c=>cantidad(c.reportadas)&&cantidad(c.total)&&cantidad(c.fuera_maestro)));
 if(!valido)throw new Error('El servidor está usando una versión anterior o incompatible del reporte. Detén la ventana del servidor con Ctrl+C, vuelve a ejecutar Iniciar_Panel.bat y recarga esta página con Ctrl+F5.');
}
function estadoSemaforo(reportadas,total){return !total?{clase:'neutro',nombre:'Sin base'}:reportadas/total>=.9?{clase:'verde',nombre:'Verde'}:reportadas/total>=.75?{clase:'amarillo',nombre:'Amarillo'}:{clase:'rojo',nombre:'Rojo'};}
function pintarPorcentaje(elemento,reportadas,total){const estado=estadoSemaforo(reportadas,total),indicador=document.createElement('span');indicador.className='semaforo '+estado.clase;indicador.textContent=porcentaje(reportadas,total)+' · '+estado.nombre;elemento.replaceChildren(indicador);}
function metricas(fila,reportadas,total){celda(fila,fmt(reportadas));pintarPorcentaje(celda(fila,''),reportadas,total);celda(fila,fmt(total));}
function render(){
 if(!reporte)return;
 const busqueda=$('buscar').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const incluidas=seleccionados(reporte.regiones);
 visibles=incluidas.filter(r=>!$('region').value||r.region===$('region').value).map(r=>({...r,cecos:r.cecos.filter(c=>c.ceco.normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(busqueda))})).filter(r=>r.cecos.length);
 $('resumen-config').textContent=`Configuración: ${incluidas.length} de ${reporte.regiones.length} regiones y ${incluidas.reduce((n,r)=>n+r.cecos.length,0)} de ${reporte.regiones.reduce((n,r)=>n+r.cecos.length,0)} CeCo incluidos. Los filtros de región y búsqueda se aplican además de esta selección. Los avisos de calidad corresponden al archivo consultado completo.`;
 $('cabecera').replaceChildren();const head=document.createElement('tr');['Región / nombre CeCo','Reportadas','% respecto del total','Total patentes'].forEach(t=>celda(head,t,'th'));$('cabecera').append(head);
 $('detalle').replaceChildren();let total=0,reportadas=0,cecos=0;
 for(const r of visibles){const sum=r.cecos.reduce((a,c)=>a+c.total,0), report=r.cecos.reduce((a,c)=>a+c.reportadas,0);total+=sum;reportadas+=report;cecos+=r.cecos.filter(c=>c.ceco!=='SIN CECO').length;
 const tr=document.createElement('tr');tr.className='region';const boton=document.createElement('button');boton.type='button';boton.textContent=(plegadas.has(r.region)?'＋ ':'− ')+r.region;boton.setAttribute('aria-expanded',String(!plegadas.has(r.region)));boton.onclick=()=>{plegadas.has(r.region)?plegadas.delete(r.region):plegadas.add(r.region);render()};celda(tr,'').append(boton);metricas(tr,report,sum);$('detalle').append(tr);
 if(!plegadas.has(r.region))for(const c of r.cecos){const fila=document.createElement('tr');fila.className='ceco';const nombre=celda(fila,c.ceco);if(c.fuera_maestro){const nota=document.createElement('div');nota.className='nota-fuera-maestro';nota.textContent=`${fmt(c.fuera_maestro)} reportadas fuera del maestro de este CeCo`;nombre.append(nota);}metricas(fila,c.reportadas,c.total);$('detalle').append(fila);}
 }
 if(!visibles.length){const tr=document.createElement('tr');celda(tr,'No hay centros de costo para estos filtros.').colSpan=4;$('detalle').append(tr);}
 $('pie').replaceChildren();const pie=document.createElement('tr');celda(pie,'Total general');metricas(pie,reportadas,total);$('pie').append(pie);
 $('total').textContent=fmt(total);$('reportadas').textContent=fmt(reportadas);pintarPorcentaje($('porcentaje'),reportadas,total);$('cecos').textContent=fmt(cecos);$('expandir').textContent=visibles.length&&visibles.every(r=>plegadas.has(r.region))?'Expandir regiones':'Contraer regiones';
}
async function consultar(event){
 event?.preventDefault();$('consultar').disabled=true;$('exportar').disabled=true;$('resultados').hidden=true;$('avisos').hidden=true;$('estado').className='';$('estado').textContent='Leyendo Excel y calculando reportabilidad…';reporte=null;mostrarConfiguracion();
 try{
  if(location.protocol==='file:')throw new Error('Inicia reportabilidad.py y abre http://127.0.0.1:8765 para conectar este panel al Excel.');
  const respuesta=await fetch('/api/reporte?fecha='+encodeURIComponent($('fecha').value),{cache:'no-store'});const datos=await respuesta.json();if(!respuesta.ok)throw new Error(datos.error||'No se pudo consultar el Excel.');validarReporte(datos);reporte=datos;plegadas.clear();
  actualizarRegiones();mostrarConfiguracion();
  $('periodo').textContent=`Reporte al ${fechaCorta(datos.fecha)}`;
  $('avisos').replaceChildren();datos.advertencias.forEach(a=>{const p=document.createElement('p');p.textContent=a;$('avisos').append(p)});$('avisos').hidden=!datos.advertencias.length;
  $('estado').textContent=datos.reportadas?'Consulta completada.':'No hay patentes válidas reportadas en el período; se muestran los totales del maestro.';
  $('fuente').textContent=`Fuente: ${datos.fuente} / ${datos.hoja} · ${fmt(datos.filas_fuente)} filas leídas · Fechas disponibles: ${datos.min_fecha?fechaCorta(datos.min_fecha):'—'} a ${datos.max_fecha?fechaCorta(datos.max_fecha):'—'} · Actualizado: ${datos.actualizado.replace('T',' ')}`;
  render();$('resultados').hidden=false;$('exportar').disabled=false;
 }catch(error){reporte=null;visibles=[];$('resultados').hidden=true;$('avisos').hidden=true;$('exportar').disabled=true;$('estado').className='error';$('estado').textContent=error.message;}finally{$('consultar').disabled=false;}
}
$('formulario').onsubmit=consultar;$('region').onchange=render;$('buscar').oninput=render;
$('expandir').onclick=()=>{const todas=visibles.every(r=>plegadas.has(r.region));visibles.forEach(r=>todas?plegadas.delete(r.region):plegadas.add(r.region));render();};
$('exportar').onclick=()=>{if(!reporte)return;const rows=[['Fecha de referencia','Región','CeCo','Reportadas','% respecto del total','Total patentes','Semáforo','Reportadas fuera del maestro']];visibles.forEach(r=>r.cecos.forEach(c=>rows.push([reporte.fecha,r.region,c.ceco,c.reportadas,porcentaje(c.reportadas,c.total),c.total,estadoSemaforo(c.reportadas,c.total).nombre,c.fuera_maestro])));const csv=rows.map(row=>row.map(v=>'"'+String(typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Reportabilidad_${reporte.fecha}.csv`;a.click();URL.revokeObjectURL(url);};
consultar();
