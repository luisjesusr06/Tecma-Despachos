# Verificación de Tecma Despachos 2.1.0

78 comprobaciones automatizadas aprobadas: 42 del flujo completo de las funciones nuevas, 30 de regresión de gestión de obras y 6 del service worker. JavaScript comprobado con node --check.

## Entorno y límites

- Se ejecutaron los archivos reales de la aplicación en Node con jsdom y fake-indexeddb. Cámara, compartir, descargas y persistencia se simularon; el service worker se ejecutó con Cache API y red simuladas. Estas pruebas no equivalen a una ejecución en un navegador real ni en los dispositivos del usuario.
- La comprobación visual del navegador local continúa bloqueada por la revisión automática de permisos del entorno. No se eludió esa restricción. No se pudo comprobar aquí el menú real de WhatsApp, la cámara física, un lector Bluetooth físico ni una actualización instalada en teléfono/laptop.
- Sí se revisaron visualmente los PDF generados por las bibliotecas locales reales, renderizados con Poppler. Los PDF de una carga normal, sin agregados, dieron imágenes idénticas píxel a píxel a 2.0.2. Se revisaron una guía y las cinco páginas de un control con 27 agregados, descripciones vacías y notas largas. Todos los números aparecen una vez y las notas permanecen fuera de la guía.
- styles.css, index.html, manifest, bibliotecas e iconos permanecen idénticos. CSV, normalización, adquisición de cámara, captura Bluetooth, destello, marco, sonidos y vibración conservan sus bloques originales.
- La estructura y versión de ambas bases no cambian. Se usan campos de producto ya existentes y metadatos para la copia pendiente y la fecha del respaldo. El service worker solo cambia VERSION a 2.1.0.

## Nuevas funciones y conservación de datos

1. Abrir bases 2.0.2 con 2.1.0 conserva todas las filas y relaciones byte por byte.
2. Persistencia se pide al iniciar; rechazo no impide abrir la app.
3. Aviso de desconocido ofrece tres opciones sin guardar, abrir modal ni bloquear.
4. Aviso permite seguir escaneando por Bluetooth.
5. Agregar producto lo guarda cargado con fecha antes del formulario opcional.
6. Completar después conserva cargado, SIN DESCRIPCIÓN y devuelve el foco al lector.
7. Reescaneo no duplica producto agregado.
8. Cámara, Bluetooth y manual comparten el alta de productos cargados.
9. Formulario opcional guarda tipo, descripción y OFI conservando escaneo e historial.
10. Opción de accesorio sigue disponible y no crea un producto.
11. OFI se ordenan naturalmente y Sin OFI queda al final.
12. Encabezado usa avance real y conserva el Tipo original en los datos.
13. Productos agregados llevan una marca discreta.
14. Producto se puede completar después sin perder estado ni fecha de carga.
15. Buscador instantáneo combina número, tipo, descripción y OFI sin cambiar foco.
16. Búsqueda y filtro Pendientes se combinan.
17. Búsqueda ignora mayúsculas y tildes.
18. Búsqueda por número encuentra el producto.
19. Búsqueda por OFI funciona.
20. X limpia la búsqueda y conserva el foco.
21. Filtro Cargados mantiene bloques OFI sin intercalarlos.
22. PDF disponible con datos opcionales vacíos y carga abierta.
23. Cerrar carga ofrece respaldo sin abrir diálogo ni bloquear PDF.
24. Respaldo automático incluye cargas, control, eventos y accesorios y no se incluye a sí mismo.
25. Cierre TXT text/plain conserva JSON versión 1 y productos reales.
26. Compartir envía archivo de cierre TXT con MIME text/plain.
27. Fallo de compartir descarga y muestra ubicación y nombre.
28. Respaldo se comparte como TXT text/plain y mantiene fecha.
29. Inicio muestra fecha del último respaldo.
30. Más de 7 días muestra aviso y Respaldar ahora sin diálogo.
31. Selector de cierres acepta TXT y JSON.
32. Importar TXT reconoce agregado como producto en obra y ofrece respaldo.
33. Reimportar el cierre no duplica registros ni historial.
34. Respaldo tras importar contiene el movimiento recién guardado.
35. Tarjeta conserva metadatos y muestra tres segmentos con porcentaje real.
36. Restauración acepta archivos TXT y JSON.
37. Restaurar TXT y JSON conserva originales, notas, productos nuevos y relaciones.
38. Guía agrupa agregados como productos normales y usa SIN DESCRIPCIÓN.
39. CSS, index, bibliotecas, iconos y manifest siguen intactos.
40. Cancelar compartir conserva respaldo pendiente y no descarga otro archivo.
41. Fallo del respaldo automático conserva el cierre y mantiene PDF disponible.
42. Reabrir la app recupera el respaldo pendiente completo sin perder registros.

