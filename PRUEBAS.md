# Verificación de Tecma Despachos 3.0.0

79 comprobaciones automatizadas aprobadas sobre los archivos reales: 34 de datos y migración, 10 de importación e historial, 28 de interfaz y 7 de caché/escáner. Todos los JavaScript de la aplicación pasan node --check.

## Entorno y límites

Node, jsdom 26 y fake-indexeddb 6 con datos de prueba. Cámara, compartir, descargas y persistencia se simularon; el service worker usó Cache API y red simuladas. No se probaron aquí un navegador instalado en teléfono/laptop, WhatsApp real, cámara física ni lector Bluetooth físico. Las aplicaciones del selector de compartir dependen del dispositivo.

Se generaron ocho PDF con las bibliotecas locales reales: guía y control de una carga antigua y un despacho nuevo, con 2.1.0 y 3.0.0. Los cuatro pares dieron imágenes idénticas píxel a píxel a 100 ppp. Se revisaron visualmente guía y control del despacho nuevo. La guía incluye la pieza fuera del foco y SIN DESCRIPCIÓN; el control conserva Agregados al escanear.

styles.css y reports.js son idénticos byte por byte a 2.1.0. Manifest, iconos y bibliotecas no cambian. Los bloques de cámara, Code 128, Bluetooth, destello, marco, audio y vibración mantienen el código original. No se realizó una comparación visual de pantallas en un navegador real.

## Datos, obras y escaneo

- Subir de esquema conserva todas las filas antiguas de ambas bases y sus relaciones.
- Cargas antiguas son de solo lectura en interfaz y operaciones de datos. Sus PDF permanecen disponibles.
- CSV UTF-8, UTF-8 con BOM, UTF-16 LE/BE y Windows-1252 conservan ñ, acentos y PAÑO FIJO JUMBO y HOJA MOVIL CORREDERA GTi 2/1. Se detectan coma y punto y coma.
- Una obra nueva crea catálogo completo. Repetir CSV informa existentes y no duplica. Vista previa y Cancelar no escriben. Un fallo durante la fusión revierte toda la operación.
- Actualizar catálogo conserva estados, notas, fechas, historial y datos del PDF de despachos existentes. Los ausentes quedan señalados.
- Nuevo despacho no exige campos. Otra OFI carga en verde sin diálogo, con igual vibración. El selector fijo muestra otra OFI sin salir y permite varias.
- Un envío anterior da celeste y carga igual, incluso tras devolución. El mismo código en otra OP no hereda ese antecedente.
- Desconocido mantiene tres opciones. Agregar como producto guarda cargado, incorpora al catálogo y devuelve el foco al cerrar el formulario.
- El foco filtra la vista, no el despacho ni el PDF. El PDF está disponible antes de cerrar y no consulta ni exige completar el catálogo.
- Historial permite regenerar PDF. Material suelto usa solo líneas y fechas registradas de viajes cerrados. Búsqueda ignora mayúsculas y tildes.

## Registro, respaldo y Control

- TXT text/plain contiene catálogo con estados, despachos, eventos y material; compartir recibe ese archivo.
- Reimportar el mismo registro no cambia tablas ni duplica movimientos o accesorios.
- Nombre y OP se distinguen. Actualiza una obra de Control existente y conserva movimientos manuales.
- Varias visitas conservan notas de cada viaje y la nota manual previa. Una nueva exportación añade devolución sin duplicar envío.
- Un registro anterior no revierte devoluciones ni notas posteriores.
- Un fallo revierte productos, eventos, accesorios y marcadores juntos. Archivos inválidos no dejan datos parciales.
- Cierres antiguos siguen aceptándose, crean su obra si falta y no duplican al repetirse.
- Respaldo 3 restaura obras y despachos como copias, remapea relaciones y conserva identidad. Reexportar tras restaurar no duplica despachos ya importados.
- Respaldos antiguos restauran como cargas antiguas. Control respalda sus marcadores e historial. Eliminar obra borra sus registros asociados y respeta las otras.
- Cerrar ofrece respaldo sin modal ni bloqueo del PDF. Control conserva devoluciones, pegar números, renombrar y eliminar; ya no muestra Preparar próxima carga.
- Sin errores JavaScript en los flujos comprobados.

## Offline y actualización

Precaché contiene todos los archivos y módulos nuevos. Con red simulada desconectada, todos se sirven desde caché y la navegación recupera index.html. Activar elimina únicamente la caché anterior de Tecma; no toca bases ni otras cachés. Solo cambian versión y dos recursos del service worker.

## Comprobación final en tus equipos

1. Guarda un respaldo externo en cada equipo. Publica en la misma dirección y conserva el perfil; no borres datos ni reinstales.
2. Con internet, abre Tecma, busca actualización, cierra todas sus ventanas y pestañas y reabre. Confirma Versión 3.0.0 y Lista para usar sin conexión.
3. Revisa Cargas antiguas y Control. Importa el CSV completo en el teléfono: comienza como catálogo nuevo sin convertir las cargas antiguas.
4. Enfoca una OFI y prueba con cámara y lector una pieza de otra: verde, fuera del foco y presente en PDF. Prueba desconocido y Completar después.
5. Cierra, guarda respaldo y abre otro despacho para comprobar celeste del número ya enviado.
6. Exporta Registro_Tecma, compártelo por WhatsApp e impórtalo dos veces en Control; comprueba que la segunda vez no suma duplicados.
7. En modo avión, reabre, busca una pieza, escanea y genera ambos PDF.
