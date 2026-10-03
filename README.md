# Tecma Despachos 2.0.0

Actualización sobre la app original de este chat. Vanilla JavaScript, las mismas bibliotecas locales y el mismo diseño base.

## Publicar y usar

Abre ACTUALIZAR.html para las instrucciones paso a paso de GitHub Pages, actualización sin borrar datos e instalación en Windows. El directorio que se publica es el que contiene index.html. No subas el ZIP sin extraer.

## Cargas

- Una obra y un CSV por carga nueva; primera obra si el CSV contiene varias.
- Inicio: Preparadas, En curso y Cerradas, con nombre de obra, OFI, fecha y etiqueta opcional.
- Carga activa: pendiente/cargado. Notas opcionales. Los registros históricos admiten devuelto/trasladado para devoluciones y arrastres.
- El PDF está disponible sin cerrar ni completar datos. Códigos válidos ausentes del CSV se incluyen como «Código 123456» con aviso rojo informativo.
- Arrastre optativo de pendientes y devueltos de cargas cerradas de la misma obra.
- Escaneo por cámara, Bluetooth HID + Enter o manual. Visor con destello, marco, contador e historial corto; señales diferenciadas.
- Al cerrar se generan guía, control, CSV de códigos y JSON de cierre. Las devoluciones posteriores aparecen al volver a generar el JSON.

## Control

Aparece con al menos 1000 px de ancho de ventana. Base local independiente TecmaControl_v1. Permite importar el CSV completo, importar cierres, marcar despachos con fecha, pegar números, registrar devoluciones y administrar accesorios/MIT. Los cierres repetidos no duplican sus movimientos. Se reconstruye el historial cronológicamente aunque los archivos se importen fuera de orden. Preparar próxima carga conserva las columnas, los valores originales y el separador del Zebra.

## Datos y actualización

Se conserva TecmaDespachos_v1 como nombre de base. El esquema sube de 1 a 2 con migración transaccional, sin borrar ni recrear tablas. No enviado pasa a pendiente y el motivo se conserva como nota. Las cargas antiguas de varias obras se mantienen completas y generan documentos conjuntos con la OP de cada línea.

El respaldo completo incluye ambas bases. La restauración admite las versiones 1 y 2, agrega copias y remapea sus relaciones. Primero valida la integridad; si falla la restauración de las cargas, revierte las copias de Control creadas en esa operación.

No hay login, analítica, servidor de datos, sincronización ni envíos automáticos. Compartir o descargar es una acción del usuario. HTTPS es necesario para la cámara y el service worker, excepto localhost para desarrollo. Todos los scripts y bibliotecas se sirven localmente.

## Archivos

core.js: base de cargas, migración, CSV y transacciones. app.js: interfaz y escaneo. reports.js: PDF, códigos y cierre. control.js: base de Control. control-ui.js: interfaz de Control. styles.css: estilos originales más reglas nuevas. sw.js: caché offline 2.0.0; conserva la estrategia de actualización al cerrar todas las ventanas. manifest.json, icons y lib permanecen sin cambios.

Consulta PRUEBAS.md para resultados y limitaciones de la verificación.
