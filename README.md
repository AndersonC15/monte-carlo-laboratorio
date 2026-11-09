# Monte Carlo Lab

Laboratorio educativo del método Monte Carlo, en español, con cuatro experimentos: **estimar π, volumen 3D, hospital e inversión a un año**. Conserva la paleta original de turquesa, violeta y fondo oscuro.

## Abrir y exponer

Abre `index.html` en Chrome, Firefox, Edge o Safari. No necesita instalación ni conexión para simular. Las fuentes externas de la historia y bibliografía sí requieren internet.

1. Empieza en **Método**: generar al azar, repetir y resumir.
2. En **Un hospital**, ya aparece una corrida de 10.000 días cuando entras por primera vez. Explica las barras y la conclusión, y pulsa **Comparar con 1 médico más**.
3. En **Una inversión**, identifica el capital, la media supuesta y la variación anual. Cambia la variación, pulsa **Calcular todo** y compara pérdidas y ganancias.
4. Usa **Convergencia** para explicar cómo cambia la estimación al acumular muestras. No representa una garantía ni un porcentaje de validez.
5. Consulta **Historia**: idea moderna de Ulam en 1946; primeras simulaciones Monte Carlo en ENIAC en 1948; publicación de Metropolis y Ulam en 1949. Cada tarjeta enlaza su fuente.

Al modificar un dato se reinicia la corrida del experimento activo. La semilla reproduce la secuencia aleatoria con el mismo modelo y parámetros. Las pestañas conservan su avance mientras la página está abierta. «Reiniciar» vuelve a cero; «+1 muestra» permite inspeccionar un intento.

## Qué calcula cada modelo

### π y volumen

Puntos uniformes en el cuadrado o cubo unidad. Se incluye la frontera (`≤ 1`). π se estima con `4C/N`; el volumen completo de la esfera de radio 1, con `8C/N`. Se conservan referencias matemáticas conocidas y errores absolutos.

### Hospital

Modelo didáctico de **carga diaria**, no simulador de colas clínicas. Cada día sortea un número entero de pacientes entre `promedio − floor(0,3 × promedio)` y `promedio + floor(0,3 × promedio)`, incluidos los extremos. Las consultas ordinarias duran uniformemente entre la mitad y una vez y media del tiempo base. Cada paciente tiene la probabilidad de emergencia elegida; esa consulta requiere tres veces la duración sorteada.

Capacidad diaria = médicos × horas por médico × 60 minutos. Umbrales educativos: carga hasta el 85 % = con margen; mayor al 85 % y hasta el 100 % = presión de atención; mayor al 100 % = saturación. No son estándares médicos ni tiempos de espera observados.

La comparación con un médico adicional reutiliza los mismos días, llegadas y consultas: solo cambia la capacidad. Los resultados no sustituyen un estudio real de dotación de personal.

### Inversión

Modelo hipotético a un año, sin datos de mercado, comisiones, impuestos ni inflación. Se genera un factor anual lognormal positivo, calibrado a la media aritmética `m` y desviación estándar `d` del rendimiento anual que introduce el usuario (en fracción):

- `sigma² = log(1 + (d / (1 + m))²)`
- `mu = log(1 + m) − sigma² / 2`
- `capital final = capital inicial × exp(mu + sigma × Z)`, con `Z` normal estándar.

Las categorías son pérdida (`ganancia < 0`), ganancia de cero hasta el umbral inclusive y ganancia mayor al umbral. Se muestra la frecuencia de cada una, la probabilidad estimada de pérdida y el capital final medio. Con variación cero, todos los escenarios tienen el mismo rendimiento. No se predice la rentabilidad futura.

En hospital e inversión no se presenta una referencia futura conocida: las curvas siguen la frecuencia acumulada de saturación o pérdida. El error estándar mostrado se refiere a esa probabilidad estimada y se expresa en puntos porcentuales.

Los ejemplos narrativos 60/30/10 y 30/45/25 están marcados como hipotéticos. El simulador **no fuerza esos porcentajes**.

## Validación local

```sh
node tests/simulation.test.js
node tests/browser.test.js
```

La segunda comprobación usa Chrome instalado en `/usr/bin/google-chrome` (o `CHROME_BIN`) y un perfil temporal mediante Chrome DevTools Protocol, sin dependencias npm. Abre archivos locales y guarda capturas en `/tmp/monte-carlo-qa/`. No publica ni sube archivos. Puede requerir autorización del entorno para lanzar el navegador.

## Archivos

- `index.html`: interfaz, explicaciones, historia con fuentes, preguntas y manual.
- `assets/simulation.js`: modelos, generador reproducible y estadística.
- `assets/charts.js`: gráficos Canvas, barras y convergencia.
- `assets/app.js`: controles, tablas, conclusiones y comparación de médicos.
- `assets/styles.css`: diseño adaptable con los colores originales.
- `tests/`: comprobaciones numéricas y del navegador.

## Publicar más adelante

Los cambios quedan locales. Para GitHub Pages, cuando decidas publicarlos, `index.html`, `assets/` y `.nojekyll` deben estar en la raíz del repositorio y la publicación debe apuntar a esa carpeta. No hay compilación ni dependencias de ejecución. Esta modificación no realiza commits, push ni despliegues.