## Funcionamiento offline

1. Service worker precarga todos los archivos locales sin dependencias remotas.
2. Todos los recursos se sirven desde caché con red desconectada.
3. Navegación offline nueva devuelve index.html.
4. Activar elimina solo caché anterior de esta app, no otras cachés ni bases de datos.
5. Diagnóstico offline informa caché completa y versión 2.1.0.
6. Estrategia del service worker se conserva: solo cambia VERSION.

## Regresión de Control

Se volvieron a ejecutar y aprobar las 30 comprobaciones de 2.0.2 que se detallan abajo: eliminación, renombrado, duplicados, fusión Zebra, transacciones, aislamiento de cargas y conservación de respaldos.

## Comprobación final en tus dispositivos

1. Publicar en la misma dirección, abrir con internet y cerrar todas las ventanas de Tecma. Reabrir y comprobar Versión 2.1.0 y Lista para usar sin conexión.
2. Verificar cargas y obras existentes sin importar ningún respaldo para actualizar.
3. Probar un código desconocido por cámara y lector real: Agregar como producto, Completar después y siguiente escaneo. Completar sus campos después desde Productos.
4. Compartir Cierre para Control (.txt), elegir WhatsApp e importar ese mismo archivo en Control de la laptop.
5. Guardar fuera del dispositivo el respaldo ofrecido; repetir apertura, escaneo y generación de PDF en modo avión.

---

# Verificación de Tecma Despachos 2.0.2

Fecha: 4 de octubre de 2026.

30 comprobaciones de integración aprobadas en Node, con jsdom 26 y fake-indexeddb 6. Se ejecutaron los archivos reales core.js, control.js y control-ui.js sobre datos de prueba. No se usaron datos del usuario.

## Gestión de obras

1. Tarjeta muestra fecha y cantidad real de productos.
2. Eliminar es un botón independiente del enlace de la tarjeta.
3. Confirmación identifica la obra y OP con el texto solicitado.
4. Cancelar eliminación no cambia ninguna tabla.
5. Cerrar el diálogo invalida la eliminación pendiente.
6. Cancelar renombrado no guarda cambios.
7. Renombrar solo cambia el nombre visible; conserva identidad, estados, notas, fechas, historial y accesorios.
8. Nombre visible aparece escapado en pantalla.
9. Nombre vacío se rechaza sin borrar el nombre anterior.
10. Importar duplicado presenta nombre, OP, fecha, cantidad y tres opciones.
11. Aviso de duplicado no guarda nada.
12. Cancelar importación duplicada conserva todo.
13. Actualizar existente usa el resumen Zebra sin guardar todavía.
14. Cancelar fusión desde duplicados tampoco cambia datos.
15. Fusión desde la lista agrega producto sin duplicar obra y conserva el historial.
16. Fusión desde la lista dirige a la obra actualizada.
17. Cantidad en tarjeta se actualiza después de fusionar.
18. Crear nueva de todas formas agrega una obra independiente.
19. Si hay varios duplicados se ofrece un selector explícito.
20. No se actualiza un duplicado arbitrario sin seleccionarlo.
21. Se fusiona únicamente el duplicado seleccionado.
22. Mismo nombre con otra OP se crea sin aviso.
23. Otra obra con la misma OP no se considera duplicada.
24. Eliminar desde tarjeta borra la obra y todas sus relaciones sin afectar otras obras.
25. Eliminar obra no modifica las cargas de despacho.
26. Eliminar dentro de la obra vuelve a la lista y elimina todos sus datos.
27. Error al eliminar revierte productos, historial, accesorios y obra juntos.
28. Dos importaciones simultáneas solo crean una obra sin autorización de duplicado.
29. Nombre duplicado se reconoce con distintas mayúsculas, tildes y espacios.
30. Respaldo conserva alias, nombre original, fecha y relaciones.

