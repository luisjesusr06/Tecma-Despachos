# Tecma Despachos 3.0.0

Actualización sobre Tecma Despachos 2.1.0. Conserva diseño, bibliotecas locales, lector y generador de PDF. No requiere servidor ni cuenta.

## Actualizar

Consulta ACTUALIZAR.html. Publica el contenido completo de esta carpeta en la misma dirección de GitHub Pages, incluidos los nuevos obras.js y obras-ui.js. Conserva el perfil del navegador y los datos del sitio. No hay que restaurar un respaldo para actualizar.

Con internet, abre la app, pulsa Buscar actualización, cierra todas sus ventanas y pestañas y vuelve a abrirla. Comprueba Versión 3.0.0 y Lista para usar sin conexión en ambos equipos.

## Obras y despachos

- Obras es el inicio del teléfono. Importa una vez el CSV completo del Zebra, con todas las OFI. Un archivo con varias obras crea sus catálogos por nombre y OP.
- Las cargas anteriores quedan en Cargas antiguas, en solo lectura, con productos, notas, historial, accesorios y PDF. No se convierten ni se suman al avance de las obras nuevas.
- Nuevo despacho crea un viaje dentro de una obra. Fecha, chofer, RUT y patente son opcionales. El foco puede ser una OFI, varias o todas; solo filtra la vista. El escáner busca en el catálogo completo de esa obra.
- Una pieza fuera del foco carga en verde, con el sonido y vibración normales, y añade «OFI … · fuera del foco». Una pieza enviada en un despacho anterior carga igual con la señal celeste. El desconocido mantiene las tres opciones, incluida Agregar como producto.
- El producto desconocido queda cargado antes del formulario opcional y se añade al catálogo para los siguientes viajes. Sin descripción imprime SIN DESCRIPCIÓN. Cerrar el formulario devuelve el foco al lector.
- El selector fijo permite revisar otra OFI sin abandonar el escáner. Productos mantiene búsqueda instantánea, filtros y agrupación por OFI y tipo.
- Los PDF están disponibles con el despacho abierto y sin completar campos. reports.js es idéntico a 2.1.0. Los cargados de todas las OFI se incluyen aunque no estén en el foco. Al cerrar se preparan guía, control y códigos escaneados; ya no hay un archivo de cierre individual en la interfaz.
- Despachos anteriores permite continuar viajes abiertos y regenerar PDF. Material suelto reúne únicamente líneas manuales de viajes cerrados, agrupadas por descripción y unidad, con totales y fechas.
- El avance usa el último envío o devolución de cada número en despachos cerrados. Los viajes en curso no cuentan aún como enviados. Devueltos tiene su propio segmento.

## Actualizar desde Zebra

La identidad de obra usa nombre y OP; la de producto, el número normalizado del código de barras. Una obra existente muestra el resumen antes de guardar. Aplicar fusiona y Cancelar no escribe nada. Los existentes conservan estados, fechas, notas e historial; solo cambian descripción, tipo y OFI del catálogo. Los nuevos ingresan pendientes. Los ausentes se conservan con la señal «ya no está en el Zebra», incluso con CSV parcial; la señal desaparece si vuelven a aparecer. Se conserva la fecha de actualización.

Cada despacho guarda sus propios datos: actualizar el catálogo no cambia sus documentos históricos. Los nuevos números quedan disponibles en un despacho abierto sin restringir el escáner por el foco.

La lectura acepta BOM UTF-8, UTF-16 LE y UTF-16 BE; sin BOM intenta UTF-8 estricto y vuelve a Windows-1252 si los bytes son inválidos o hay caracteres de reemplazo. La detección de separador y la normalización del número mantienen su implementación anterior.

## Registro para la laptop

Exportar todo lo enviado genera Registro_Tecma_AAAA-MM-DD.txt, JSON con MIME text/plain. Incluye todas las obras nuevas, catálogo con estados, despachos, productos, fechas, movimientos, devoluciones y material suelto. Conserva también viajes en curso en el archivo; Control solo los incorpora como envíos cuando estén cerrados. Las cargas antiguas permanecen en el respaldo completo y su archivo de consulta.

En Control, Importar Registro_Tecma o cierres acepta el registro acumulado y cierres antiguos .txt/.json. Identifica obras por nombre y OP, viajes por identidad estable y productos por número. Repetir no duplica productos, movimientos ni accesorios; una exportación posterior incorpora cambios y una anterior no revierte viajes más recientes. Renombrar conserva el nombre de origen. Si ya hay duplicados antiguos, se reutiliza el previamente vinculado o, en su defecto, el más antiguo.

Control conserva vista por OFI, productos, notas, accesorios y MIT, devoluciones, pegar números, renombrar y eliminar. Se retiró Preparar próxima carga y su exportación CSV. No existe sincronización automática: envía e importa el registro cuando lo necesites. Compartir usa el selector del sistema; las aplicaciones disponibles dependen del dispositivo. Si no es posible, se descarga el archivo y se explica dónde buscarlo.

## Conservación y respaldo

TecmaDespachos_v1 pasa al esquema 3: añade projects, catalog e índices de relación, sin reescribir filas anteriores. TecmaControl_v1 pasa al esquema 2: añade records para conservar la identidad de importación y los datos originales. No cambia el nombre de las bases.

El respaldo completo versión 3 incluye ambas bases: obras, catálogos, despachos, cargas antiguas, notas, accesorios, eventos y Control. Sigue aceptando versiones 1 y 2, .txt o .json. Restaurar valida primero y agrega copias sin borrar originales; remapea relaciones y conserva la identidad de los despachos para no duplicar sus envíos al reexportarlos.

Cerrar un despacho o importar un registro/cierre prepara un respaldo TXT y ofrece guardarlo sin interrumpir el escáner ni condicionar los PDF. La fecha del inicio indica el último respaldo generado: compártelo o descárgalo para tener una copia fuera de la app. Después de siete días aparece un recordatorio discreto. Se solicita almacenamiento persistente al iniciar, sin bloquear si se rechaza.

El service worker conserva su estrategia y solo cambia a 3.0.0 y precarga los dos módulos nuevos. Todos los recursos siguen siendo locales. No hay login, analítica ni envíos automáticos. No borres datos del sitio, no desinstales para actualizar y no publiques una versión anterior después de actualizar las bases.

## Archivos y pruebas

core.js: datos, CSV, transacciones y respaldos. obras.js: catálogo, despachos y registro. obras-ui.js: pantallas de obras. app.js: interfaz y escaneo. control.js y control-ui.js: Control. reports.js y styles.css permanecen idénticos a 2.1.0, igual que manifest, iconos y bibliotecas.

PRUEBAS.md describe las 79 comprobaciones automatizadas, la comparación de PDF y los límites de la verificación.
