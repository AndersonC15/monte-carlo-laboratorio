# Monte Carlo Lab

Laboratorio de simulación del método Monte Carlo. Incluye cuatro experimentos interactivos, un manual, un control de aprendizaje con 5 preguntas y 15 preguntas de participación.

## Abrir en tu equipo

1. Descomprime `Monte_Carlo_Lab.zip` en una carpeta.
2. Abre `index.html` con Chrome, Firefox, Edge o Safari.
3. Entra en **Laboratorio**. La vista inicial tiene 120 muestras de π generadas con semilla 42. Pulsa **Reiniciar** para empezar en cero o **Calcular todo** para completar la corrida.

La página usa HTML, CSS y JavaScript nativos. Sus gráficos y simulaciones se ejecutan en el navegador con los archivos de la carpeta. Para abrir los artículos de la bibliografía se necesita internet.

## Publicar el proyecto

Sube a un repositorio de GitHub los archivos de la carpeta descomprimida. `index.html`, `assets/` y `.nojekyll` quedan en la raíz del repositorio. Si la interfaz oculta `.nojekyll`, créalo como archivo vacío desde GitHub o inclúyelo al subir con Git.

| Servicio | Configuración |
| --- | --- |
| GitHub Pages | En **Settings → Pages**, elige **Deploy from a branch**, rama `main` y carpeta `/(root)`. Guarda y abre la URL que muestre Pages cuando termine el despliegue. |
| Vercel | Importa el repositorio como proyecto. Elige **Other** en **Framework Preset**. Activa **Override** en **Build Command** y deja el campo vacío. Usa la raíz como directorio de salida o conserva el valor automático de **Other**. |
| Render | Crea un **Static Site** y conecta el repositorio. En **Build Command** escribe `echo "Sitio estático"` y en **Publish Directory** escribe `.`. Selecciona **Create Static Site**. |

Los recursos tienen rutas relativas. El sitio puede vivir en la raíz de un dominio o bajo un prefijo como `usuario.github.io/repositorio/`.

### Documentación oficial

- [Origen de publicación en GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Sitios sin paso de compilación en Vercel](https://vercel.com/docs/builds/configure-a-build#skip-build-step)
- [Sitios estáticos en Render](https://render.com/docs/static-sites)

## Preguntas

- En **Preguntas** se conservan las 5 preguntas originales del control, con revisión automática de respuestas.
- A su lado aparecen las 15 preguntas de `Preguntas_Monte_Carlo_15_Participacion.pdf`, con el texto y las respuestas orientativas del documento. Abre cada pregunta para consultar su respuesta. En pantallas pequeñas, este bloque aparece debajo del control.
- En **Manual** se explican la semilla, los botones y la lectura de resultados.

## Archivos principales

| Archivo | Función |
| --- | --- |
| `index.html` | Interfaz, contenido, preguntas, manual y bibliografía. |
| `assets/styles.css` | Diseño adaptable y transiciones. |
| `assets/simulation.js` | Generador reproducible, modelos, estimadores y comparación de corridas. |
| `assets/charts.js` | Gráficos en Canvas 2D, incluida la proyección del modelo tridimensional. |
| `assets/app.js` | Validación, controles, lectura de resultados y evaluación. |
| `assets/hero.svg` y `assets/favicon.svg` | Gráfico de portada e ícono. |