## Alcance y limitaciones de esta versión

- JavaScript revisado con node --check.
- Estilos anteriores conservados íntegramente. Se añaden reglas limitadas a la grilla de obras, la disposición del texto y el botón de eliminar.
- Sin cambios en la base de cargas, escáner, PDF, bibliotecas, iconos ni manifest. app.js y sw.js solo actualizan la identificación de versión.
- No se completó la prueba visual en un navegador real: el entorno no pudo instalar Chromium y la revisión automática de permisos bloqueó el acceso del navegador a la copia local. Las pruebas anteriores de navegador que siguen corresponden a las versiones indicadas, no constituyen una nueva ejecución para 2.0.2.
- La alineación se implementa con filas de igual tamaño y altura compartida; falta su comprobación visual en navegador.

---

# Verificación de Tecma Despachos 2.0.1

Fecha: 3 de octubre de 2026.

25 comprobaciones adicionales aprobadas en Chromium 134 con Playwright, con datos de prueba. Se revisaron visualmente la confirmación y el filtro.

## Actualizar desde Zebra

1. Vista previa calcula nuevos, existentes, ausentes, OFI nuevas y cambios de texto.
2. Vista previa no escribe datos.
3. Cancelar conserva todos los datos y no registra fecha de actualización.
4. Cerrar la confirmación con Escape tampoco modifica datos.
5. Existentes conservan IDs, estados, fechas, notas y todos los demás campos.
6. Historial y accesorios quedan idénticos.
7. Solo cambian descripción, tipo y orden; dimensiones y OP originales se conservan.
8. Producto presente sin cambios permanece idéntico.
9. Nuevos ingresan pendientes, sin fechas de despacho ni historial inventado.
10. Ausente se conserva con señal, estado y notas previos.
11. Fecha pequeña de última actualización visible tras aplicar.
12. Preparación CSV mantiene esquema original y exporta textos actualizados y filas nuevas bien alineadas.
13. Reimportar el mismo CSV es idempotente para productos, historial y accesorios.
14. Filtro separado muestra solo los ausentes sin alterar sus estados.
15. Señal de ausencia también visible en detalle del producto.
16. CSV más antiguo o parcial no borra los productos agregados después.
17. Un producto que vuelve al CSV pierde la señal sin perder su identidad.
18. No pisa estados, fechas o notas registrados entre vista previa y Aplicar.
19. CSV de otra obra no cambia ni marca ausencias en la obra abierta.
20. Fallo al guardar revierte altas, textos, ausencias y fecha de actualización juntos.
21. Una confirmación desactualizada no aplica un resumen que ya cambió.
22. Doble aplicación simultánea no duplica códigos.
23. Respaldo y restauración conservan fecha y señales de Zebra.
24. Actualizar desde Zebra funciona sin internet después de recargar.
25. Sin errores JavaScript de ejecución.

El diseño y styles.css no se modificaron respecto de 2.0.0. app.js y sw.js solo cambian la identificación de la versión a 2.0.1; la función nueva está en control.js y control-ui.js.

---

# Verificación de Tecma Despachos 2.0.0

Fecha: 3 de octubre de 2026.

45 comprobaciones aprobadas en Chromium 134 con Playwright. Se usaron datos de prueba, no las cargas del teléfono del usuario.

## Resultados

