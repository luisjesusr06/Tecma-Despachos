# Pruebas y alcance de la verificación

Fecha: 21 de septiembre de 2026. Versión: 1.0.0.

El CSV suministrado tiene **3 obras y 8 productos**: CASA GILI (6), CUMBRES SANTA MARIA II (1), GRENERGY (1). La referencia a 4 obras en la especificación no coincide con esas filas.

## Pruebas ejecutadas

Se ejecutó la interfaz JavaScript en Node.js con JSDOM y fake-indexeddb. Se usaron las cinco bibliotecas reales de la carpeta lib. Las interacciones de formularios, los cambios de estado y las transacciones se ejecutaron en ese entorno simulado; no equivalen a una prueba en Android o iPhone.

1. Correcto: Carga de las cinco librerías locales y pantalla inicial.
2. Correcto: CSV con punto y coma/coma, BOM, tildes, encabezados truncados, ceros iniciales, comillas y validación.
3. Correcto: Crear carga desde UI y guardar datos en IndexedDB.
4. Correcto: 513042: aviso verde CASA GILI · V05C después de guardar.
5. Correcto: Lectura repetida amarilla, sin cambiar fecha ni cantidad.
6. Correcto: 999999: aviso rojo y acción de línea manual.
7. Correcto: Lectura intercalada GRENERGY/CASA GILI y captura teclado + Enter.
8. Correcto: Deshacer último escaneo devuelve a pendiente.
9. Correcto: No enviado exige motivo; accesorio BURLETE COD: JF005, 100 MT.
10. Correcto: Generación real de PDF carta para guías/control y CSV de sólo cargados.
11. Correcto: PDF de varias páginas generado con 120 productos.
12. Correcto: Agrupación por tipo/descripción/orden/atril y orden natural V2 antes de V10.
13. Correcto: Confirmación de no enviado, deshacer restaura motivo y foco Bluetooth.
14. Correcto: Cierre con advertencia y bloqueo real de cambios en la base.
15. Correcto: Reabrir y exportar desde la interfaz.
16. Correcto: Respaldo/restauración sin sobrescribir, relaciones e historial de deshacer válidos, archivo inválido rechazado.
17. Correcto: CSV adicionales, aviso de código duplicado y selección de obra antes de cargar.
18. Correcto: Deshacer conserva productos editados después.
19. Correcto: Dos lecturas simultáneas sólo registran una carga.
20. Correcto: Reabrir la aplicación conserva datos con IndexedDB simulado.
21. Correcto: Respaldo restaura borradores y conserva la preparación que ya existía.
22. Correcto: Service worker: todos los archivos existen, cache-first, navegación sin red y comprobación de caché (simulados).
23. Correcto: Sin excepciones de la aplicación durante los recorridos de prueba.

## Revisión de PDF

Los PDF se generaron con jsPDF y AutoTable incluidos. Se extrajo el texto, se comprobaron los códigos y exclusiones y se renderizaron las páginas para inspección visual. Se revisaron encabezados, márgenes, tabla, firma y caracteres en español. Con 120 productos de prueba, la guía produjo 4 páginas y el control 8; todas conservaron encabezado y contenido dentro de los límites de carta. Se corrigió el salto en «CANTIDAD» y la superposición de encabezados en páginas con varias secciones.

## Verificación de archivos

Se verificó sintaxis de app.js, core.js, reports.js y sw.js, referencias locales del HTML, manifest, iconos y presencia de todos los recursos del precaché. Las cinco bibliotecas están descargadas y tienen versiones y SHA-256 en lib/DEPENDENCIAS.json. No hay CDN de ejecución ni servicios remotos para datos.

## Alcance pendiente de verificación física

La app incluye todas las funciones solicitadas. Este entorno bloqueó los sockets internos de Chromium; la revisión automática rechazó autorizar esa ejecución. Por eso no se pudo realizar una prueba completa en navegador real ni una inspección visual de la interfaz móvil. No se afirma haber probado instalación, funcionamiento real en modo avión, cámara, linterna, Bluetooth físico, sonido/vibración o menú nativo de compartir en Android/iPhone. El service worker y la reapertura de datos se probaron mediante simulación.

La guía de instalación incluye la prueba en modo avión y los pasos del lector. Antes del primer despacho real, prueba el CSV de ejemplo en el teléfono que usarás y verifica el aviso «Lista para usar sin conexión». Exporta un respaldo al terminar cada jornada.
