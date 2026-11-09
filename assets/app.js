"use strict";

(() => {
  const get = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const integer = new Intl.NumberFormat("es-EC");
  const decimal = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  const shortDecimal = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 6 });
  const percent = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const form = get("experiment-form");
  const canvas = get("plot");
  const plotArea = get("plot-area");
  const samples = get("samples");
  const seed = get("seed");
  const sampling = get("sampling");
  const speed = get("speed");
  const play = get("play");
  const finish = get("finish");
  const step = get("step");
  const reset = get("reset");
  const formMessage = get("form-message");
  const sampleDetails = get("sample-details");
  const tabs = all("[data-model]");
  const presets = all("[data-size]");
  const scenarioFields = {
    hospital: { patients: get("hospital-patients"), doctors: get("hospital-doctors"), minutes: get("hospital-minutes"), hours: get("hospital-hours"), emergency: get("hospital-emergency") },
    finance: { initial: get("finance-initial"), annualReturn: get("finance-return"), volatility: get("finance-volatility"), gainThreshold: get("finance-threshold") },
  };
  const common = { samples: 1000, seed: 42 };
  const defaults = {
    pi: { ...common, mode: "pi", sampling: "uniform" },
    volume: { ...common, mode: "volume" },
    hospital: { samples: 10000, seed: 42, mode: "hospital", patients: 60, doctors: 4, minutes: 25, hours: 8, emergency: 10 },
    finance: { samples: 10000, seed: 42, mode: "finance", initial: 1000, annualReturn: 6, volatility: 20, gainThreshold: 150 },
  };
  const descriptions = {
    pi: {
      title: "Estimar π", question: "¿Qué fracción del cuadrado ocupa un cuarto de círculo?",
      plot: "Cuadrado unidad", unit: "X, Y ∈ [0, 1]", legend: [["", "Dentro"], ["violet", "Fuera"]],
      input: "Punto (x, y)", evaluation: "x² + y²", formula: "π̂ = 4 × C / N",
      note: "Un punto cuenta como dentro si x² + y² ≤ 1, incluida la frontera. El anillo marca la última muestra dibujada mientras esté visible.",
      story: "Como calcular el área de un lago", analogy: "Si distribuyes puntos uniformemente sobre un mapa, su proporción dentro de un lago aproxima la proporción de área que ocupa. Aquí el lago es un cuarto de círculo dentro de un cuadrado.",
      purpose: "Buscamos π. Sabemos su valor para comprobar si Monte Carlo se aproxima bien; no estamos cambiando el número π.",
      assumptions: "Cada intento genera dos coordenadas entre 0 y 1. C cuenta los puntos dentro y N todos los puntos procesados. La proporción C/N aproxima π/4; por eso multiplicamos por 4. El muestreo uniforme permite esta comparación de áreas. La opción sesgada concentra puntos cerca del origen y demuestra que más muestras no corrigen un muestreo inadecuado.",
    },
    volume: {
      title: "Volumen 3D", question: "¿Cuánto espacio ocupa una esfera de radio 1?",
      plot: "Una octava parte de la esfera", unit: "X, Y, Z ∈ [0, 1]", legend: [["", "Dentro"], ["violet", "Fuera"], ["line", "Octante"], ["frame", "Cubo"]],
      input: "Punto (x, y, z)", evaluation: "x² + y² + z²", formula: "V̂ = 8 × C / N",
      note: "Arrastra para girar el cubo o usa los botones. Un punto cuenta como dentro si x² + y² + z² ≤ 1.",
      story: "Una naranja cortada en ocho", analogy: "Imagina una naranja esférica cortada por el centro en ocho partes iguales. Una parte cabe en la esquina de un cubo cuyo lado mide lo mismo que el radio. Los puntos nos dicen qué fracción del cubo ocupa ese trozo.",
      purpose: "Buscamos un volumen, no π: al multiplicar la fracción por 8 recuperamos la esfera completa. La referencia es 4π/3 ≈ 4,188790 unidades cúbicas.",
      assumptions: "El cubo tiene lado y volumen 1. Generamos puntos uniformes con tres coordenadas entre 0 y 1. El octante es una octava parte de una esfera de radio 1. C/N estima el volumen del trozo; 8 × C/N estima la esfera. La referencia 4π/3 se conoce porque esta figura tiene una fórmula sencilla.",
    },
    hospital: {
      title: "Un hospital", question: "¿La capacidad de los médicos alcanza para la demanda del día?",
      plot: "¿Cómo terminan los días simulados?", unit: "Porcentaje de días · modelo educativo", legend: [["", "Normal / con margen"], ["violet", "Presión de atención"], ["pale", "Saturación"]],
      input: "Pacientes / emergencias", evaluation: "Carga / capacidad", formula: "Saturación (%) = días saturados ÷ días simulados × 100",
      note: "Cada barra cuenta días completos: con margen, con presión de atención o con demanda superior a la capacidad. Las categorías suman todos los días simulados.",
      story: "Ensayar 10.000 mañanas antes de contratar", analogy: "Como administrador, no sabes cuántos pacientes llegarán, cuánto durará cada consulta ni cuántas emergencias habrá. La computadora ensaya muchos días con diferentes combinaciones y compara el trabajo necesario con los médicos disponibles.",
      purpose: "Monte Carlo ayuda a estudiar el riesgo de sobrecarga antes de cambiar los recursos. Prueba un médico más con exactamente los mismos días y compara.",
      assumptions: "Modelo educativo de carga diaria, no de colas clínicas: no calcula minutos de espera ni el orden de llegada. Los pacientes diarios se sortean uniformemente entre el promedio menos y más el 30 % redondeado hacia abajo. Cada consulta dura entre el 50 % y el 150 % del tiempo base; una emergencia multiplica su duración por 3. Capacidad = médicos × horas × 60 minutos. Elegimos estos umbrales didácticos: hasta el 85 % de capacidad es normal/con margen; más del 85 % y hasta el 100 % es presión o posibles esperas; más del 100 % es saturación. No son estándares médicos. Los supuestos no proceden de un hospital real.",
    },
    finance: {
      title: "¿Qué pasará con tus $1.000?", question: "¿Qué ganancias y pérdidas permite nuestro modelo a un año?",
      plot: "Resultados posibles al cabo de un año", unit: "Porcentaje de escenarios · cifras simuladas", legend: [["violet", "Pérdida"], ["", "Ganancia hasta el umbral"], ["pale", "Ganancia mayor al umbral"]],
      input: "Dinero al año", evaluation: "Ganancia / pérdida", formula: "Pérdida (%) = escenarios con pérdida ÷ total × 100",
      note: "Cada escenario representa un año alternativo. Pérdida: menos del capital inicial. Ganancia moderada: de $0 hasta el umbral, incluidos los extremos. Ganancia mayor: supera el umbral.",
      story: "La misma inversión, muchos años posibles", analogy: "Imagina repetir el próximo año muchas veces: en unas versiones los precios suben y en otras bajan. Simulamos un rendimiento anual por escenario y contamos qué resultados aparecen, sin afirmar cuál ocurrirá en la realidad.",
      purpose: "Monte Carlo permite ver pérdidas y ganancias posibles, no solo un promedio. Cambia la variación anual para observar cómo se dispersan los resultados.",
      assumptions: "Ejemplo hipotético, no predicción de rentabilidad. No usa datos de mercado. El valor final se genera con una distribución lognormal, siempre positiva, ajustada a la media y desviación anual que eliges. Se sortea un rendimiento anual por escenario; no se simulan precios día a día. Con variación 0 todos los escenarios tienen el rendimiento medio. Las categorías se calculan con valores originales, aunque la tabla redondee a centavos. Excluye comisiones, impuestos e inflación. La media del modelo puede ser positiva y aun así existir muchos escenarios con pérdidas.",
    },
  };
  const runs = Object.fromEntries(Object.entries(defaults).map(([key, config]) => [key, MonteCarlo.createRun(config)]));
  const views = { pi: "samples", volume: "samples", hospital: "samples", finance: "samples" };
  const seen = new Set(["pi"]);
  const rotation = { yaw: -.56, pitch: .46 };
  let mode = "pi";
  let playing = false;
  let spinning = false;
  let frameId = 0;
  let lastFrame = 0;
  let lastDraw = 0;
  let sampleCredit = 0;
  let pointer = null;
  const isScenario = () => mode === "hospital" || mode === "finance";
  const pct = value => value === null ? "—" : `${percent.format(value * 100)} %`;
  function fmt(value) {
    if (value === null || !Number.isFinite(value)) return "—";
    if (value !== 0 && Math.abs(value) < .0000005) return value.toExponential(2).replace(".", ",");
    return decimal.format(value);
  }
  function fmtResult(value, difference = false) {
    if (!isScenario()) return fmt(value);
    return value === null ? "—" : `${percent.format(value * 100)} ${difference ? "p. p." : "%"}`;
  }
  function messageFor(input) {
    if (input === samples) return "Escribe un número entero de muestras entre 1 y 100.000.";
    if (input === seed) return "Escribe una semilla entera entre 0 y 4.294.967.295.";
    const name = input.labels?.[0]?.textContent || "Este dato";
    return `${name}: escribe un valor entre ${input.min} y ${input.max}, respetando el paso ${input.step}.`;
  }
  function readConfig(focusInvalid = false) {
    const fields = [...form.querySelectorAll('input[type="number"]')].filter(input => !input.disabled);
    for (const field of fields) field.removeAttribute("aria-invalid");
    const invalid = fields.find(field => !field.validity.valid);
    if (invalid) return reportError(invalid, messageFor(invalid), focusInvalid);
    const config = { mode, samples: samples.valueAsNumber, seed: seed.valueAsNumber };
    if (mode === "pi") config.sampling = sampling.value;
    if (scenarioFields[mode]) for (const [key, field] of Object.entries(scenarioFields[mode])) config[key] = field.valueAsNumber;
    formMessage.hidden = true;
    return config;
  }
  function reportError(field, message, focusInvalid) {
    if (playing) { playing = false; updateButtons(); }
    formMessage.textContent = message;
    formMessage.hidden = false;
    field.setAttribute("aria-invalid", "true");
    if (focusInvalid) field.focus();
    return null;
  }
  function clearComparison() { get("comparison-result").textContent = ""; }
  function changeSettings(focusInvalid = false) {
    const config = readConfig(focusInvalid);
    if (!config) return false;
    const previous = runs[mode].config;
    if (Object.keys(config).some(key => config[key] !== previous[key])) {
      playing = false;
      sampleCredit = 0;
      runs[mode] = MonteCarlo.createRun(config);
      clearComparison();
      updateView();
      updateReadout();
    }
    for (const button of presets) button.setAttribute("aria-pressed", String(Number(button.dataset.size) === config.samples));
    return true;
  }
  function showControls() {
    const { config } = runs[mode];
    samples.value = config.samples;
    seed.value = config.seed;
    formMessage.hidden = true;
    for (const field of form.querySelectorAll("input")) field.removeAttribute("aria-invalid");
    for (const option of ["pi", "hospital", "finance"]) {
      const group = get(`${option}-options`);
      group.hidden = mode !== option;
      for (const field of group.querySelectorAll("input, select")) field.disabled = group.hidden;
    }
    if (mode === "pi") sampling.value = config.sampling;
    if (scenarioFields[mode]) for (const [key, field] of Object.entries(scenarioFields[mode])) field.value = config[key];
    for (const button of presets) button.setAttribute("aria-pressed", String(Number(button.dataset.size) === config.samples));
    const d = descriptions[mode];
    get("model-title").textContent = d.title;
    get("model-question").textContent = d.question;
    get("sample-input-title").textContent = d.input;
    get("sample-evaluation-title").textContent = d.evaluation;
    get("sample-value-title").textContent = isScenario() ? "Clasificación" : "Aporta";
    get("model-story-title").textContent = d.story;
    get("model-analogy").textContent = d.analogy;
    get("model-purpose").textContent = d.purpose;
    get("assumption-copy").textContent = d.assumptions;
    get("scenario-results").hidden = !isScenario();
    get("hospital-comparison").hidden = mode !== "hospital";
    get("show-samples").textContent = isScenario() ? "Resultados" : "Muestras";
    get("outcome-caption").textContent = mode === "hospital" ? "Días simulados por resultado" : "Escenarios de inversión a un año";
    clearComparison();
  }
  function setMode(next) {
    if (next === mode) return;
    playing = false; spinning = false; sampleCredit = 0; pointer = null;
    mode = next;
    if (!seen.has(mode)) {
      seen.add(mode);
      if (isScenario()) MonteCarlo.advance(runs[mode], runs[mode].config.samples);
    }
    for (const tab of tabs) {
      const active = tab.dataset.model === mode;
      tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1;
    }
    get("experiment-panel").setAttribute("aria-labelledby", `tab-${mode}`);
    get("announcement").textContent = "";
    showControls(); updateView(); updateReadout();
  }
  function updateLegend(items) {
    get("legend").replaceChildren(...items.map(([key, label]) => {
      const item = document.createElement("span"); const mark = document.createElement("i");
      mark.className = key ? `key key-${key}` : "key"; mark.setAttribute("aria-hidden", "true");
      item.append(mark, label); return item;
    }));
  }
  function updateView() {
    const convergence = views[mode] === "convergence";
    const d = descriptions[mode]; const { config } = runs[mode];
    const is3D = mode === "volume" && !convergence;
    get("show-samples").setAttribute("aria-pressed", String(!convergence));
    get("show-convergence").setAttribute("aria-pressed", String(convergence));
    get("rotate-controls").hidden = !is3D;
    get("rotate-auto").setAttribute("aria-pressed", String(spinning));
    plotArea.classList.toggle("is-3d", is3D); plotArea.classList.toggle("is-dragging", Boolean(pointer));
    get("plot-title").textContent = convergence ? (mode === "hospital" ? "¿Se estabiliza la probabilidad de saturación?" : mode === "finance" ? "¿Se estabiliza la probabilidad de pérdida?" : "Estimación acumulada") : d.plot;
    get("plot-unit").textContent = convergence ? (isScenario() ? "Probabilidad estimada · sin referencia futura conocida" : "Estimación frente a referencia") : d.unit;
    canvas.setAttribute("aria-label", convergence ? "Gráfico de convergencia: evolución de la estimación con más muestras. Los resultados numéricos aparecen debajo." : d.plot);
    if (convergence) {
      const legend = [["line", isScenario() ? "Probabilidad estimada" : "Estimación"]];
      if (!isScenario()) legend.push(["reference", "Referencia"]);
      if (mode === "pi" && config.sampling === "biased") legend.push(["bias", "Límite con sesgo"]);
      updateLegend(legend);
    } else updateLegend(d.legend);
  }
  function formatSample(value) {
    if (value !== 0 && Math.abs(value) < .0000005) return value.toExponential(2).replace(".", ",");
    return shortDecimal.format(value);
  }
  function outcomeLabels(config) {
    return mode === "hospital" ? ["Normal · con margen", "Presión · posibles esperas", "Saturación · demanda supera capacidad"] : ["Pierdes dinero", config.gainThreshold === 0 ? "Sin ganancia ni pérdida" : `Ganas de ${money.format(0)} a ${money.format(config.gainThreshold)}`, `Ganas más de ${money.format(config.gainThreshold)}`];
  }
  function updateSamplesTable(run) {
    const body = get("sample-rows");
    if (!run.recent.length) {
      const row = document.createElement("tr"); const cell = row.insertCell(); cell.colSpan = 4;
      cell.textContent = "Genera muestras para ver el detalle."; body.replaceChildren(row); return;
    }
    const rows = run.recent.map(sample => {
      const row = document.createElement("tr"); let cells;
      if (mode === "hospital") cells = [integer.format(sample.index), `${sample.x} pacientes / ${sample.emergencies} emergencias`, `${percent.format(sample.evaluated * 100)} %`, outcomeLabels(run.config)[sample.category]];
      else if (mode === "finance") cells = [integer.format(sample.index), money.format(sample.final), money.format(sample.profit), outcomeLabels(run.config)[sample.category]];
      else {
        const coords = [sample.x, sample.y, sample.z].filter(value => value !== undefined);
        cells = [integer.format(sample.index), `(${coords.map(formatSample).join("; ")})`, formatSample(sample.evaluated), sample.value ? "1 · dentro" : "0 · fuera"];
      }
      for (const value of cells) row.insertCell().textContent = value;
      return row;
    });
    body.replaceChildren(...rows);
  }
  function updateScenarioTable(run, stats) {
    const labels = outcomeLabels(run.config);
    const rows = labels.map((label, index) => {
      const row = document.createElement("tr"); const title = document.createElement("th"); title.scope = "row";
      title.textContent = label; row.append(title);
      row.insertCell().textContent = integer.format(stats.counts[index]);
      row.insertCell().textContent = run.n ? pct(stats.proportions[index]) : "—";
      return row;
    });
    const total = document.createElement("tr"); total.className = "total-row";
    const title = document.createElement("th"); title.scope = "row"; title.textContent = "Total"; total.append(title);
    total.insertCell().textContent = integer.format(run.n); total.insertCell().textContent = run.n ? "100 %" : "—";
    get("outcome-rows").replaceChildren(...rows, total);
  }
  function updateExplanation(run) {
    const { config, n, total } = run;
    let calculation = descriptions[mode].formula; let explanation;
    if (mode === "pi") {
      if (n) calculation = `π̂ = 4 × ${integer.format(total)} / ${integer.format(n)}`;
      explanation = n ? `${integer.format(total)} dentro y ${integer.format(n - total)} fuera. C son los puntos dentro; N, todos los utilizados.` : "C cuenta los puntos dentro; N cuenta todos los puntos procesados.";
      if (config.sampling === "biased") explanation += ` El muestreo está sesgado: este cálculo tiende a ${fmt(MonteCarlo.BIASED_LIMIT)}, no a π.`;
    } else if (mode === "volume") {
      if (n) calculation = `V̂ = 8 × ${integer.format(total)} / ${integer.format(n)}`;
      explanation = "C/N estima la fracción del cubo que ocupa un octante. Multiplicamos por 8 para recuperar la esfera completa.";
    } else {
      if (n) calculation = `${mode === "hospital" ? "Saturación" : "Pérdida"} = ${integer.format(total)} / ${integer.format(n)} × 100`;
      explanation = mode === "hospital" ? "Cada día saturado aporta 1; los demás, 0. Contamos la proporción de días cuya demanda supera la capacidad." : "Cada escenario que termina con menos dinero del inicial aporta 1; los demás, 0. La frecuencia aproxima la probabilidad de pérdida del modelo.";
    }
    get("live-formula").textContent = calculation; get("live-explanation").textContent = explanation;
  }
  function updateConclusion(run, stats) {
    const { config, n } = run;
    const summary = MonteCarlo.statistics(run);
    let conclusion, why, next;
    if (!n) {
      conclusion = "La corrida está en cero. Pulsa «Calcular todo» para generar los intentos y obtener una conclusión con tus datos.";
      why = "Cambiar un parámetro prepara una nueva corrida: los resultados anteriores ya no describen esta configuración.";
      next = isScenario() ? "Prueba con 10.000 escenarios y luego cambia solo un dato para poder comparar." : "Usa «+1 muestra» para observar cómo aporta cada punto.";
    } else if (mode === "hospital") {
      conclusion = `Con ${config.doctors} médicos, hubo saturación en ${integer.format(stats.counts[2])} de ${integer.format(n)} días: ${pct(stats.proportions[2])} según este modelo.`;
      why = `La capacidad diaria es ${integer.format(stats.capacity)} minutos. La demanda media simulada fue ${integer.format(Math.round(stats.averageWorkload))} minutos para ${percent.format(stats.averagePatients)} pacientes. Las llegadas, duraciones y emergencias varían; por eso el promedio no describe todos los días. «Presión» señala poco margen, no un tiempo de espera medido.`;
      next = "Prueba «Comparar con 1 médico más»: conserva los mismos pacientes y consultas, aumenta la capacidad y compara el riesgo. Esto ayuda a estudiar recursos antes de actuar.";
      if (stats.counts[2] === 0) conclusion += " No observar saturación no demuestra que sea imposible.";
    } else if (mode === "finance") {
      const max = Math.max(...stats.counts); const winners = stats.counts.map((count, index) => count === max ? index : -1).filter(index => index >= 0);
      const label = outcomeLabels(config);
      conclusion = winners.length > 1 ? "Hay un empate entre las categorías con más escenarios." : `La categoría más frecuente fue «${label[winners[0]]}»: ${pct(stats.proportions[winners[0]])} de los escenarios.`;
      conclusion += ` Sumando las dos categorías sin pérdida, ${pct(1 - stats.lossFraction)} terminó con el capital inicial o más. El dinero final promedio fue ${money.format(stats.averageFinal)}.`;
      why = `El rendimiento medio supuesto es ${percent.format(config.annualReturn)} % y la desviación del rendimiento anual es ${percent.format(config.volatility)} puntos porcentuales. ${config.volatility === 0 ? "Sin variación, todos los escenarios dan el mismo resultado." : "La variación genera años favorables y desfavorables; un promedio positivo no garantiza una ganancia."} La categoría más frecuente también depende del umbral de ganancia elegido. Son resultados de supuestos, no una predicción del mercado.`;
      next = "Cambia la variación anual y conserva la semilla. Observa cómo cambian las pérdidas y ganancias; aumentar las simulaciones no elimina el riesgo del modelo.";
    } else {
      const goal = mode === "pi" ? "π" : "el volumen de la esfera";
      conclusion = `Con ${integer.format(n)} puntos, estimamos ${goal} en ${fmt(summary.estimate)}. La referencia es ${fmt(run.reference)} y la diferencia absoluta es ${fmt(summary.error)}.`;
      why = mode === "pi" ? "La proporción dentro aproxima el área de un cuarto de círculo (π/4); al multiplicar por 4 estimamos π." : "La proporción dentro aproxima un octante de la esfera en un cubo de volumen 1; al multiplicar por 8 estimamos el volumen completo.";
      if (mode === "pi" && config.sampling === "biased") why = "La distribución concentra demasiados puntos dentro. Más puntos pueden estabilizar una respuesta equivocada: hace falta un muestreo adecuado.";
      next = "Compara 100 y 10.000 puntos con la misma semilla. En «Convergencia», la curva muestra cómo cambia la estimación, no cómo cambia la referencia.";
    }
    if (n > 0 && n < 30) next = "Esta corrida tiene muy pocas muestras; observa cómo cambia al completar más intentos. " + next;
    get("conclusion").textContent = conclusion; get("conclusion-why").textContent = why; get("try-next").textContent = next;
  }
  function updateReadout() {
    const run = runs[mode]; const { n, config, reference } = run;
    const { estimate, error, standardError } = MonteCarlo.statistics(run);
    const stats = isScenario() ? MonteCarlo.applicationStatistics(run) : null;
    if (mode === "finance") get("model-title").textContent = `¿Qué pasará con ${money.format(config.initial)}?`;
    get("progress").textContent = `${integer.format(n)} / ${integer.format(config.samples)} ${mode === "hospital" ? "días" : mode === "finance" ? "escenarios" : "muestras"}`;
    get("progress-fill").style.width = `${n / config.samples * 100}%`;
    get("estimate-label").textContent = mode === "hospital" ? "Probabilidad de saturación" : mode === "finance" ? "Probabilidad de pérdida" : "Estimación";
    get("reference-label").textContent = mode === "hospital" ? "Capacidad diaria" : mode === "finance" ? "Dinero final promedio" : "Referencia conocida";
    get("error-label").textContent = mode === "hospital" ? "Demanda media diaria" : mode === "finance" ? "Ganancia media" : "Error absoluto";
    get("standard-error-label").textContent = isScenario() ? "Error estándar est. (p. p.)" : "Error estándar est.";
    get("estimate").textContent = fmtResult(estimate);
    get("reference").textContent = mode === "hospital" ? `${integer.format(stats.capacity)} min` : mode === "finance" ? n ? money.format(stats.averageFinal) : "—" : fmt(reference);
    get("error").textContent = mode === "hospital" ? n ? `${integer.format(Math.round(stats.averageWorkload))} min` : "—" : mode === "finance" ? n ? money.format(stats.averageProfit) : "—" : fmt(error);
    get("standard-error").textContent = fmtResult(standardError, true);
    let note = views[mode] === "convergence" ? "El eje horizontal cuenta intentos (escala logarítmica). Cada punto de la curva resume todas las muestras acumuladas: estabilizarse significa variar menos, no garantizar una respuesta correcta." : descriptions[mode].note;
    if (views[mode] !== "convergence" && !isScenario() && run.points.length < n) note += ` Se dibujan las primeras ${integer.format(run.points.length)} de ${integer.format(n)} muestras; el cálculo usa todas.`;
    if (isScenario() && n > 1 && standardError === 0) note += " Error estándar 0: todos los aportes observados fueron iguales; no demuestra certeza sobre la realidad.";
    get("plot-note").textContent = note;
    if (isScenario()) updateScenarioTable(run, stats);
    get("compare-staff").disabled = mode === "hospital" && config.doctors >= 50;
    updateExplanation(run); updateConclusion(run, stats);
    if (sampleDetails.open) updateSamplesTable(run);
    updateButtons(); draw();
  }

  function updateButtons() {
    const { n, config } = runs[mode];
    const complete = n === config.samples;
    get("play-icon").setAttribute("href", playing ? "#i-pause" : "#i-play");
    get("play-label").textContent = playing ? "Pausar" : complete ? "Repetir animación" : "Animar corrida";
    step.disabled = playing || complete;
    finish.disabled = complete;
  }

  function announce() {
    const run = runs[mode];
    const { estimate } = MonteCarlo.statistics(run);
    get("announcement").textContent = run.n
      ? `${integer.format(run.n)} muestras. Estimación ${fmtResult(estimate)}.`
      : "Corrida reiniciada. Cero muestras.";
  }

  function draw() {
    MonteCharts.render(canvas, runs[mode], views[mode], rotation);
  }

  function scheduleFrame() {
    if (!frameId) {
      lastFrame = performance.now();
      frameId = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frameId = 0;
    const dt = Math.max(0, Math.min(64, now - lastFrame));
    lastFrame = now;
    if (spinning) rotation.yaw += dt * .00048;
    if (playing) {
      const run = runs[mode];
      const duration = { slow: 12, normal: 5.5, fast: 2.3 }[speed.value];
      const samplesPerSecond = Math.max(2, run.config.samples / duration);
      sampleCredit += dt * samplesPerSecond / 1000;
      const batch = Math.min(Math.floor(sampleCredit), mode === "hospital" ? 300 : 100000);
      if (batch) {
        sampleCredit -= batch;
        MonteCarlo.advance(run, batch);
      }
      if (run.n === run.config.samples) {
        playing = false;
        updateReadout();
        announce();
      } else if (now - lastDraw >= 32) {
        lastDraw = now;
        updateReadout();
      }
    } else if (spinning) {
      draw();
    }
    if (playing || spinning) frameId = requestAnimationFrame(tick);
  }

  function restart() {
    playing = false;
    sampleCredit = 0;
    runs[mode] = MonteCarlo.createRun(runs[mode].config);
    clearComparison();
    updateReadout();
  }

  function processSamples(count) {
    if (!changeSettings(true)) return;
    playing = false;
    sampleCredit = 0;
    MonteCarlo.advance(runs[mode], count);
    updateReadout();
    announce();
  }

  get("compare-staff").addEventListener("click", () => {
    if (mode !== "hospital" || !changeSettings(true)) return;
    const base = runs.hospital;
    if (base.config.doctors >= 50) return;
    playing = false;
    MonteCarlo.advance(base, base.config.samples);
    const alternative = MonteCarlo.createRun({ ...base.config, doctors: base.config.doctors + 1 });
    MonteCarlo.advance(alternative, alternative.config.samples);
    updateReadout();
    const before = MonteCarlo.applicationStatistics(base);
    const after = MonteCarlo.applicationStatistics(alternative);
    const difference = (before.proportions[2] - after.proportions[2]) * 100;
    get("comparison-result").textContent = `Con los mismos ${integer.format(base.n)} días: ${base.config.doctors} médicos → ${pct(before.proportions[2])} de saturación; ${alternative.config.doctors} médicos → ${pct(after.proportions[2])}. Diferencia: ${percent.format(difference)} puntos porcentuales. Cambia solo la capacidad; la demanda simulada es idéntica. Es una comparación del modelo para estudiar el refuerzo de personal.`;
    announce();
  });
  for (const link of all("[data-open-model]")) link.addEventListener("click", () => setMode(link.dataset.openModel));

  form.noValidate = true;
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (playing) {
      playing = false;
      updateReadout();
      announce();
      return;
    }
    if (!changeSettings(true)) return;
    if (runs[mode].n === runs[mode].config.samples) restart();
    playing = true;
    updateButtons();
    scheduleFrame();
  });
  form.addEventListener("input", event => {
    if (event.target.type === "number") changeSettings();
  });
  form.addEventListener("change", event => {
    if (event.target.tagName === "SELECT" && event.target !== speed) changeSettings();
  });
  for (const button of presets) button.addEventListener("click", () => {
    samples.value = button.dataset.size;
    changeSettings(true);
  });
  get("new-seed").addEventListener("click", () => {
    const previous = runs[mode].config.seed;
    const next = Math.floor(Math.random() * 2 ** 32);
    seed.value = next === previous ? (next + 1) >>> 0 : next;
    changeSettings(true);
  });
  finish.addEventListener("click", () => processSamples(100000));
  step.addEventListener("click", () => processSamples(1));
  reset.addEventListener("click", () => {
    if (!changeSettings(true)) return;
    restart();
    announce();
  });

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => setMode(tab.dataset.model));
    tab.addEventListener("keydown", event => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
      let next;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else if (Object.hasOwn(offsets, event.key)) next = (index + offsets[event.key] + tabs.length) % tabs.length;
      else return;
      event.preventDefault();
      tabs[next].focus();
      setMode(tabs[next].dataset.model);
    });
  }

  for (const view of ["samples", "convergence"]) {
    get(`show-${view}`).addEventListener("click", () => {
      if (views[mode] === view) return;
      views[mode] = view;
      spinning = false;
      pointer = null;
      updateView();
      updateReadout();
    });
  }

  function rotate(yaw, pitch = 0) {
    rotation.yaw = (rotation.yaw + yaw) % (2 * Math.PI);
    rotation.pitch = Math.max(-1.25, Math.min(1.25, rotation.pitch + pitch));
    draw();
  }

  get("rotate-left").addEventListener("click", () => rotate(-.3));
  get("rotate-right").addEventListener("click", () => rotate(.3));
  get("rotate-auto").addEventListener("click", () => {
    spinning = !spinning;
    get("rotate-auto").setAttribute("aria-pressed", String(spinning));
    if (spinning) scheduleFrame();
  });
  plotArea.addEventListener("pointerdown", event => {
    if (mode !== "volume" || views[mode] !== "samples" || event.button !== 0 || pointer) return;
    spinning = false;
    get("rotate-auto").setAttribute("aria-pressed", "false");
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    plotArea.setPointerCapture(event.pointerId);
    plotArea.classList.add("is-dragging");
  });
  plotArea.addEventListener("pointermove", event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    rotate((event.clientX - pointer.x) * .012, (event.clientY - pointer.y) * .012);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
    plotArea.addEventListener(name, event => {
      if (pointer?.id !== event.pointerId) return;
      pointer = null;
      plotArea.classList.remove("is-dragging");
    });
  }
  sampleDetails.addEventListener("toggle", () => {
    if (sampleDetails.open) updateSamplesTable(runs[mode]);
  });
  if ("ResizeObserver" in window) new ResizeObserver(draw).observe(plotArea);
  else window.addEventListener("resize", draw);

  const repeatCount = get("repeat-count");
  let compared = false;
  function compareRuns() {
    const count = Number(repeatCount.value);
    const rows = MonteCarlo.repeatedPi(count).map(({ n, observed, theoretical }) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = integer.format(n);
      row.append(label);
      row.insertCell().textContent = fmt(observed);
      row.insertCell().textContent = fmt(theoretical);
      return row;
    });
    get("repeat-rows").replaceChildren(...rows);
    get("repeat-status").textContent = `${count} corridas por tamaño. El valor teórico se reduce a la mitad en cada fila.`;
    compared = true;
  }
  get("compare-runs").addEventListener("click", compareRuns);
  repeatCount.addEventListener("change", () => {
    if (compared) compareRuns();
  });

  const quiz = get("quiz");
  const questions = [...quiz.querySelectorAll("fieldset")];
  const score = get("quiz-score");
  quiz.addEventListener("submit", event => {
    event.preventDefault();
    let points = 0;
    for (const question of questions) {
      const correct = question.querySelector("input:checked").value === question.dataset.correct;
      points += Number(correct);
      const feedback = question.querySelector(".quiz-feedback");
      feedback.dataset.correct = String(correct);
      feedback.textContent = `${correct ? "Correcto." : "Revisa esta idea."} ${question.dataset.explanation}`;
      feedback.hidden = false;
    }
    score.textContent = `${points} de ${questions.length} respuestas correctas.`;
  });

  function clearFeedback() {
    for (const feedback of quiz.querySelectorAll(".quiz-feedback")) feedback.hidden = true;
    score.textContent = "";
  }
  quiz.addEventListener("reset", clearFeedback);
  quiz.addEventListener("change", clearFeedback);

  const sources = get("bibliografia");
  for (const link of all('a[href^="#ref-"]')) {
    link.addEventListener("click", () => { sources.open = true; });
  }
  if (location.hash.startsWith("#ref-")) sources.open = true;

  MonteCarlo.advance(runs.pi, 120);
  showControls();
  updateView();
  updateReadout();
})();