1. Migración real de IndexedDB v1 a v2 conserva cargas, obras e IDs.
2. No enviado pasa a pendiente con motivo en nota.
3. Nombre automático, OFI correlativas y fecha local.
4. Carga sin escaneos en Preparadas.
5. Escaneos simultáneos del mismo código se contabilizan una sola vez.
6. Primer escaneo mueve la carga a En curso.
7. Arrastre opcional: agrega un código ausente del CSV, marca el origen y no lo vuelve a ofrecer.
8. Ya despachado antes es informativo y marca cargado.
9. Importar cierre actualiza Control; reimportarlo no duplica movimientos ni accesorios.
10. Nuevo viaje reconcilia volvió sin registrar.
11. Devolución disponible para arrastre y actualiza Control al reimportar cierre.
12. CSV de preparación conserva columnas, separador y valores crudos del Zebra.
13. Respaldo y restauración incluyen ambas bases y remapean enlaces de arrastre.
14. CSV con varias obras informa y usa la primera; selector de un único archivo.
15. Lector Bluetooth conserva inputmode none.
16. Destello cubre el visor y marco verde persistente.
17. Destello desaparece a los 600 ms y contador actualizado.
18. Desconocido válido se incluye sin bloquear; últimas tres lecturas.
19. Vibraciones distintas para éxito, duplicado y desconocido.
20. Cerrar genera automáticamente cuatro archivos sin exigir datos ni pendientes completos.
21. Control visible en pantalla grande y barras por OFI.
22. Tocar OFI abre productos con fecha e historial accesible.
23. Historial muestra reconciliación silenciosa.
24. Control oculto en teléfono.
25. Inicio móvil sin desbordamiento horizontal.
26. Recarga offline real mantiene datos y genera los cuatro archivos.
27. Sin errores JavaScript de ejecución.
28. Actualización real del service worker v1 → v2 al cerrar y reabrir.
29. Restaura respaldo antiguo y preparación antigua sin perder cargas.
30. CSV con comas, sep=, descripción entre comillas y columnas originales.
31. PDF inmediato con carga vacía y sin campos obligatorios.
32. Lectura Windows-1252 conservada.
33. Cierres importados fuera de orden se reconcilian cronológicamente.
34. Pegado masivo deduplica números, aplica fecha y omite desconocidos sin bloquear.
35. Respaldo corrupto de Control se rechaza antes de modificar cargas.
36. Nombre abrevia más de tres OFI.
37. Nota opcional visible con punto en lista.
38. Devolución por lista en carga cerrada.
39. Modo devolución por escáner Bluetooth sin teclado.
40. CSV descargado desde selección filtrada de Control.
41. Devolución libre y accesorios agrupados en Control.
42. Celeste, vibración triple y tres tonos descendentes, sin diálogo.
43. Control oculto exactamente por debajo de 1000px.
44. Control visible desde 1000px.
45. Cámara móvil sin desbordamiento horizontal.

## PDF y diseño

- PDF para guías y PDF de control generados y revisados visualmente. Columnas, encabezado, tipografías, colores y firma de la guía conservados.
- Control de 28 productos arrastrados con notas largas: 6 páginas, todos los códigos presentes y encabezados repetidos. Las notas no aparecen en la guía.
- styles.css conserva íntegro el contenido de la versión anterior; se añadieron reglas para los elementos nuevos.
- Vista móvil comprobada a 390 × 844 y Control a 1366 × 900. Visibilidad de Control comprobada a 999 y 1000 píxeles.

## Límites de estas pruebas

La adquisición de cámara y sus lecturas se simularon; no se probaron la cámara física del Samsung/iPhone ni un lector Bluetooth físico. Sí se verificaron el flujo de guardado, el Enter del campo Bluetooth, el destello de 600 ms, marco, contador, últimas lecturas y las llamadas de vibración y audio. La vibración real y el volumen dependen del dispositivo. La instalación en el teléfono real y el diálogo de compartir del sistema requieren comprobación allí.

La actualización del service worker v1 a v2, IndexedDB y la recarga sin internet se probaron en el navegador, no mediante simulaciones de la base de datos.
