# Tecma Despachos

Aplicación instalable en español de Chile. HTML, CSS y JavaScript sin compilación, servidor de datos ni cuenta de usuario. Los CSV se procesan en el dispositivo. Las cargas quedan en IndexedDB; los documentos sólo salen cuando eliges compartirlos o descargarlos.

**Para comenzar:** abre `GUIA.html`, incluida junto a este archivo, y sigue los pasos para publicar en GitHub Pages. Abrir `index.html` con doble clic no habilita la instalación, el modo sin conexión ni todos los permisos de cámara; usa la dirección HTTPS de GitHub Pages.

## Archivos

- `index.html`: entrada de la aplicación.
- `styles.css`: interfaz adaptable, botones de al menos 48 px y estados de alto contraste.
- `app.js`: pantallas, captura Bluetooth, cámara, formularios, compartir e instalación sin conexión.
- `core.js`: importación CSV, IndexedDB, historial, respaldo, restauración y reglas de estado.
- `reports.js`: PDF carta y exportación de códigos.
- `manifest.json`, `sw.js`: instalación y caché local.
- `icons/`: iconos normales, maskable y Apple.
- `lib/`: las cinco bibliotecas completas, sus licencias y versiones con SHA-256. No hay CDN en tiempo de uso.
- `ejemplo.csv`, `ejemplo-comas.csv`: los mismos 8 productos de 3 obras con ambos separadores.
- `GUIA.html`: instrucciones de publicación, instalación y uso.
- `PRUEBAS.md`: resultados y límites de la verificación.
- `.nojekyll`: publica los archivos directamente en GitHub Pages.

## Reglas de datos

Cada fila con número es una etiqueta, cantidad 1. Se conserva el número como texto de seis dígitos (incluyendo ceros al comienzo). Se aceptan BOM UTF-8, separador coma o punto y coma, encabezados sin distinción de mayúsculas/tildes/espacios y CSV Windows-1252 de Excel. Se ignoran filas sin número. Filas idénticas repetidas en la misma obra y OP cuentan una vez; datos contradictorios en archivos de una importación muestran un error. Agregar CSV a una carga conserva los estados y descripciones ya registrados y omite números que esa obra ya contiene. Números presentes en obras distintas piden elegir la obra al leerlos.

Los cambios de estado y su historial se confirman juntos en una transacción. El aviso verde se muestra sólo después de guardar. Deshacer restaura el estado anterior de la última lectura que aún se puede deshacer; si se había cambiado un «no enviado» a «cargado», vuelve a «no enviado» con su motivo. Un producto editado después no se sobreescribe al deshacer.

Los PDF para guías usan sólo cargados más accesorios. La cantidad de productos es un conteo de etiquetas, agrupadas por tipo, descripción de salida, orden y atril. Las líneas manuales conservan su orden. La fecha es la de cierre, o la de creación mientras la carga está abierta. El PDF de control incluye todas las secciones y sus totales. El nombre del control comienza con `Control_` para no sobrescribir el despacho.

Los respaldos JSON incluyen cargas, obras, productos, accesorios e historial. Restaurar agrega copias completas y conserva las cargas existentes. Cada copia recibe identificadores nuevos y relaciones coherentes, incluyendo el historial de deshacer. No borres los datos del navegador sin exportar un respaldo: el almacenamiento local no es una copia en la nube y el sistema puede limpiarlo si necesita espacio.

## Modo sin conexión y actualizaciones

Abre la app con internet y espera «Lista para usar sin conexión». Todos los archivos de funcionamiento, bibliotecas e instrucciones se precargan. Las consultas de los datos son locales. Para actualizar archivos, cambia también `VERSION` en `sw.js`, publica todos los archivos y abre con conexión. Cuando aparezca la actualización, cierra todas las ventanas y vuelve a abrir. La nueva versión se activa sin borrar IndexedDB. El caché está separado por ruta, para no borrar otras aplicaciones del mismo dominio.

## Compatibilidad práctica

Usa Chrome Android o Safari iPhone actualizados. La cámara necesita HTTPS y permiso; intenta usar la trasera y decodifica CODE_128, CODE_39 e ITF. La linterna aparece sólo cuando la cámara expone esa capacidad. Los lectores Bluetooth deben estar en modo teclado (HID), enviar los seis dígitos y terminar con Enter. Los avisos no dependen del audio: iPhone/Safari puede no ofrecer vibración y el sonido necesita una interacción inicial y volumen habilitado. La función de compartir depende del navegador; cuando no está disponible se descarga el archivo.

## Desarrollo opcional

No requiere npm ni compilación. Para pruebas locales en computador se puede servir esta carpeta con `python -m http.server 8080` y abrir `http://localhost:8080/`. Esto no reemplaza HTTPS para un teléfono conectado a otra dirección de red. No se incluyen dependencias de pruebas dentro de la app.
