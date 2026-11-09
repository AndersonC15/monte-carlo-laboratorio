"use strict";

const MonteCharts = (() => {
  const ink = "#100e21";
  const grid = "#a890ff32";
  const frame = "#c8b5f286";
  const text = "#c9bddf";
  const mint = "#60e6ce";
  const violet = "#a890ff";
  const pale = "#eee7fd";
  const number = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 4 });

  function labelNumber(value) {
    return Math.abs(value) >= .0001 || value === 0
      ? number.format(value)
      : value.toExponential(1).replace(".", ",");
  }

  function line(ctx, x0, y0, x1, y1, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function dot(ctx, x, y, size, color, square = false) {
    ctx.fillStyle = color;
    if (square) {
      ctx.fillRect(x - size, y - size, 2 * size, 2 * size);
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();
  }

  function label(ctx, value, x, y, align = "center", color = text) {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.font = '11px ui-monospace, "DejaVu Sans Mono", monospace';
    ctx.fillText(value, x, y);
  }

  function gridBox(ctx, { left, top, right, bottom }, divisions = 5) {
    for (let i = 0; i <= divisions; i += 1) {
      const x = left + (right - left) * i / divisions;
      const y = top + (bottom - top) * i / divisions;
      line(ctx, x, top, x, bottom, grid);
      line(ctx, left, y, right, y, grid);
    }
    ctx.strokeStyle = frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, right - left, bottom - top);
  }

  function drawPi(ctx, w, h, run) {
    const side = Math.min(w - 70, h - 52);
    const left = (w - side) / 2;
    const top = (h - side) / 2 - 3;
    const right = left + side;
    const bottom = top + side;
    ctx.fillStyle = "#60e6ce12";
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.arc(left, bottom, side, -Math.PI / 2, 0);
    ctx.closePath();
    ctx.fill();
    gridBox(ctx, { left, top, right, bottom });
    ctx.strokeStyle = mint;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(left, bottom, side, -Math.PI / 2, 0);
    ctx.stroke();

    const size = run.points.length > 900 ? 1.4 : run.points.length > 180 ? 2 : 2.8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, side, side);
    ctx.clip();
    for (const point of run.points) {
      dot(ctx, left + side * point.x, bottom - side * point.y, size, point.value ? mint : violet, !point.value);
    }
    if (run.n && run.n === run.points.length) {
      const point = run.points.at(-1);
      ctx.beginPath();
      ctx.arc(left + side * point.x, bottom - side * point.y, size + 3.8, 0, 2 * Math.PI);
      ctx.strokeStyle = pale;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    label(ctx, "0", left - 7, bottom + 14, "right");
    label(ctx, "1", right, bottom + 14);
    label(ctx, "1", left - 10, top, "right");
    label(ctx, "x", right + 17, bottom);
    label(ctx, "y", left, top - 11);
  }

  function drawCategories(ctx, w, h, run) {
    const hospital = run.config.mode === "hospital";
    const money = value => "$" + new Intl.NumberFormat("es-EC", { maximumFractionDigits: 2 }).format(value);
    const categories = hospital
      ? [
        ["Normal / con margen", "Carga hasta el 85 % de la capacidad", mint],
        ["Presión de atención", "Carga mayor al 85 % y hasta el 100 %", violet],
        ["Saturación", "Carga superior al 100 %", pale],
      ]
      : [
        ["Pierdes dinero", "Capital final menor que el inicial", violet],
        [run.config.gainThreshold === 0 ? "Sin ganancia ni pérdida" : `Ganas de $0 a ${money(run.config.gainThreshold)}`, "Incluye recuperar exactamente lo invertido", mint],
        [`Ganas más de ${money(run.config.gainThreshold)}`, "Ganancia por encima del umbral elegido", pale],
      ];
    const left = w < 390 ? 22 : 34;
    const right = w - left;
    const width = right - left;
    const top = 47;
    const row = (h - 91) / 3;
    const heading = w < 350
      ? hospital ? "Días por resultado" : "Escenarios por resultado"
      : hospital ? "Días agrupados según la carga de trabajo" : "Escenarios agrupados por ganancia anual";
    label(ctx, heading, left, 20, "left");
    categories.forEach(([title, description, color], index) => {
      const y = top + index * row;
      const count = run.counts[index];
      const proportion = run.n ? count / run.n : 0;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(title, left, y, width);
      const trackY = y + 14;
      const barHeight = Math.max(13, Math.min(23, row * .22));
      ctx.fillStyle = "#a890ff18";
      ctx.fillRect(left, trackY, width, barHeight);
      ctx.fillStyle = color;
      ctx.fillRect(left, trackY, width * proportion, barHeight);
      const percentage = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 }).format(proportion * 100);
      label(ctx, run.n ? `${number.format(count)} de ${number.format(run.n)} · ${percentage} %` : "Sin simulaciones todavía", left, trackY + barHeight + 15, "left", text);
      if (row > 80) label(ctx, description, left, trackY + barHeight + 33, "left", text);
    });
    const axisY = h - 24;
    for (let tick = 0; tick <= 4; tick += 1) {
      const x = left + width * tick / 4;
      line(ctx, x, axisY - 5, x, axisY, frame);
      label(ctx, `${tick * 25} %`, x, axisY + 11, tick === 0 ? "left" : tick === 4 ? "right" : "center");
    }
    line(ctx, left, axisY - 5, right, axisY - 5, frame);
  }

  const cubeCorners = Array.from({ length: 8 }, (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1]);
  const sphereLines = [];
  function spherePoint(phi, theta) {
    return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
  }

  for (let i = 0; i <= 6; i += 1) {
    const angle = i * Math.PI / 12;
    sphereLines.push(
      Array.from({ length: 25 }, (_, k) => spherePoint(angle, k * Math.PI / 48)),
      Array.from({ length: 25 }, (_, k) => spherePoint(k * Math.PI / 48, angle))
    );
  }

  function drawVolume(ctx, w, h, run, { yaw, pitch }) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const size = Math.min(w, h) * .57;
    const project = (x, y, z) => {
      x -= .5;
      y -= .5;
      z -= .5;
      const horizontal = cosYaw * x + sinYaw * z;
      const turnDepth = -sinYaw * x + cosYaw * z;
      const vertical = cosPitch * y - sinPitch * turnDepth;
      const depth = sinPitch * y + cosPitch * turnDepth;
      const factor = 3.8 / (3.8 - depth);
      return { x: w / 2 + horizontal * size * factor, y: h / 2 - vertical * size * factor, depth, factor };
    };

    const corners = cubeCorners.map(point => project(...point));
    for (let i = 0; i < corners.length; i += 1) {
      for (const offset of [1, 2, 4]) {
        if (i & offset) continue;
        const a = corners[i];
        const b = corners[i | offset];
        line(ctx, a.x, a.y, b.x, b.y, frame, 1.1);
      }
    }
    for (const [index, path] of sphereLines.entries()) {
      ctx.beginPath();
      path.forEach((point, i) => {
        const projected = project(...point);
        if (i === 0) ctx.moveTo(projected.x, projected.y);
        else ctx.lineTo(projected.x, projected.y);
      });
      const edge = index === 1 || index === sphereLines.length - 2 || index === sphereLines.length - 1;
      ctx.strokeStyle = edge ? "#60e6cec0" : "#60e6ce50";
      ctx.lineWidth = edge ? 1.5 : 1;
      ctx.stroke();
    }
    const projected = run.points.map(({ x, y, z, value }) => ({ ...project(x, y, z), inside: value }));
    projected.sort((a, b) => a.depth - b.depth);
    for (const point of projected) {
      const pointSize = (projected.length > 600 ? 1.65 : 2.55) * point.factor;
      ctx.globalAlpha = Math.max(.34, .65 + point.depth * .35);
      dot(ctx, point.x, point.y, pointSize, point.inside ? mint : violet, !point.inside);
    }
    ctx.globalAlpha = 1;
    for (const [index, axis] of [[1, "x"], [2, "y"], [4, "z"]]) {
      const p = corners[index];
      label(ctx, axis, p.x + 9, p.y - 8, "left", pale);
    }
  }

  function drawConvergence(ctx, w, h, run) {
    const left = w < 390 ? 57 : 77;
    const right = w - 17;
    const top = 22;
    const bottom = h - 43;
    const biased = run.config.mode === "pi" && run.config.sampling === "biased";
    const history = [...run.trace];
    if (run.n && history.at(-1)?.n !== run.n) {
      history.push({ n: run.n, value: run.scale * run.total / run.n });
    }
    const probability = ["hospital", "finance"].includes(run.config.mode);
    const hasReference = Number.isFinite(run.reference);
    const values = history.map(point => point.value);
    if (hasReference) values.push(run.reference);
    if (biased) values.push(MonteCarlo.BIASED_LIMIT);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const padding = Math.max((max - min) * .12, Math.abs(run.reference || 0) * .015, 1e-10);
    const low = probability ? 0 : min - padding;
    const high = probability ? 1 : max + padding;
    const logMax = Math.log10(Math.max(2, run.config.samples));
    const px = n => left + Math.log10(n) / logMax * (right - left);
    const py = value => bottom - (value - low) / (high - low) * (bottom - top);
    const asLabel = probability ? value => `${labelNumber(value * 100)} %` : labelNumber;

    for (let i = 0; i <= 4; i += 1) {
      const y = top + i * (bottom - top) / 4;
      line(ctx, left, y, right, y, grid);
      label(ctx, asLabel(high - i * (high - low) / 4), left - 6, y, "right");
    }
    for (let power = 0; power <= Math.floor(logMax); power += 1) {
      const n = 10 ** power;
      const x = px(n);
      line(ctx, x, top, x, bottom, grid);
      label(ctx, n >= 1000 ? `${n / 1000}k` : String(n), x, bottom + 13, n === 1 ? "left" : "center");
    }
    line(ctx, left, bottom, right, bottom, frame);
    const sampleLabel = run.config.mode === "hospital" ? "Días" : run.config.mode === "finance" ? "Escenarios" : "Muestras";
    label(ctx, `${sampleLabel} · escala logarítmica`, (left + right) / 2, h - 12);

    ctx.setLineDash([5, 4]);
    if (hasReference) line(ctx, left, py(run.reference), right, py(run.reference), violet, 1.7);
    if (biased) line(ctx, left, py(MonteCarlo.BIASED_LIMIT), right, py(MonteCarlo.BIASED_LIMIT), pale, 1.2);
    ctx.setLineDash([]);

    if (!history.length) {
      label(ctx, "Genera muestras para empezar", (left + right) / 2, bottom - 14);
      return;
    }
    ctx.beginPath();
    for (const [i, point] of history.entries()) {
      if (i === 0) ctx.moveTo(px(point.n), py(point.value));
      else ctx.lineTo(px(point.n), py(point.value));
    }
    ctx.strokeStyle = mint;
    ctx.lineWidth = 2;
    ctx.stroke();
    const last = history.at(-1);
    dot(ctx, px(last.n), py(last.value), 3.3, mint);
  }

  const charts = { pi: drawPi, hospital: drawCategories, finance: drawCategories, volume: drawVolume };

  function render(canvas, run, view, rotation) {
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 100 || height < 100) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const widthPx = Math.round(width * ratio);
    const heightPx = Math.round(height * ratio);
    if (canvas.width !== widthPx || canvas.height !== heightPx) {
      canvas.width = widthPx;
      canvas.height = heightPx;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(widthPx / width, 0, 0, heightPx / height, 0, 0);
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, width, height);
    const haze = ctx.createRadialGradient(width * .5, height * .43, 10, width * .5, height * .43, Math.max(width, height) * .59);
    haze.addColorStop(0, "#a890ff13");
    haze.addColorStop(1, "#a890ff00");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
    const draw = view === "convergence" ? drawConvergence : charts[run.config.mode];
    draw(ctx, width, height, run, rotation);
  }

  return { render };
})();
