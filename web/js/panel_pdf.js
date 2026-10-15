/* Informe PDF: texto y tablas nativos, con figuras de los gráficos. Sin CDN. */
(() => {
    'use strict';
    let ocupado = false;
    const pausa = () => new Promise(resolve => requestAnimationFrame(resolve));

    function filtrosInforme() {
        const lineas = [];
        const visible = el => el.getClientRects().length && !el.closest('[hidden],.vista-oculta');
        for (const el of document.querySelectorAll('.filtros input,.filtros select,#km-patente')) {
            if (!visible(el) || ['checkbox','submit','button'].includes(el.type)) continue;
            const etiqueta = el.closest('label')?.childNodes[0]?.textContent.trim() || el.getAttribute('aria-label') || el.id;
            let valor = el.value;
            if (el.tagName === 'SELECT') {
                const opciones = Array.from(el.options);
                valor = el.selectedOptions[0]?.textContent.trim() || valor;
                if (/region/i.test(el.id) && !el.value) valor = opciones.filter(o => o.value && (window.PortalConfig?.incluida(o.value) ?? true)).map(o => o.textContent.trim()).join(', ') || valor;
            } else if (el.type === 'date' && valor) valor = valor.split('-').reverse().join('-');
            else if (el.type === 'month' && valor) valor = valor.split('-').reverse().join('-');
            if (valor) lineas.push(`${etiqueta}: ${valor}`);
        }
        // Los códigos internos de Unidad tampoco se imprimen en los filtros.
        const contenedor = document.createElement('div');
        contenedor.textContent = lineas.join('\n');
        window.PortalConfig?.limpiarCecosPDF?.(contenedor);
        return contenedor.textContent.split('\n').filter(Boolean);
    }

    function copiarEstado(origen, copia) {
        const controles = copia.querySelectorAll('input,select,textarea');
        origen.querySelectorAll('input,select,textarea').forEach((el, i) => {
            const otro = controles[i];
            otro.value = el.value;
            otro.setAttribute('value', el.value);
            if (el.tagName === 'SELECT') {
                Array.from(otro.options).forEach((op, j) => {
                    op.selected = el.options[j].selected;
                    op.toggleAttribute('selected', op.selected);
                });
            }
            if (el.tagName === 'TEXTAREA') otro.textContent = el.value;
            if (el.tagName === 'INPUT') {
                otro.checked = el.checked;
                otro.toggleAttribute('checked', el.checked);
            }
        });
    }

    function prepararGraficosSeguimiento(doc) {
        for (const svg of doc.querySelectorAll('#km-grafico-lecturas svg,#km-grafico-ritmo svg')) {
            svg.querySelectorAll('.km-valor-activo,.km-guia-activa').forEach(el => el.remove());
            svg.querySelectorAll('.km-marca-activa').forEach(el => el.classList.remove('km-marca-activa'));
            const [izquierda, arriba, ancho, alto] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
            const ocupados = [];
            let superior = arriba;
            for (const marca of svg.querySelectorAll('.km-barra[data-pdf-valor],.km-punto[data-pdf-valor]')) {
                const barra = marca.tagName.toLowerCase() === 'rect';
                const x = barra ? Number(marca.getAttribute('x')) + Number(marca.getAttribute('width')) / 2 : Number(marca.getAttribute('cx'));
                let y = Number(marca.getAttribute(barra ? 'y' : 'cy')) - 10;
                const valor = marca.getAttribute('data-pdf-valor');
                const ancla = x < izquierda + 90 ? 'start' : x > izquierda + ancho - 45 ? 'end' : 'middle';
                const amplitud = valor.length * 6.5;
                const inicio = ancla === 'start' ? x : ancla === 'end' ? x - amplitud : x - amplitud / 2;
                while (ocupados.some(o => inicio < o.fin + 4 && inicio + amplitud > o.inicio - 4 && Math.abs(y - o.y) < 15)) y -= 15;
                ocupados.push({inicio, fin:inicio + amplitud, y});
                superior = Math.min(superior, y - 15);
                const texto = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
                for (const [nombre, atributo] of Object.entries({x, y, 'text-anchor':ancla, class:'km-valor-pdf', fill:'#073762', 'font-family':'Arial', 'font-size':12, 'font-weight':'bold', stroke:'white', 'stroke-width':3, 'paint-order':'stroke fill', 'stroke-linejoin':'round'})) texto.setAttribute(nombre, String(atributo));
                texto.textContent = valor;
                svg.append(texto);
            }
            svg.setAttribute('viewBox', `${izquierda} ${superior} ${ancho} ${alto + arriba - superior}`);
        }
    }

    async function preparar(vista, html) {
        // Congela datos, filtros, filas contraídas y preferencias antes de esperar.
        const copia = vista ? vista.documentElement.cloneNode(true) : new DOMParser().parseFromString(html, 'text/html').documentElement;
        // Exportar siempre con la paleta clara, sin cambiar el tema de la vista original.
        copia.setAttribute('data-tema', 'claro');
        if (vista) copiarEstado(vista, copia);
        // Un details cerrado puede conservar cajas de layout con innerText vacío.
        // Excluirlo antes de medir evita exportar cientos de filas sin texto.
        copia.querySelectorAll('details:not([open])').forEach(el => el.remove());
        copia.querySelectorAll('[data-pdf-solo]').forEach(el => el.removeAttribute('hidden'));
        window.PortalConfig?.limpiarCecosPDF?.(copia);
        copia.querySelectorAll('script,nav,header,form,.filtros,.volver-inicio,[data-pdf-omitir],#bd-barra,#avisos,#resumen-config,#programa-alcance,[role=status],.config-acciones').forEach(el => el.remove());
        // Las celdas del calendario son botones, pero sí forman parte del informe.
        copia.querySelectorAll('button:not(.mt-cal-dia),input[type=submit]').forEach(el => {
            // Los nombres de región, Unidad y patente son botones de navegación
            // dentro de las tablas: conserva su contenido en la descarga.
            if (el.closest('td,th')) {
                const texto = el.ownerDocument.createElement('span');
                texto.className = el.className;
                texto.innerHTML = el.innerHTML;
                el.replaceWith(texto);
            } else if (el.closest('.leyenda')) {
                const texto = el.ownerDocument.createElement('span');
                texto.textContent = el.textContent;
                if (el.dataset.pdfLeyenda) {
                    texto.dataset.pdfLeyenda = el.dataset.pdfLeyenda;
                    if (el.dataset.pdfColor) texto.dataset.pdfColor = el.dataset.pdfColor;
                    texto.style.color = el.style.color;
                }
                el.replaceWith(texto);
            } else el.remove();
        });
        copia.querySelectorAll('a').forEach(el => el.removeAttribute('href'));
        const marco = document.createElement('iframe');
        marco.setAttribute('aria-hidden', 'true');
        marco.style.cssText = 'position:fixed;left:-100000px;top:0;border:0;height:900px;';
        const tablas = vista ? Array.from(vista.querySelectorAll('table')).filter(el => el.getClientRects().length) : [];
        const ancho = Math.ceil(Math.max(1200, ...tablas.map(el => el.scrollWidth + 100)));
        marco.style.width = ancho + 'px';
        document.body.append(marco);
        try {
            const doc = marco.contentDocument;
            // Igual que las páginas originales: evita diferencias de tamaño de
            // filas entre el iframe de preparación y el clon de html2canvas.
            if (!doc.doctype) doc.insertBefore(doc.implementation.createDocumentType('html', '', ''), doc.documentElement);
            doc.replaceChild(doc.importNode(copia, true), doc.documentElement);
            const base = doc.createElement('base');
            base.href = document.baseURI;
            doc.head.prepend(base);
            const estilo = doc.createElement('style');
            estilo.textContent = `
                html,body{height:auto!important;overflow:visible!important}
                body{margin:0!important;max-width:none!important;padding:24px!important}
                main{max-width:none!important;margin:0!important}
                .scroll,.km-tabla-scroll{overflow:visible!important;max-height:none!important;height:auto!important}
                th,td{position:static!important} header{position:static!important}
                [data-pdf-omitir]{display:none!important}
                [data-pdf-solo]{display:flex!important}
                body[data-panel="reportabilidad"] svg text{fill:#1b2a3a!important}
            `;
            doc.head.append(estilo);
            await Promise.all(Array.from(doc.querySelectorAll('link[rel=stylesheet]')).map(el => new Promise((resolve, reject) => {
                if (el.sheet) return resolve();
                el.onload = resolve;
                el.onerror = () => reject(new Error('No se pudo cargar el diseño del panel. Recarga el portal.'));
            })));
            await doc.fonts.ready;
            await pausa();
            prepararGraficosSeguimiento(doc);
            // Convierte solo los gráficos SVG en figuras y conserva sus estilos.
            for (const svg of doc.querySelectorAll('svg')) {
                const rect = svg.getBoundingClientRect();
                if (!rect.width || !rect.height) continue;
                for (const nodo of [svg, ...svg.querySelectorAll('*')]) {
                    const css = marco.contentWindow.getComputedStyle(nodo);
                    for (const propiedad of ['fill','stroke','stroke-width','font-family','font-size','font-weight','opacity']) {
                        nodo.style.setProperty(propiedad, css.getPropertyValue(propiedad));
                    }
                }
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                svg.setAttribute('width', rect.width);
                svg.setAttribute('height', rect.height);
                const img = doc.createElement('img');
                img.width = rect.width; img.height = rect.height;
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
                svg.replaceWith(img);
            }
            // file:// considera las imágenes locales como otro origen al exportar
            // canvas. La publicación incluye copias de los logos como datos.
            if (window.PortalDatos?.consulta) {
                const publicacion = await PortalDatos.listo;
                for (const img of doc.images) {
                    const nombre = decodeURIComponent(new URL(img.src, document.baseURI).pathname.split('/').pop());
                    if (publicacion.imagenes[nombre]) img.src = publicacion.imagenes[nombre];
                }
            }
            await Promise.all(Array.from(doc.images).map(img => img.decode()));
            await pausa();
            return {marco, doc, ancho};
        } catch (error) { marco.remove(); throw error; }
    }

    async function crearInforme(doc, titulo, filtros, logoSrc) {
        const pdf = await PDFLib.PDFDocument.create();
        pdf.setTitle(titulo); pdf.setAuthor('Resiter Minería');
        const regular = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
        const negrita = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const color = PDFLib.rgb;
        const tinta = color(0.106,0.165,0.227), azul = color(0.027,0.216,0.384);
        const gris = color(0.36,0.42,0.49), borde = color(0.86,0.89,0.93);
        const filaReporte = color(227/255,240/255,250/255);
        const grupoReporte = color(185/255,215/255,236/255);
        const bordeReporte = color(184/255,205/255,221/255);
        const bordeGrupoReporte = color(145/255,175/255,197/255);
        const unidadReporte = color(213/255,231/255,245/255);
        const lineaReporte = color(227/255,237/255,246/255);
        const azulCalendario = color(228/255,242/255,252/255); // #e4f2fc, igual que el portal.
        const bordeCalendario = color(14/255,129/255,197/255); // #0e81c5, borde azul del portal.
        const textoSeguro = texto => Array.from(String(texto).replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/≠/g,'!=').replace(/−/g,'-').replace(/[\u2190-\u21ff]/g,'-').replace(/\s+/g,' ').trim()).map(c => {
            try { regular.encodeText(c); return c; } catch { return ''; }
        }).join('');
        function envolver(texto, ancho, size, font = regular) {
            const resultado = [];
            for (const parrafo of String(texto).split('\n')) {
                let linea = '';
                for (const palabra of textoSeguro(parrafo).split(' ')) {
                    if (!palabra) continue;
                    if (linea && font.widthOfTextAtSize(linea + ' ' + palabra,size) > ancho) { resultado.push(linea); linea = ''; }
                    let resto = palabra;
                    while (font.widthOfTextAtSize(resto,size) > ancho && resto.length > 1) {
                        if (linea) { resultado.push(linea); linea = ''; }
                        let fin = 1;
                        while (fin < resto.length && font.widthOfTextAtSize(resto.slice(0,fin+1),size) <= ancho) fin++;
                        resultado.push(resto.slice(0,fin)); resto = resto.slice(fin);
                    }
                    linea += (linea ? ' ' : '') + resto;
                }
                resultado.push(linea);
            }
            return resultado.length ? resultado : [''];
        }
        let logo;
        if (logoSrc) {
            let src = logoSrc;
            if (window.PortalDatos?.consulta) {
                const p = await PortalDatos.listo;
                const nombre = decodeURIComponent(new URL(src,document.baseURI).pathname.split('/').pop());
                src = p.imagenes[nombre] || src;
            }
            const bytes = src.startsWith('data:') ? Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)) : await (await fetch(src)).arrayBuffer();
            logo = await pdf.embedPng(bytes);
        }
        const muchasColumnas = Array.from(doc.querySelectorAll('table')).some(t => (t.rows[0]?.cells.length || 0) >= 12);
        const ancho = muchasColumnas ? 1190.55 : 841.89, alto = muchasColumnas ? 841.89 : 595.28;
        const margen = 32, disponible = ancho - margen * 2, pie = 34;
        let pagina, y;
        function nuevaPagina() {
            pagina = pdf.addPage([ancho,alto]);
            y = alto - margen;
            if (logo) {
                const medida = logo.scaleToFit(105,44);
                pagina.drawImage(logo,{x:ancho-margen-medida.width,y:y-medida.height,width:medida.width,height:medida.height});
            }
            const tituloLineas = envolver(titulo,disponible-125,18,negrita);
            for (const linea of tituloLineas) { pagina.drawText(linea,{x:margen,y:y-18,size:18,font:negrita,color:azul}); y -= 23; }
            y = Math.min(y-10,alto-margen-52);
            pagina.drawLine({start:{x:margen,y},end:{x:ancho-margen,y},thickness:1,color:borde});
            y -= 14;
            pagina.drawText(`Resiter Minería · Página ${pdf.getPageCount()}`,{x:margen,y:16,size:8,font:regular,color:gris});
        }
        const asegurar = altura => { if (y - altura < pie) nuevaPagina(); };
        function parrafo(texto, size=10, bold=false) {
            const font = bold ? negrita : regular, lineas = envolver(texto,disponible,size,font);
            asegurar(Math.min(lineas.length * (size+4)+8,alto-110));
            for (const linea of lineas) {
                asegurar(size+4);
                pagina.drawText(linea,{x:margen,y:y-size,size,font,color:bold?azul:tinta}); y -= size+4;
            }
            y -= 7;
        }
        const css = el => doc.defaultView.getComputedStyle(el);
        const visible = el => !el.closest('[hidden],.vista-oculta,details:not([open])') && el.getClientRects().length && css(el).display !== 'none' && css(el).visibility !== 'hidden';
        function colorCSS(valor, defecto=tinta) {
            const muestra = doc.createElement('span');
            muestra.style.color = valor;
            doc.body.append(muestra);
            const calculado = css(muestra).color;
            muestra.remove();
            const canales = calculado.match(/[\d.]+/g)?.map(Number);
            if (!canales || canales.length < 3 || canales[3] === 0) return defecto;
            const divisor = calculado.startsWith('color(srgb ') ? 1 : 255;
            return color(...canales.slice(0,3).map(n=>Math.max(0,Math.min(1,n/divisor))));
        }
        function redondeado(x, superior, anchoCaja, altura, radio, fondo, contorno) {
            const w=anchoCaja,h=altura,r=Math.min(radio,w/2,h/2);
            const ruta=`M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
            pagina.drawSvgPath(ruta,{x,y:superior,color:fondo,...(contorno?{borderColor:contorno,borderWidth:0.6}:{})});
        }
        function insignias(elementos) {
            const size=9,altura=24,espacio=8;
            let x=margen;
            asegurar(altura+8);
            for (const el of elementos) {
                const texto=textoSeguro(el.innerText),estilo=css(el);
                const anchoCaja=Math.min(disponible,negrita.widthOfTextAtSize(texto,size)+32);
                if (x+anchoCaja>ancho-margen) {x=margen;y-=altura+espacio;asegurar(altura+8);}
                const tono=colorCSS(estilo.color);
                redondeado(x,y,anchoCaja,altura,12,colorCSS(estilo.backgroundColor,color(1,1,1)));
                pagina.drawCircle({x:x+11,y:y-altura/2,size:3,color:tono});
                pagina.drawText(texto,{x:x+21,y:y-16,size,font:negrita,color:tono});
                x+=anchoCaja+espacio;
            }
            y-=altura+14;
        }
        function tarjetasResumen(el) {
            const tarjetas=Array.from(el.children).filter(visible),columnas=Math.min(5,tarjetas.length);
            if (!columnas) return;
            const espacio=10,anchoTarjeta=(disponible-espacio*(columnas-1))/columnas;
            for (let inicio=0;inicio<tarjetas.length;inicio+=columnas) {
                const fila=tarjetas.slice(inicio,inicio+columnas).map(t=>{
                    const numero=t.querySelector('b,strong'),semaforo=numero?.querySelector('.semaforo');
                    const etiquetas=Array.from(t.children).filter(n=>n!==numero);
                    const etiqueta=etiquetas.map(n=>n.innerText.trim()).filter(Boolean).join(' ');
                    const size=Math.min(22.5,anchoTarjeta/7);
                    return {t,numero,semaforo,size,colorEtiqueta:etiquetas[0]?colorCSS(css(etiquetas[0]).color,gris):gris,valor:envolver(numero?.innerText||t.innerText,anchoTarjeta-(semaforo?44:26),size,negrita),etiqueta:envolver(etiqueta,anchoTarjeta-26,9)};
                });
                const altura=Math.max(82,...fila.map(c=>24+c.valor.length*(c.size+4)+c.etiqueta.length*12+(c.semaforo?12:0)));
                asegurar(altura+12);
                fila.forEach((c,i)=>{
                    const x=margen+i*(anchoTarjeta+espacio),estilo=css(c.t);
                    redondeado(x,y,anchoTarjeta,altura,7.5,colorCSS(estilo.backgroundColor,color(1,1,1)),borde);
                    pagina.drawLine({start:{x:x+2,y:y-7.5},end:{x:x+2,y:y-altura+7.5},thickness:3,color:colorCSS(estilo.getPropertyValue('--kpi-color')||estilo.borderLeftColor,azul)});
                    let textoX=x+13,valorY=y-14;
                    if(c.semaforo){
                        const tono=colorCSS(css(c.semaforo).color),altoPill=c.valor.length*(c.size+4)+8;
                        const anchoPill=Math.min(anchoTarjeta-26,Math.max(...c.valor.map(l=>negrita.widthOfTextAtSize(l,c.size)))+30);
                        redondeado(textoX,y-10,anchoPill,altoPill,12,colorCSS(css(c.semaforo).backgroundColor));
                        pagina.drawCircle({x:textoX+9,y:valorY-c.size/2-2,size:3.4,color:tono});
                        textoX+=18;
                    }
                    const tono=c.semaforo?colorCSS(css(c.semaforo).color):colorCSS(c.numero?css(c.numero).color:estilo.color,azul);
                    c.valor.forEach((linea,j)=>pagina.drawText(linea,{x:textoX,y:valorY-c.size-j*(c.size+4),size:c.size,font:negrita,color:tono}));
                    const etiquetaY=y-22-c.valor.length*(c.size+4)-(c.semaforo?6:0);
                    c.etiqueta.forEach((linea,j)=>pagina.drawText(linea,{x:x+13,y:etiquetaY-9-j*12,size:9,font:regular,color:c.colorEtiqueta}));
                });
                y-=altura+14;
            }
        }
        function itemLeyenda(el) {
            const size = 10, paso = 14, sangria = 14;
            const tono = colorCSS(el.dataset.pdfColor || css(el).color);
            const lineas = envolver(el.dataset.pdfLeyenda, disponible-sangria, size);
            asegurar(Math.min(lineas.length*paso+4,alto-110));
            lineas.forEach((linea,i) => {
                asegurar(paso);
                if (!i) pagina.drawCircle({x:margen+4,y:y-size/2-1,size:3,color:tono});
                pagina.drawText(linea,{x:margen+sangria,y:y-size,size,font:regular,color:tinta});
                y -= paso;
            });
            y -= 4;
        }
        function leyendaSeries(el) {
            const items=Array.from(el.querySelectorAll('[data-pdf-leyenda]')).filter(visible);
            const columnas=Math.min(3,items.length),espacio=14,size=10,paso=14;
            if(!columnas)return;
            const anchoItem=(disponible-espacio*(columnas-1))/columnas;
            for(let inicio=0;inicio<items.length;inicio+=columnas){
                const fila=items.slice(inicio,inicio+columnas).map(item=>({
                    color:colorCSS(item.dataset.pdfColor||css(item).color),
                    lineas:envolver(item.dataset.pdfLeyenda,anchoItem-14,size)
                }));
                const altura=Math.max(...fila.map(item=>item.lineas.length))*paso+5;
                asegurar(altura);
                fila.forEach((item,i)=>{
                    const x=margen+i*(anchoItem+espacio);
                    pagina.drawCircle({x:x+4,y:y-size/2-1,size:3,color:item.color});
                    item.lineas.forEach((linea,j)=>pagina.drawText(linea,{x:x+14,y:y-size-j*paso,size,font:regular,color:tinta}));
                });
                y-=altura;
            }
            y-=7;
        }
        function textoCelda(el) {
            return el.innerText.trim();
        }
        function tabla(filas, cabeceras, columnas, anchos, calendario=false) {
            let size = columnas > 12 ? 8 : 9;
            const medidas = anchos || Array(columnas).fill(disponible / columnas);
            const contornosCalendario = [];
            function prepararFila(fila) {
                let columna = 0;
                return fila.map(celda => {
                    const span = Math.min(celda.span || 1,columnas-columna);
                    const ancho = medidas.slice(columna,columna+span).reduce((a,b)=>a+b,0);
                    const item = {...celda,columna,ancho,lineas:envolver(celda.texto,ancho-(celda.semaforo?25:12),size,celda.bold||celda.semaforo?negrita:regular)};
                    columna += span;
                    return item;
                });
            }
            if (calendario) {
                // Mantiene el mes completo junto, reduciendo solo la tipografía
                // del calendario cuando hay seis semanas o muchas patentes.
                const altura = () => [...cabeceras,...filas].reduce((s,f)=>s+Math.max(1,...prepararFila(f).map(c=>c.lineas.length))*(size+3)+12,0);
                while (size > 6 && altura() > y-pie-14) size -= 0.5;
                if (altura() > y-pie-14) nuevaPagina();
            }
            const paso = size+3;
            function pintarFila(fila, esCabecera=false) {
                const celdas = prepararFila(fila);
                const lineasMax = Math.max(1,...celdas.map(c=>c.lineas.length));
                let inicio = 0;
                while (inicio < lineasMax) {
                    const alturaDeseada = (lineasMax-inicio)*paso+12;
                    if (alturaDeseada <= alto-130 && y-alturaDeseada < pie) {
                        nuevaPagina();
                        if (!esCabecera) cabeceras.forEach(f=>pintarFila(f,true));
                    }
                    if (y-paso-12 < pie) {
                        nuevaPagina();
                        if (!esCabecera) cabeceras.forEach(f=>pintarFila(f,true));
                    }
                    const cantidad = Math.max(1,Math.min(lineasMax-inicio,Math.floor((y-pie-12)/paso)));
                    const altura = cantidad*paso+12;
                    let x = margen;
                    for (const celda of celdas) {
                        const fondo = celda.fondoCelda || (esCabecera ? color(0.88,0.93,0.97) : celda.total ? azul : celda.region ? (celda.tablaDetallada ? grupoReporte : color(0.88,0.93,0.97)) : celda.unidad ? unidadReporte : celda.linea ? lineaReporte : celda.alerta ? color(1,241/255,240/255) : celda.programado ? azulCalendario : celda.alterna ? filaReporte : color(1,1,1));
                        pagina.drawRectangle({x,y:y-altura,width:celda.ancho,height:altura,color:fondo,borderColor:celda.tablaDetallada ? bordeReporte : borde,borderWidth:celda.tablaDetallada ? 0.7 : 0.4});
                        if (celda.programado) contornosCalendario.push({pagina,x,y:y-altura,width:celda.ancho,height:altura});
                        if(celda.semaforo){
                            const indicador=celda.semaforo;
                            const altoPill=Math.min(altura-6,celda.lineas.slice(inicio,inicio+cantidad).length*paso+6);
                            redondeado(x+3,y-3,celda.ancho-6,altoPill,8,indicador.fondo);
                            pagina.drawCircle({x:x+11,y:y-3-altoPill/2,size:2.5,color:indicador.color});
                        }
                        celda.lineas.slice(inicio,inicio+cantidad).forEach((linea,i)=>{
                            const font=esCabecera||celda.bold||celda.semaforo?negrita:regular;
                            const textoX=celda.derecha?x+celda.ancho-6-font.widthOfTextAtSize(linea,size):x+(celda.semaforo?19:6);
                            pagina.drawText(linea,{x:textoX,y:y-6-size-i*paso,size,font,color:celda.colorTexto||celda.semaforo?.color||(celda.alerta?color(180/255,35/255,24/255):celda.total?color(1,1,1):tinta)});
                        });
                        x += celda.ancho;
                    }
                    if (celdas.some(c => c.tablaDetallada)) {
                        const grupo = celdas.some(c => c.region);
                        pagina.drawLine({start:{x:margen,y:y-altura},end:{x,y:y-altura},thickness:grupo ? 1.1 : 0.7,color:grupo ? bordeGrupoReporte : bordeReporte});
                    }
                    y -= altura; inicio += cantidad;
                }
            }
            const alturaFila = f => Math.max(1,...prepararFila(f).map(c=>c.lineas.length))*paso+12;
            asegurar(Math.min(cabeceras.reduce((s,f)=>s+alturaFila(f),0)+(filas[0]?alturaFila(filas[0]):0),alto-130));
            cabeceras.forEach(f=>pintarFila(f,true));
            filas.forEach(f=>pintarFila(f));
            // Dibuja los cuatro lados al final para que las celdas vecinas no tapen el borde.
            for (const {pagina:hoja,...rectangulo} of contornosCalendario) {
                hoja.drawRectangle({...rectangulo,borderColor:bordeCalendario,borderWidth:0.8});
            }
            y -= 14;
        }
        function tablaHTML(el) {
            asegurar(100);
            const caption = el.querySelector('caption');
            if (caption?.textContent.trim()) parrafo(caption.textContent,11,true);
            const filas = Array.from(el.rows).filter(visible);
            const columnas = Math.max(1,...filas.map(f=>Array.from(f.cells).filter(visible).reduce((s,c)=>s+c.colSpan,0)));
            const primera = filas.find(f=>Array.from(f.cells).filter(visible).length===columnas);
            const anchuras = primera ? Array.from(primera.cells).filter(visible).map(c=>c.getBoundingClientRect().width) : [];
            const suma = anchuras.reduce((a,b)=>a+b,0);
            const min = Math.min(55,disponible/columnas * 0.7);
            const libres = disponible - columnas*min;
            const anchos = suma ? anchuras.map(n=>min+libres*n/suma) : null;
            const reportabilidad=doc.body.dataset.panel==='reportabilidad';
            const seguimiento=doc.body.dataset.panel==='seguimiento';
            const resumen=doc.body.dataset.panel==='resumen';
            const programa=doc.body.dataset.panel==='programa';
            const calendario=doc.body.dataset.panel==='calendario'&&!el.classList.contains('calendario');
            const tablaDetallada=reportabilidad||seguimiento||resumen||calendario||programa;
            let indiceFila=0;
            const contenido = filas.map(f=>{
                const cabecera=f.parentElement.tagName==='THEAD',total=f.parentElement.tagName==='TFOOT';
                const region=f.classList.contains('region')||seguimiento&&f.classList.contains('km-grupo-region');
                const unidad=seguimiento&&f.classList.contains('km-grupo-unidad')||calendario&&f.classList.contains('mt-agenda-unidad');
                const linea=seguimiento&&f.classList.contains('km-grupo')&&f.classList.contains('zona-linea')||calendario&&f.classList.contains('zona-linea');
                const alterna=tablaDetallada&&!cabecera&&!total&&!region&&!unidad&&!linea&&indiceFila++%2===1;
                return {cabecera,celdas:Array.from(f.cells).filter(visible).map((c,i)=>{
                    const indicador=tablaDetallada?c.querySelector('.semaforo'):null;
                    const semaforo=indicador?{color:colorCSS(css(indicador).color),fondo:colorCSS(css(indicador).backgroundColor)}:null;
                    const estadoColor=['mt-rojo','mt-amarillo','mt-verde','mt-gris'].some(clase=>c.classList.contains(clase));
                    const fondoCelda=estadoColor?colorCSS(css(c).backgroundColor,null):null;
                    const colorTexto=estadoColor?colorCSS(css(c).color):null;
                    return {texto:semaforo&&reportabilidad?textoCelda(c).split(' · ')[0]:textoCelda(c),span:c.colSpan,bold:c.tagName==='TH'||region||unidad||linea||total,region,unidad,linea,total,alterna,semaforo,tablaDetallada,fondoCelda,colorTexto,alerta:seguimiento&&c.classList.contains('km-uso-alerta'),derecha:tablaDetallada&&!cabecera&&i>0&&(!calendario||i===columnas-2),programado:el.classList.contains('calendario')&&c.classList.contains('programado')};
                })};
            });
            tabla(contenido.filter(f=>!f.cabecera).map(f=>f.celdas),contenido.filter(f=>f.cabecera).map(f=>f.celdas),columnas,anchos,el.classList.contains('calendario'));
        }
        async function figura(img) {
            const canvas = doc.createElement('canvas');
            canvas.width = Math.ceil(img.width*2); canvas.height = Math.ceil(img.height*2);
            if (!canvas.width || !canvas.height) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
            const imagen = await pdf.embedPng(canvas.toDataURL('image/png'));
            const medida = imagen.scaleToFit(disponible,240);
            asegurar(medida.height+12);
            pagina.drawImage(imagen,{x:margen,y:y-medida.height,...medida}); y -= medida.height+14;
            canvas.width=canvas.height=0;
        }
        async function recorrer(el) {
            if (!visible(el)) return;
            if (el.dataset.vista==='reportabilidad.tabla') nuevaPagina();
            if (el.dataset.pdfLeyenda) { itemLeyenda(el); return; }
            if ((el.classList.contains('leyenda') || el.id==='leyenda-estados') && el.querySelector('[data-pdf-leyenda]')) {
                if(['reportabilidad','programa'].includes(doc.body.dataset.panel)){
                    leyendaSeries(el);
                    for(const hijo of el.children) if(!hijo.dataset.pdfLeyenda) await recorrer(hijo);
                    return;
                }
                for (const hijo of el.children) await recorrer(hijo);
                y -= 7;
                return;
            }
            if (el.classList.contains('leyenda') && el.querySelector('.semaforo')) {insignias(Array.from(el.children).filter(visible));return;}
            if (el.classList.contains('tabla-patentes')) nuevaPagina();
            if (el.classList.contains('kpis')) {
                tarjetasResumen(el);return;
            }
            if (el.tagName==='FIGURE') {
                const img = el.querySelector('img');
                if (img && visible(img)) asegurar(Math.min(240,img.height*disponible/img.width)+(el.dataset.pdfDescripcion?90:50));
            }
            if (el.tagName==='DETAILS' && el.dataset.vista) {
                const img = el.querySelector('img');
                if (img && visible(img)) asegurar(Math.min(240,img.height*disponible/img.width)+50);
            }
            if (el.tagName==='TABLE') { tablaHTML(el); return; }
            if (el.id==='mt-cal-grid') {
                const celdas = Array.from(el.children);
                const cabecera = celdas.slice(0,7).map(c=>({texto:c.innerText,bold:true}));
                const filas=[];
                for (let i=7;i<celdas.length;i+=7) filas.push(celdas.slice(i,i+7).map(c=>({texto:c.innerText,programado:c.classList.contains('programado')})));
                tabla(filas,[cabecera],7,null,true); return;
            }
            if (el.tagName==='IMG') { await figura(el); return; }
            if (el.classList.contains('kpi')) { parrafo(el.innerText.split('\n').filter(Boolean).join(': '),11,true); return; }
            if (/^(H[1-6]|SUMMARY|FIGCAPTION)$/.test(el.tagName)) { asegurar(60); parrafo(el.innerText,12,true); return; }
            if (/^(P|FOOTER|LEGEND)$/.test(el.tagName) || el.classList.contains('leyenda')) { if (el.innerText.trim()) parrafo(el.innerText); return; }
            if (el.tagName==='LABEL') {
                const casilla = el.querySelector('input[type=checkbox]');
                if (casilla) parrafo(`${casilla.checked?'[x]':'[ ]'} ${el.innerText}`);
                else if (!el.querySelector('select,input,textarea')) parrafo(el.innerText);
                return;
            }
            if (!el.children.length) { if (el.innerText.trim()) parrafo(el.innerText); return; }
            for (const hijo of el.children) {
                await recorrer(hijo);
                if (['FIGCAPTION','SUMMARY'].includes(hijo.tagName)&&el.dataset.pdfDescripcion) parrafo(el.dataset.pdfDescripcion,9);
            }
        }
        nuevaPagina();
        for (const filtro of filtros) parrafo(filtro,10);
        if (filtros.length) y -= 8;
        for (const el of doc.body.children) await recorrer(el);
        return pdf;
    }

    async function descargar({html, nombre, titulo}) {
        if (ocupado) return;
        ocupado = true;
        const botones = Array.from(document.querySelectorAll('#descargar-pdf,#mt-exportar-informe'));
        const estados = botones.map(el => el.disabled);
        botones.forEach(el => el.disabled = true);
        const estado = document.getElementById('pdf-estado');
        if (estado) estado.textContent = 'Generando PDF…';
        let captura;
        try {
            if (!window.PDFLib) throw new Error('Recarga el portal. Si el problema continúa, reinicia Iniciar_Panel.bat.');
            const tituloInforme = document.querySelector('h1')?.textContent || titulo;
            const filtros = filtrosInforme();
            const logoSrc = document.querySelector('header .logo')?.src;
            captura = await preparar(html ? null : document, html);
            const pdf = await crearInforme(captura.doc,tituloInforme,filtros,logoSrc);
            const url = URL.createObjectURL(new Blob([await pdf.save()], {type:'application/pdf'}));
            const enlace = document.createElement('a');
            enlace.href = url; enlace.download = nombre;
            document.body.append(enlace); enlace.click(); enlace.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            if (estado) estado.textContent = 'PDF generado. Revisa las descargas del navegador.';
        } catch (error) {
            if (estado) estado.textContent = `No se pudo generar el PDF: ${error.message}`;
            else alert(`No se pudo generar el PDF: ${error.message}`);
        } finally {
            captura?.marco.remove();
            botones.forEach((el,i) => el.disabled = estados[i]);
            ocupado = false;
        }
    }
    window.PanelPDF = {descargar};
    const boton = document.getElementById('descargar-pdf');
    if (boton) boton.onclick = () => descargar({nombre:`Panel_${document.body.dataset.panel || 'Configuraciones'}_${new Date().toLocaleDateString('sv-SE')}.pdf`});
})();
