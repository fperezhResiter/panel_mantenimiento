/* Descarga una copia visual de la selección actual. Bibliotecas locales, sin CDN. */
(() => {
    'use strict';
    let ocupado = false;
    const pausa = () => new Promise(resolve => requestAnimationFrame(resolve));

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

    async function preparar(vista, html) {
        // Congela datos, filtros, filas contraídas y preferencias antes de esperar.
        const copia = vista ? vista.documentElement.cloneNode(true) : new DOMParser().parseFromString(html, 'text/html').documentElement;
        if (vista) copiarEstado(vista, copia);
        copia.querySelectorAll('script,nav,.volver-inicio,[data-pdf-omitir],#bd-barra').forEach(el => el.remove());
        // Las celdas del calendario son botones, pero sí forman parte del informe.
        copia.querySelectorAll('button:not(.mt-cal-dia),input[type=submit]').forEach(el => {
            // Los nombres de región, CeCo y patente son botones de navegación
            // dentro de las tablas: conserva su contenido en la descarga.
            if (el.closest('td,th')) {
                const texto = el.ownerDocument.createElement('span');
                texto.className = el.className;
                texto.innerHTML = el.innerHTML;
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
            `;
            doc.head.append(estilo);
            await Promise.all(Array.from(doc.querySelectorAll('link[rel=stylesheet]')).map(el => new Promise((resolve, reject) => {
                if (el.sheet) return resolve();
                el.onload = resolve;
                el.onerror = () => reject(new Error('No se pudo cargar el diseño del panel. Recarga el portal.'));
            })));
            await doc.fonts.ready;
            await pausa();
            // html2canvas rasteriza SVG como imágenes; conserva los estilos del gráfico.
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
            await Promise.all(Array.from(doc.images).map(img => img.decode()));
            await pausa();
            return {marco, doc, ancho};
        } catch (error) { marco.remove(); throw error; }
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
            if (!window.PDFLib || !window.html2canvas) throw new Error('Recarga el portal. Si el problema continúa, reinicia Iniciar_Panel.bat.');
            captura = await preparar(html ? null : document, html);
            const {doc, ancho} = captura;
            const pdf = await PDFLib.PDFDocument.create();
            pdf.setTitle(titulo || document.querySelector('h1').textContent);
            pdf.setAuthor('Resiter Minería');
            // En tablas KM-HR muy anchas conserva un tamaño legible de letra.
            const paginaAncho = Math.max(ancho > 1700 ? 1190.55 : 841.89, ancho * 0.6 + 48);
            const paginaAlto = ancho > 1700 ? 841.89 : 595.28;
            const margen = 24, escala = (paginaAncho - 2 * margen) / ancho;
            const altoMax = Math.floor((paginaAlto - 2 * margen - 14) / escala);
            let alto, bloques, saltos;
            // Evita cortar filas, gráficos e indicadores; los elementos mayores
            // que una página se continúan para no perder contenido.
            // Mide en el clon que renderiza html2canvas: su tratamiento de los
            // estilos de tablas puede diferir del iframe original.
            const opciones = {backgroundColor:'#ffffff',scale:1.5,logging:false,
                width:ancho,windowWidth:ancho,windowHeight:900,scrollX:0,scrollY:0};
            const prueba = await html2canvas(doc.body, {...opciones,height:1,x:0,y:0,onclone: clon => {
                const origenY = clon.body.getBoundingClientRect().top;
                alto = Math.ceil(clon.body.scrollHeight);
                bloques = Array.from(clon.querySelectorAll('tr,.kpi,.mt-cal-dia,img,h1,h2,h3,summary,figure')).map(el => {
                    const r = el.getBoundingClientRect();
                    return {top:r.top-origenY,bottom:r.bottom-origenY,height:r.height};
                }).filter(r => r.height > 0 && r.height <= altoMax);
                saltos = html ? Array.from(clon.querySelectorAll('.tabla-patentes')).map(el => el.getBoundingClientRect().top-origenY) : [];
            }});
            prueba.width = prueba.height = 0;
            for (let y = 0; y < alto;) {
                let fin = Math.min(y + altoMax, alto);
                let escalaPagina = escala;
                if (html && y === 0 && saltos.length) {
                    // El mes completo ocupa la primera página, también cuando
                    // tiene seis semanas o varias patentes en un mismo día.
                    fin = Math.ceil(saltos[0]);
                    escalaPagina = Math.min(escala, (paginaAlto-2*margen-14)/fin);
                } else {
                    const salto = saltos.find(top => top > y + 1 && top < fin);
                    if (salto) fin = Math.floor(salto);
                    let cruce;
                    do {
                        cruce = bloques.filter(r => r.top < fin-1 && r.bottom > fin+1 && r.top > y + 40);
                        if (cruce.length) fin = Math.ceil(Math.min(...cruce.map(r => r.top)));
                    } while (cruce.length);
                }
                const canvas = await html2canvas(doc.body, {...opciones,height:fin-y,x:0,y});
                const imagen = await pdf.embedPng(canvas.toDataURL('image/png'));
                const pagina = pdf.addPage([paginaAncho, paginaAlto]);
                const h = (fin-y)*escalaPagina;
                pagina.drawImage(imagen, {x:margen,y:paginaAlto-margen-h,width:ancho*escalaPagina,height:h});
                pagina.drawText(`Página ${pdf.getPageCount()}`, {x:margen,y:12,size:8});
                canvas.width = canvas.height = 0;
                y = fin;
            }
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
