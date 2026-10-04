# Tecma Despachos 2.1.0

Actualización sobre la app original de este chat. Vanilla JavaScript, las mismas bibliotecas locales y el mismo diseño base.

## Publicar y usar

Abre ACTUALIZAR.html para las instrucciones paso a paso de GitHub Pages, actualización sin borrar datos e instalación en Windows. El directorio que se publica es el que contiene index.html. No subas el ZIP sin extraer.

## Cargas

- Una obra y un CSV por carga nueva; primera obra si el CSV contiene varias.
- Inicio: Preparadas, En curso y Cerradas, con nombre de obra, OFI, fecha y etiqueta opcional.
- Carga activa: pendiente/cargado. Notas opcionales. Los registros históricos admiten devuelto/trasladado para devoluciones y arrastres.
- El PDF está disponible sin cerrar ni completar datos. El aviso rojo de códigos válidos ausentes del CSV permite seguir escaneando, agregar como accesorio o agregar como producto cargado inmediatamente. Tipo, descripción y OFI son opcionales y se pueden editar después. Sin descripción se imprime SIN DESCRIPCIÓN. Los agregados usan productos e historial normales, no accesorios; el PDF de control tiene una sección propia.
- Arrastre optativo de pendientes y devueltos de cargas cerradas de la misma obra.
- Escaneo por cámara, Bluetooth HID + Enter o manual. Visor con destello, marco, contador e historial corto; señales diferenciadas.
- Detalle: OFI en orden natural, Sin OFI al final, grupos por tipo y avance cargado/total. El sufijo numérico del Tipo entre paréntesis se oculta únicamente en el encabezado de pantalla: se conserva el texto original en datos, grupos y PDF. Búsqueda instantánea combinada con filtros, insensible a mayúsculas y tildes.
- Al cerrar se generan guía, control, CSV de códigos y cierre TXT (JSON versión 1; MIME text/plain). Las devoluciones posteriores aparecen al volver a generar el cierre. Compartir invoca el selector del sistema por acción del usuario; su lista de aplicaciones depende del dispositivo. Cuando compartir falla se inicia descarga con aviso de nombre y ubicación.

## Control

Aparece con al menos 1000 px de ancho de ventana. Base local independiente TecmaControl_v1. Permite importar el CSV completo, importar cierres, marcar despachos con fecha, pegar números, registrar devoluciones y administrar accesorios/MIT. Los cierres repetidos no duplican sus movimientos. Se reconstruye el historial cronológicamente aunque los archivos se importen fuera de orden. Preparar próxima carga conserva las columnas, los valores originales y el separador del Zebra.

Actualizar desde Zebra fusiona por el número del código de barras, con una vista previa y confirmación. Los existentes conservan estados, fechas, notas e historial; solo se actualizan descripción, tipo y orden. Los nuevos ingresan pendientes en fábrica. Los ausentes se conservan con la señal «ya no está en el Zebra» y un filtro propio; la señal desaparece si vuelven a aparecer en otro CSV. Cancelar no guarda nada. La fecha de la última actualización se muestra en cada obra. Repetir el CSV no duplica productos.

La lista de obras muestra fecha de creación y cantidad de productos en tarjetas alineadas, más una barra delgada con los mismos tres colores de la vista general. El porcentaje despachado usa el número actualmente en obra / total; los devueltos tienen su propio segmento. La papelera de cada tarjeta y el botón Eliminar obra permiten borrar esa obra con sus productos, historial y accesorios después de confirmar; las cargas y otras obras permanecen intactas. Renombrar obra cambia solo su nombre visible: conserva el nombre original para Zebra y cierres. Al importar el mismo nombre y OP, se puede actualizar la existente mediante la fusión, crear otra de forma explícita o cancelar. Si hay varios duplicados, se elige cuál actualizar.

## Datos y actualización

Se conservan TecmaDespachos_v1 (esquema 2) y TecmaControl_v1 (esquema 1). 2.1.0 no añade migraciones ni cambia índices, tablas o IDs. Quien venga de la primera versión conserva la migración transaccional original de 1 a 2. No enviado pasa a pendiente y el motivo se conserva como nota. Las cargas antiguas de varias obras se mantienen completas y generan documentos conjuntos con la OP de cada línea.

El respaldo completo incluye ambas bases. Al cerrar una carga o importar un cierre se prepara automáticamente un TXT text/plain y se ofrece descargar/compartir sin abrir un diálogo. Se conserva la copia pendiente en meta hasta exportarla o generar otra más reciente; esa copia no se incluye recursivamente en los respaldos. La fecha del inicio corresponde al último respaldo generado; el aviso pendiente recuerda que hay que guardarlo fuera de la app. Después de 7 días aparece una invitación discreta. Los errores de respaldo nunca revierten el cierre ni la importación ya guardados. Se solicita navigator.storage.persist() al arrancar, sin esperar respuesta ni mostrar errores.

Los selectores de cierres y respaldos aceptan tanto .txt como .json.  La restauración admite las versiones 1 y 2, agrega copias y remapea sus relaciones. Primero valida la integridad; si falla la restauración de las cargas, revierte las copias de Control creadas en esa operación.

No hay login, analítica, servidor de datos, sincronización ni envíos automáticos. Compartir o descargar es una acción del usuario. HTTPS es necesario para la cámara y el service worker, excepto localhost para desarrollo. Todos los scripts y bibliotecas se sirven localmente.

## Archivos

core.js: base de cargas, migración, CSV y transacciones. app.js: interfaz y escaneo. reports.js: PDF, códigos y cierre. control.js: base de Control. control-ui.js: interfaz de Control. styles.css: idéntico a 2.0.2; todos los elementos nuevos reutilizan sus clases. sw.js: caché offline 2.1.0; conserva la estrategia de actualización al cerrar todas las ventanas. manifest.json, icons y lib permanecen sin cambios.

Consulta PRUEBAS.md para resultados y limitaciones de la verificación.
