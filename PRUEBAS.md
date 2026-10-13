# Verificación de Tecma Despachos 3.1.0

93 comprobaciones automatizadas aprobadas sobre los archivos reales: 27 de integración y conservación de datos, 18 de bienvenida e interfaz, 7 de errores/concurrencia/OP combinadas, 24 de regresión del flujo de despacho, 10 de historial e importación y 7 de caché/escáner. JavaScript revisado con node --check.

## Qué se comprobó

- Detecta las cargas anteriores automáticamente. La bienvenida tiene Comenzar y no ofrece posponer ni omitir mediante otra URL.
- Sin cargas anteriores abre Obras directamente, sin mensajes ni descargas.
- Genera un respaldo completo antes de modificar los registros y ofrece descargar o compartir. Cancelar compartir no aplica cambios. Sin compartir exige una descarga explícita.
- Conserva una copia del respaldo previo para recuperarla tras un reinicio o un error. Si falla guardar esa copia interna, mantiene disponible la copia generada en memoria para descargar.
- Crea las obras que faltan, reutiliza las que ya existen por nombre y OP y conserva sus catálogos de Zebra.
- Convierte todas las cargas en despachos con fechas, chofer, RUT y patente originales. Conserva códigos, tipos, descripciones, OFI, estados, horas, notas, accesorios y devoluciones.
- Varias cargas de una obra quedan como viajes distintos. Cargas con varias obras u OP se reparten sin duplicar piezas ni accesorios. Una línea manual con OP combinada mantiene su atribución original, sin deducir otra.
- Cada evento original conserva su hora y sus relaciones. Las líneas manuales mantienen cantidades y fechas y se ven en Material suelto.
- Calcula el avance desde los escaneos y retornos originales. Las obras deducidas muestran Catálogo incompleto y cantidades conocidas, sin porcentaje global ni barra llena que sugiera totalidad.
- La fusión con el CSV completo agrega los faltantes, conserva los viajes y devoluciones y quita la señal.
- Fallar a mitad de la transacción revierte todas las tablas; muestra el error y conserva el respaldo. Reintentar completa sin duplicar.
- Dos intentos simultáneos solo integran una vez. Una edición desde otra ventana invalida el respaldo desactualizado y requiere generar uno vigente antes de aplicar.
- La marca de completado se guarda junto con los datos y viaja en los respaldos posteriores. Reabrir y restaurar uno de ellos no repite la bienvenida.
- Restaurar un respaldo anterior integra sus copias dentro de la restauración, sin recrear un archivo antiguo. Un fallo conserva los despachos y la marca existentes.
- No queda un apartado, enlace, botón ni ruta de archivo antiguo. La antigua URL vuelve al inicio.
- Registro_Tecma incluye los viajes integrados con sus eventos y material. Reimportarlo no duplica. Si ya se había importado su cierre antiguo en Control, se reconoce la misma identidad y no se suma dos veces. Importar ese cierre de nuevo tampoco revierte el registro.
- Se mantienen las pruebas de foco por OFI, verde fuera del foco, celeste por viaje anterior, desconocido cargado de inmediato, búsqueda, accesorios, exportación TXT, respaldo, devoluciones y administración de Control.

## PDF y diseño

Se generaron cuatro PDF con las bibliotecas locales reales: guía y control antes de integrar y los mismos documentos después. Los dos pares dieron imágenes idénticas píxel a píxel a 108 ppp; se revisaron visualmente ambas páginas. Se verificaron también las filas de la guía antes/después.

styles.css y reports.js permanecen idénticos byte por byte a 3.0.0. Manifest, iconos y bibliotecas no cambian. Las pantallas nuevas usan clases existentes. Cámara, Code 128, Bluetooth, destello, marco, audio y vibración conservan sus bloques de código. No se realizó una comparación visual de pantallas en un navegador real.

## Offline

El service worker conserva los mismos recursos y la misma estrategia de 3.0.0; solo cambia la versión a 3.1.0. Con Cache API y red simuladas se comprobó precaché completa, entrega de todos los archivos sin red, recuperación de index.html y eliminación exclusiva de la caché anterior de Tecma. Ninguna activación borra IndexedDB.

## Entorno y límites

Las pruebas de datos e interfaz usan Node, jsdom 26 y fake-indexeddb 6 con datos de prueba. Cámara, compartir, descargas, persistencia y red se simularon. No se probaron aquí cámara física, lector Bluetooth físico, menú real de WhatsApp ni instalación/actualización en los equipos del usuario. La app puede iniciar una descarga, pero el navegador no permite confirmar que el usuario terminó de guardarla fuera del sitio.

La marca de integración es local y se conserva en los respaldos. Borrar todo el almacenamiento elimina tanto los datos como la marca; restaurar un respaldo posterior recupera ambos. No se introduce un servidor ni una identificación externa del dispositivo.

## Comprobación en tus dispositivos

1. Publica los archivos en la misma dirección. Con internet, busca actualización, cierra todas las ventanas y pestañas de Tecma y reabre. Confirma Versión 3.1.0.
2. Si aparece la bienvenida, pulsa Comenzar y guarda el respaldo ofrecido. Comprueba el resumen y los viajes dentro de sus obras.
3. Revisa fechas, productos, devoluciones y Material suelto. Regenera una guía conocida.
4. Cierra y reabre: debe entrar directamente a Obras, sin bienvenida ni archivo antiguo.
5. Completa una obra con su CSV entero; verifica la señal y el avance.
6. Exporta Registro_Tecma e impórtalo dos veces en Control. Prueba también con un viaje cuyo cierre ya estaba registrado.
7. Cuando indique Lista para usar sin conexión, prueba apertura, escaneo y PDF en modo avión.
