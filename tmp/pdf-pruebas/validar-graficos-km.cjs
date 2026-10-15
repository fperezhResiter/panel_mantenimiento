const fs = require('node:fs');
const assert = require('node:assert/strict');
const sharp = require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
class Nodo {
  constructor(tag){this.tagName=tag;this.attrs={};this.children=[];this.textContent='';this.style={};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  get classList(){return {remove:n=>this.attrs.class=(this.attrs.class||'').split(' ').filter(c=>c!==n).join(' ')};}
  append(...hijos){for(const h of hijos){h.remove();h.parentNode=this;this.children.push(h);}}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}
  replaceChildren(){this.children=[];}
  querySelectorAll(selector){const match=e=>selector.split(',').some(s=>{
    const cls=s.match(/\.([\w-]+)/)?.[1],att=s.match(/\[([\w-]+)\]/)?.[1];
    return (!cls||(e.attrs.class||'').split(' ').includes(cls))&&(!att||e.attrs[att]!==undefined);
  });return this.children.flatMap(e=>[...(match(e)?[e]:[]),...e.querySelectorAll(selector)]);}
  cloneNode(){const n=new Nodo(this.tagName);n.attrs={...this.attrs};n.textContent=this.textContent;n.append(...this.children.map(c=>c.cloneNode()));return n;}
}
const nodos={puntos:new Nodo('div'),barras:new Nodo('div')};
const doc={getElementById:id=>nodos[id]||null,createElement:tag=>new Nodo(tag),createElementNS:(_,tag)=>new Nodo(tag)};
const fuente=fs.readFileSync('web/js/seguimiento_km_hr.js','utf8');
const funciones=fuente.slice(fuente.indexOf('function svgElemento('),fuente.indexOf('function renderGraficos('));
const prefijo=`const km$=id=>document.getElementById(id);const kmMarcasGraficos=new Map();const kmFmt=n=>n.toLocaleString('es-CL',{maximumFractionDigits:2});const kmMedida=(n,u)=>kmFmt(n)+' '+u;`;
const dibujar=new Function('document',prefijo+funciones+';return dibujarGrafico;')(doc);
const puntos=[100,110,null,140,140,141,142].map((valor,i)=>({valor,semana:i+1,detalle:'Lectura'}));
const barras=[0,12.25,null,10,11,10.5,11.5].map((valor,i)=>({valor,semana:i+1,detalle:'Uso diario'}));
dibujar('puntos',puntos,'KM');dibujar('barras',barras,'KM/día',true);
const originales=[nodos.puntos.children[0],nodos.barras.children[0]];
const copias=originales.map(e=>e.cloneNode());
const antes=originales.map(e=>JSON.stringify(e.attrs)+e.querySelectorAll('.km-valor-activo').length);
const pdfDoc={querySelectorAll:()=>copias,createElementNS:doc.createElementNS};
const window={};
const pdfFuente=fs.readFileSync('web/js/panel_pdf.js','utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, prepararGraficosSeguimiento};');
new Function('window','document',pdfFuente)(window,{getElementById:()=>null});
window.PanelPDF.prepararGraficosSeguimiento(pdfDoc);
for(let i=0;i<2;i++){
 assert.equal(originales[i].querySelectorAll('.km-valor-pdf').length,0);
 assert.equal(copias[i].querySelectorAll('.km-valor-pdf').length,6);
 assert.equal(copias[i].querySelectorAll('.km-valor-activo,.km-guia-activa').length,0);
 assert.equal(JSON.stringify(originales[i].attrs)+originales[i].querySelectorAll('.km-valor-activo').length,antes[i]);
 assert(copias[i].querySelectorAll('.km-valor-pdf').every(n=>!n.textContent.includes('Sin datos')));
}
assert(copias[1].querySelectorAll('.km-valor-pdf').some(n=>n.textContent==='0'));
assert.match(fs.readFileSync('web/pages/Panel_Seguimiento_KM_HR.html','utf8'),/data-pdf-omitir>Selecciona una patente/);
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const xml=e=>`<${e.tagName} ${Object.entries(e.attrs).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}>${escape(e.textContent)}${e.children.map(xml).join('')}</${e.tagName}>`;
const estilo='<style>.km-rejilla{stroke:#dde4ec;stroke-width:1}.km-eje{font:12px Arial;fill:#5b6b7c}.km-linea{stroke:#0e81c5;stroke-width:2}.km-punto,.km-barra{fill:#0e81c5}</style>';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="410"><rect width="1400" height="410" fill="white"/>${estilo}<text x="50" y="30" font-family="Arial" font-size="18">Lecturas - valores solo en PDF</text><text x="750" y="30" font-family="Arial" font-size="18">Uso diario - valores solo en PDF</text>${copias.map((e,i)=>{e.setAttribute('x',i*700+20);e.setAttribute('y',50);e.setAttribute('width',660);e.setAttribute('height',340);return xml(e);}).join('')}</svg>`;
fs.writeFileSync('tmp/pdf-pruebas/km-valores.svg',svg);
sharp(Buffer.from(svg)).png().toFile('tmp/pdf-pruebas/km-valores.png').then(()=>console.log('OK: valores exactos en barras/puntos, cero incluido, ausentes omitidos y gráficos originales intactos.')).catch(e=>{console.error(e);process.exitCode=1;});
