"use strict";

(() => {
  const get = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const integer = new Intl.NumberFormat("es-EC");
  const decimal = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  const shortDecimal = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 6 });
  const percent = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const form = get("experiment-form");
  const canvas = get("plot");
  const plotArea = get("plot-area");
  const samples = get("samples");
  const seed = get("seed");
  const sampling = get("sampling");
  const target = get("dice-target");
  const fn = get("function");
  const lower = get("lower");
  const upper = get("upper");
  const speed = get("speed");
  const play = get("play");
  const finish = get("finish");
  const step = get("step");
  const reset = get("reset");
  const formMessage = get("form-message");
  const sampleDetails = get("sample-details");
  const tabs = all("[data-model]");
  const presets = all("[data-size]");

  const common = { samples: 1000, seed: 42 };
  const defaults = {
    pi: { ...common, mode: "pi", sampling: "uniform" },
    dice: { ...common, mode: "dice", target: 7 },
    integral: { ...common, mode: "integral", fn: "square", a: 0, b: 1 },
    volume: { ...common, mode: "volume" },
  };
  const descriptions = {
    pi: {
      title: "Estimar π",
      question: "¿Qué fracción del cuadrado ocupa un cuarto de círculo?",
      plot: "Cuadrado unidad",
      unit: "X, Y ∈ [0, 1]",
      legend: [["", "Dentro"], ["violet", "Fuera"]],
      input: "Punto (x, y)",
      evaluation: "x² + y²",
      formula: "π̂ = 4 × C / N",
      note: "Un acierto cumple x² + y² ≤ 1. El anillo marca la última muestra dibujada mientras esté visible.",
    },
    dice: {
      title: "Dos dados",
      question: "¿Con qué frecuencia aparece la suma que elegiste?",
      plot: "Distribución de la suma",
      unit: "Frecuencia relativa por suma",
      legend: [["", "Suma objetivo"], ["violet", "Otras sumas"], ["bias", "Frecuencia teórica"]],
      input: "Dados (d₁, d₂)",
      evaluation: "d₁ + d₂",
      formula: "p̂ = C / N",
      note: "Cada ensayo lanza dos dados justos e independientes. Las barras muestran proporciones observadas y las rayas, proporciones teóricas.",
    },
    integral: {
      title: "Integrar una función",
      question: "¿Qué integral obtenemos al promediar alturas aleatorias?",
      plot: "Curva y evaluaciones",
      legend: [["", "Evaluaciones f(x)"], ["violet", "Curva y región firmada"]],
      input: "Muestra x",
      evaluation: "f(x)",
      formula: "Î = (b − a) × promedio de f(x)",
      note: "Cada punto se dibuja en (x, f(x)). La región bajo el eje horizontal aporta con signo negativo.",
    },
    volume: {
      title: "Volumen 3D",
      question: "¿Qué volumen tiene una esfera de radio 1?",
      plot: "Octante de una esfera",
      unit: "X, Y, Z ∈ [0, 1]",
      legend: [["", "Dentro"], ["violet", "Fuera"], ["line", "Octante"], ["frame", "Cubo"]],
      input: "Punto (x, y, z)",
      evaluation: "x² + y² + z²",
      formula: "V̂ = 8 × C / N",
      note: "Arrastra para rotar o usa los botones. Los puntos se generan en el cubo unidad. Un acierto cumple x² + y² + z² ≤ 1.",
    },
  };

  const runs = Object.fromEntries(Object.entries(defaults).map(([key, config]) => [key, MonteCarlo.createRun(config)]));
  const views = { pi: "samples", dice: "samples", integral: "samples", volume: "samples" };
  const rotation = { yaw: -.56, pitch: .46 };
  let mode = "pi";
  let playing = false;
  let spinning = false;
  let frameId = 0;
  let lastFrame = 0;
  let lastDraw = 0;
  let sampleCredit = 0;
  let pointer = null;

  function fmt(value) {
    if (value === null) return "—";
    if (value !== 0 && Math.abs(value) < .0000005) return value.toExponential(2).replace(".", ",");
    return decimal.format(value);
  }

  function fmtResult(value, difference = false) {
    if (value === null) return "—";
    if (mode !== "dice") return fmt(value);
    return `${percent.format(value * 100)} ${difference ? "p. p." : "%"}`;
  }

  function messageFor(input) {
    if (input === samples) return "Escribe un número entero de muestras entre 1 y 100.000.";
    if (input === seed) return "Escribe una semilla entera entre 0 y 4.294.967.295.";
    if (input === target) return "Escribe una suma entera entre 2 y 12.";
    return "Escribe límites entre −5 y 5, con hasta seis decimales.";
  }

  function readConfig(focusInvalid = false) {
    const fields = [samples, seed, target, lower, upper].filter(input => !input.disabled);
    for (const field of fields) field.removeAttribute("aria-invalid");
    const invalid = fields.find(field => !field.validity.valid);
    const config = { mode, samples: samples.valueAsNumber, seed: seed.valueAsNumber };
    if (invalid) return reportError(invalid, messageFor(invalid), focusInvalid);
    if (mode === "pi") config.sampling = sampling.value;
    if (mode === "dice") config.target = target.valueAsNumber;
    if (mode === "integral") {
      config.fn = fn.value;
      config.a = lower.valueAsNumber;
      config.b = upper.valueAsNumber;
      if (config.a >= config.b) return reportError(upper, "El límite b debe ser mayor que a.", focusInvalid);
    }
    formMessage.hidden = true;
    return config;
  }

  function reportError(field, message, focusInvalid) {
    if (playing) {
      playing = false;
      updateButtons();
    }
    formMessage.textContent = message;
    formMessage.hidden = false;
    field.setAttribute("aria-invalid", "true");
    if (focusInvalid) field.focus();
    return null;
  }

  function changeSettings(focusInvalid = false) {
    const config = readConfig(focusInvalid);
    if (!config) return false;
    const previous = runs[mode].config;
    const changed = Object.keys(config).some(key => config[key] !== previous[key]);
    if (changed) {
      playing = false;
      sampleCredit = 0;
      runs[mode] = MonteCarlo.createRun(config);
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
    for (const field of [samples, seed, target, lower, upper]) field.removeAttribute("aria-invalid");
    for (const option of ["pi", "dice", "integral"]) {
      const group = get(`${option}-options`);
      group.hidden = mode !== option;
      for (const field of group.querySelectorAll("input, select")) field.disabled = group.hidden;
    }
    if (mode === "pi") sampling.value = config.sampling;
    if (mode === "dice") target.value = config.target;
    if (mode === "integral") {
      fn.value = config.fn;
      lower.value = config.a;
      upper.value = config.b;
    }
    for (const button of presets) button.setAttribute("aria-pressed", String(Number(button.dataset.size) === config.samples));
    const description = descriptions[mode];
    get("model-title").textContent = description.title;
    get("model-question").textContent = description.question;
    get("sample-input-title").textContent = description.input;
    get("sample-evaluation-title").textContent = description.evaluation;
  }

  function setMode(next) {
    if (next === mode) return;
    playing = false;
    spinning = false;
    sampleCredit = 0;
    pointer = null;
    mode = next;
    for (const tab of tabs) {
      const active = tab.dataset.model === mode;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    get("experiment-panel").setAttribute("aria-labelledby", `tab-${mode}`);
    get("announcement").textContent = "";
    showControls();
    updateView();
    updateReadout();
  }

  function updateLegend(items) {
    const legend = get("legend");
    legend.replaceChildren(...items.map(([key, label]) => {
      const item = document.createElement("span");
      const mark = document.createElement("i");
      mark.className = key ? `key key-${key}` : "key";
      mark.setAttribute("aria-hidden", "true");
      item.append(mark, label);
      return item;
    }));
  }

  function updateView() {
    const convergence = views[mode] === "convergence";
    const description = descriptions[mode];
    const { config } = runs[mode];
    const is3D = mode === "volume" && !convergence;
    get("show-samples").setAttribute("aria-pressed", String(!convergence));
    get("show-convergence").setAttribute("aria-pressed", String(convergence));
    get("rotate-controls").hidden = !is3D;
    get("rotate-auto").setAttribute("aria-pressed", String(spinning));
    plotArea.classList.toggle("is-3d", is3D);
    plotArea.classList.toggle("is-dragging", Boolean(pointer));
    get("plot-title").textContent = convergence ? "Estimación acumulada" : description.plot;
    if (convergence) get("plot-unit").textContent = "Estimación frente a referencia";
    else if (mode === "integral") get("plot-unit").textContent = `${MonteCarlo.functions[config.fn].label} en [${formatSample(config.a)}; ${formatSample(config.b)}]`;
    else get("plot-unit").textContent = description.unit;
    canvas.setAttribute("aria-label", convergence ? "Gráfico de convergencia de la estimación" : description.plot);
    if (convergence) {
      const legend = [["line", "Estimación"], ["reference", "Referencia"]];
      if (mode === "pi" && config.sampling === "biased") legend.push(["bias", "Límite con sesgo"]);
      updateLegend(legend);
    } else {
      updateLegend(description.legend);
    }
  }

  function formatSample(value) {
    if (value !== 0 && Math.abs(value) < .0000005) return value.toExponential(2).replace(".", ",");
    return shortDecimal.format(value);
  }

  function updateSamplesTable(run) {
    const body = get("sample-rows");
    if (!run.recent.length) {
      const row = body.insertRow();
      body.replaceChildren(row);
      const cell = row.insertCell();
      cell.colSpan = 4;
      cell.textContent = "Genera muestras para ver el detalle.";
      return;
    }
    const rows = run.recent.map(sample => {
      const row = document.createElement("tr");
      const coords = [sample.x, sample.y, sample.z].filter(value => value !== undefined);
      const location = coords.map(formatSample).join("; ");
      const result = formatSample(sample.evaluated);
      const contribution = mode === "integral" ? formatSample(sample.value) : sample.value ? "1 · acierto" : mode === "dice" ? "0 · otra suma" : "0 · fuera";
      const cells = [integer.format(sample.index), coords.length > 1 ? `(${location})` : location, result, contribution];
      for (const value of cells) row.insertCell().textContent = value;
      return row;
    });
    body.replaceChildren(...rows);
  }

  function updateExplanation(run) {
    const { config, n, total, reference } = run;
    const { formula } = descriptions[mode];
    const count = integer.format(total);
    let calculation = formula;
    let explanation;
    if (mode === "pi") {
      if (n) calculation = `π̂ = 4 × ${count} / ${integer.format(n)}`;
      explanation = n ? `${count} dentro y ${integer.format(n - total)} fuera.` : "C cuenta los puntos dentro del cuarto de círculo.";
      if (config.sampling === "biased") {
        explanation += ` En este modelo, la mitad de la probabilidad de muestreo va al subcuadrado de lado 0,5, que está completamente dentro. El límite de 4C/N es 2 + π/2 ≈ ${fmt(MonteCarlo.BIASED_LIMIT)}.`;
      }
    } else if (mode === "dice") {
      if (n) calculation = `p̂ = ${count} / ${integer.format(n)}`;
      explanation = `P(suma = ${config.target}) = ${MonteCarlo.diceWays(config.target)}/36. Cada pareja ordenada tiene probabilidad 1/36.`;
      if (n) {
        const last = run.recent.at(-1);
        explanation += ` El último tiro fue ${last.x} + ${last.y} = ${last.evaluated}.`;
      }
    } else if (mode === "integral") {
      if (n) calculation = `Î = ${formatSample(run.scale)} × (${formatSample(total / n)})`;
      explanation = `Se promedia f(x) y se multiplica por el ancho b − a. La referencia se calcula con una primitiva de f(x) y vale ${fmt(reference)}.`;
    } else {
      if (n) calculation = `V̂ = 8 × ${count} / ${integer.format(n)}`;
      explanation = "C/N estima el volumen de un octante dentro de un cubo de volumen 1. La esfera completa tiene ocho octantes y volumen teórico 4π/3.";
    }
    get("live-formula").textContent = calculation;
    get("live-explanation").textContent = explanation;
  }

  function updateReadout() {
    const run = runs[mode];
    const { n, config, reference } = run;
    const { estimate, error, standardError } = MonteCarlo.statistics(run);
    get("progress").textContent = `${integer.format(n)} / ${integer.format(config.samples)} muestras`;
    get("progress-fill").style.width = `${n / config.samples * 100}%`;
    get("estimate").textContent = fmtResult(estimate);
    get("reference").textContent = fmtResult(reference);
    get("error").textContent = fmtResult(error, true);
    get("standard-error").textContent = fmtResult(standardError, true);
    const convergence = views[mode] === "convergence";
    let note = convergence ? "Cada punto de la curva resume todas las muestras acumuladas hasta ese tamaño." : descriptions[mode].note;
    if (!convergence && mode !== "dice" && run.points.length < n) {
      note += ` Se dibujan las primeras ${integer.format(run.points.length)} de ${integer.format(n)} muestras. El cálculo usa todas.`;
    }
    get("plot-note").textContent = note;
    updateExplanation(run);
    if (sampleDetails.open) updateSamplesTable(run);
    updateButtons();
    draw();
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
      const batch = Math.floor(sampleCredit);
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
