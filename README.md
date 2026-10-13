# Tecma Despachos 3.1.0

Actualización sobre Tecma Despachos 3.0.0. Conserva diseño, bibliotecas locales, lector y generador de PDF. No requiere servidor ni cuenta.

## Actualizar

Consulta ACTUALIZAR.html. Publica el contenido completo de esta carpeta en la misma dirección de GitHub Pages, incluidos los nuevos obras.js y obras-ui.js. Conserva el perfil del navegador y los datos del sitio. No hay que restaurar un respaldo para actualizar.

Con internet, abre la app, pulsa Buscar actualización, cierra todas sus ventanas y pestañas y vuelve a abrirla. Comprueba Versión 3.1.0 y Lista para usar sin conexión en ambos equipos.

## Integración inicial automática

Al abrir 3.1.0, si hay cargas anteriores y aún no se completó la integración, aparece una bienvenida con el número de cargas y el único botón Comenzar. Si no hay cargas anteriores, abre directamente Obras sin mensaje.

Comenzar genera un respaldo completo TXT y ofrece Compartir o Descargar antes de modificar los datos. La integración comienza al terminar de compartir o al iniciar la descarga. Si se cancela el selector de compartir, no se modifica nada. El navegador no permite verificar que el archivo descargado se haya guardado físicamente: revisa Descargas.

Se deducen nombre, OP, OFI y catálogo de los datos existentes. Cada carga se convierte en un despacho, conservando fecha original, chofer, RUT, patente, productos, horas, notas, accesorios y devoluciones. Las cargas con varias obras u OP se reparten entre sus obras, sin duplicar las piezas ni las líneas manuales. Si una línea manual estaba atribuida a una OP combinada, se conserva esa atribución sin adivinar otra. Los datos anteriores se sustituyen por los despachos integrados; no queda una copia antigua en otra pantalla.

Los registros anteriores que estaban abiertos también se integran como viajes históricos cerrados, usando su fecha original. Sus piezas pendientes siguen pendientes; no se inventan escaneos. Las obras que ya existían se reutilizan por nombre y OP y conservan su catálogo actual.

Toda la conversión y la marca de completado se guardan juntas. Si algo falla, se revierte la operación completa; se muestra el error y el respaldo generado sigue disponible. Si otra ventana cambió los datos desde el respaldo, se solicita generar uno actualizado antes de continuar. Dos intentos simultáneos no duplican la conversión.

La marca viaja en los respaldos posteriores. Reabrir o restaurar uno de esos respaldos no repite la bienvenida. La restauración de un respaldo anterior integra sus copias dentro de la propia restauración, sin habilitar una pantalla antigua ni un botón de migración. La marca pertenece a los datos locales: borrar todo el almacenamiento borra también la marca y los datos; restaurar un respaldo posterior la recupera. No existe una identificación externa del dispositivo.

## Catálogo incompleto

Las obras deducidas muestran Catálogo incompleto y el texto que invita a importar el CSV completo del Zebra. Se muestran cantidades conocidas, con barra sin porcentaje global ni relleno que sugiera que la obra está terminada. La señal también viaja al Control cuando se crea allí desde el registro. Un catálogo de Control que ya vino de Zebra no se degrada.

Para completar una obra deducida, importa el CSV de toda esa obra. Al aplicar la fusión se conservan sus despachos y devoluciones, se añaden los productos faltantes y se quita la señal automáticamente. El CSV aplicado se toma como catálogo de referencia de la obra.

## Obras y despachos

- Obras es el inicio del teléfono. Importa una vez el CSV completo del Zebra, con todas las OFI. Un archivo con varias obras crea sus catálogos por nombre y OP.
- Las cargas anteriores se integran una sola vez como despachos dentro de sus obras, con respaldo previo. No existe un archivo ni un menú separado para ellas.
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

Exportar todo lo enviado genera Registro_Tecma_AAAA-MM-DD.txt, JSON con MIME text/plain. Incluye todas las obras nuevas, catálogo con estados, despachos, productos, fechas, movimientos, devoluciones y material suelto. Conserva también viajes en curso en el archivo; Control solo los incorpora como envíos cuando estén cerrados. Los despachos integrados también se incluyen en el registro, con su historial y su identidad original.

En Control, Importar Registro_Tecma o cierres acepta el registro acumulado y cierres antiguos .txt/.json. Identifica obras por nombre y OP, viajes por identidad estable y productos por número. Repetir no duplica productos, movimientos ni accesorios; una exportación posterior incorpora cambios y una anterior no revierte viajes más recientes. Renombrar conserva el nombre de origen. Si ya hay duplicados antiguos, se reutiliza el previamente vinculado o, en su defecto, el más antiguo.

Control conserva vista por OFI, productos, notas, accesorios y MIT, devoluciones, pegar números, renombrar y eliminar. Se retiró Preparar próxima carga y su exportación CSV. No existe sincronización automática: envía e importa el registro cuando lo necesites. Compartir usa el selector del sistema; las aplicaciones disponibles dependen del dispositivo. Si no es posible, se descarga el archivo y se explica dónde buscarlo.

## Conservación y respaldo

Se conservan TecmaDespachos_v1 en esquema 3 y TecmaControl_v1 en esquema 2. La integración transforma los registros anteriores en una única transacción, sin crear una base alternativa. No cambia el nombre ni el esquema de las bases respecto de 3.0.0.

El respaldo completo versión 3 incluye ambas bases: obras, catálogos, despachos, notas, accesorios, eventos y Control. Sigue aceptando versiones 1 y 2, .txt o .json. Restaurar valida primero y agrega copias sin borrar originales; remapea relaciones y conserva la identidad de los despachos para no duplicar sus envíos al reexportarlos.

Cerrar un despacho o importar un registro/cierre prepara un respaldo TXT y ofrece guardarlo sin interrumpir el escáner ni condicionar los PDF. La fecha del inicio indica el último respaldo generado: compártelo o descárgalo para tener una copia fuera de la app. Después de siete días aparece un recordatorio discreto. Se solicita almacenamiento persistente al iniciar, sin bloquear si se rechaza.

El service worker conserva su estrategia y solo cambia a 3.1.0 y conserva la precarga de todos los módulos. Todos los recursos siguen siendo locales. No hay login, analítica ni envíos automáticos. No borres datos del sitio, no desinstales para actualizar y no publiques una versión anterior después de actualizar las bases.

## Archivos y pruebas

core.js: datos, CSV, transacciones y respaldos. obras.js: catálogo, despachos y registro. obras-ui.js: pantallas de obras. app.js: interfaz y escaneo. control.js y control-ui.js: Control. reports.js y styles.css permanecen idénticos a 2.1.0, igual que manifest, iconos y bibliotecas.

PRUEBAS.md describe las 93 comprobaciones automatizadas, la comparación de PDF y los límites de la verificación.
