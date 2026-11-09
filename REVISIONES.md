# Cinco revisiones del laboratorio

Las cinco revisiones se realizaron sobre la versión local. No se hicieron commits, push ni despliegues.

## 1. Cálculos y reproducibilidad

**Aprobada: 12 pruebas numéricas.**

`node tests/simulation.test.js`

Se comprobaron semillas y procesamiento por lotes; conteos y porcentajes; cambios en personal; demanda media del hospital derivada por separado; emergencias; fronteras del 85 % y 100 %; inversión sin variación; media y desviación de los rendimientos; umbrales; muestras vacías y únicas; error estándar; π y volumen; relación teórica entre muestras y error estándar.

## 2. Contenido, historia y significado de las conclusiones

**Aprobada mediante lectura independiente de modelos, interfaz y fuentes.**

- Cronología: idea moderna de Ulam en 1946, primeras simulaciones Monte Carlo en ENIAC en abril–mayo de 1948 y publicación de Metropolis/Ulam en 1949.
- Fuentes enlazadas: Los Alamos National Laboratory, relato de Metropolis y publicación original.
- Hospital: reglas sintéticas y umbrales educativos explícitos; no se presentan tiempos de espera como si se hubieran simulado colas.
- Inversión: modelo a un año, sin datos de mercado, con posibilidad de pérdidas; la categoría más frecuente no es una garantía. Se distingue una categoría individual del conjunto de escenarios sin pérdida.
- Los porcentajes ilustrativos del texto se distinguen de los calculados por el motor.
- No hay una referencia futura conocida inventada para hospital o inversión.

## 3. Controles y comportamiento en navegador

**Aprobada en Chrome, sin errores de ejecución o consola.**

`node tests/browser.test.js`

Se comprobaron las cuatro pestañas; eliminación de dados e integración como experimentos; todos los parámetros nuevos; cambios de semilla; reinicio; un intento; validación; comparación de médicos; tablas y conclusiones; curvas de convergencia; giro 3D; cuestionario y comparación de precisión.

## 4. Diseño, lectura y accesibilidad

**Aprobada en 375, 768 y 1440 píxeles, con inspección de capturas.**

Se conservaron los colores originales; no hay desbordamiento horizontal de la página. Se revisaron barras, métricas, tablas, conclusiones, método e historia. La tabla acompaña al Canvas para ofrecer resultados textuales. Se comprobaron etiquetas de campos, foco por teclado y estados ARIA de pestañas.

Las capturas de comprobación se generan localmente en `/tmp/monte-carlo-qa/`.

## 5. Regresión e integración final

**Aprobada: 13 grupos de comprobaciones de navegador en total.**

Se probaron animar, pausar y continuar frente a una corrida por lotes; navegación con flechas, Inicio y Fin; últimas seis muestras sin valores indefinidos; inversión sin variación ni rendimiento; umbral cero; controles extremos válidos; ausencia de referencias ficticias en convergencia. Se verificaron 125 identificadores únicos, 19 enlaces internos y 14 asociaciones de etiquetas, además de los recursos locales. Los tres archivos JavaScript pasan `node --check`; `git diff --check` no presenta errores.

## Alcance

Las verificaciones comprueban que el programa implementa sus reglas educativas. No validan datos de un hospital real ni predicen precios financieros. Más muestras reducen la variación del cálculo, no los errores de los supuestos.
