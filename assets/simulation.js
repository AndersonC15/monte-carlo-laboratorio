"use strict";

const MonteCarlo = (() => {
  const SEED_SPACE = 2 ** 32;
  const BIASED_LIMIT = 2 + Math.PI / 2;
  const DISPLAY_LIMITS = { pi: 2400, dice: 0, integral: 450, volume: 1400 };
  const functions = {
    square: { label: "x²", f: x => x * x, integral: (a, b) => (b - a) * (a * a + a * b + b * b) / 3 },
    sine: { label: "sen(x)", f: Math.sin, integral: (a, b) => 2 * Math.sin((a + b) / 2) * Math.sin((b - a) / 2) },
    exponential: { label: "e⁻ˣ", f: x => Math.exp(-x), integral: (a, b) => -Math.exp(-a) * Math.expm1(a - b) },
  };

  // Mulberry32 keeps the sequence reproducible without depending on Math.random().
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / SEED_SPACE;
    };
  }

  function fairDie(random) {
    // Only accept the largest multiple of 6 in the 32-bit output range.
    const range = SEED_SPACE - SEED_SPACE % 6;
    let value;
    do {
      value = Math.floor(random() * SEED_SPACE);
    } while (value >= range);
    return value % 6 + 1;
  }

  function diceWays(sum) {
    return 6 - Math.abs(7 - sum);
  }

  const models = {
    pi: {
      scale: () => 4,
      reference: () => Math.PI,
      sample(random, config) {
        const side = config.sampling === "biased" && random() < .5 ? .5 : 1;
        const x = side * random();
        const y = side * random();
        const evaluated = x * x + y * y;
        return { x, y, evaluated, value: Number(evaluated <= 1) };
      },
    },
    dice: {
      scale: () => 1,
      reference: config => diceWays(config.target) / 36,
      sample(random, config) {
        const x = fairDie(random);
        const y = fairDie(random);
        const evaluated = x + y;
        return { x, y, evaluated, value: Number(evaluated === config.target) };
      },
    },
    integral: {
      scale: config => config.b - config.a,
      reference: config => functions[config.fn].integral(config.a, config.b),
      sample(random, config) {
        const x = config.a + (config.b - config.a) * random();
        const value = functions[config.fn].f(x);
        return { x, evaluated: value, value };
      },
    },
    volume: {
      scale: () => 8,
      reference: () => 4 * Math.PI / 3,
      sample(random) {
        const x = random();
        const y = random();
        const z = random();
        const evaluated = x * x + y * y + z * z;
        return { x, y, z, evaluated, value: Number(evaluated <= 1) };
      },
    },
  };

  function createRun(config) {
    const model = models[config.mode];
    return {
      config: { ...config },
      random: seededRandom(config.seed),
      reference: model.reference(config),
      scale: model.scale(config),
      n: 0,
      total: 0,
      mean: 0,
      m2: 0,
      nextTrace: 1,
      trace: [],
      points: [],
      recent: [],
      counts: config.mode === "dice" ? new Uint32Array(11) : null,
    };
  }

  function advance(run, count) {
    const { config } = run;
    const model = models[config.mode];
    const finishAt = Math.min(run.n + count, config.samples);
    const saveRecentAfter = finishAt - 6;
    for (let i = run.n + 1; i <= finishAt; i += 1) {
      const sample = model.sample(run.random, config);
      run.n = i;
      run.total += sample.value;

      // Welford's online sample variance of the unscaled contributions.
      const delta = sample.value - run.mean;
      run.mean += delta / i;
      run.m2 += delta * (sample.value - run.mean);

      if (i >= run.nextTrace) {
        run.trace.push({ n: i, value: run.scale * (run.total / i) });
        run.nextTrace = i < 32 ? i + 1 : Math.ceil(i * 1.045);
      }
      if (i <= DISPLAY_LIMITS[config.mode]) {
        run.points.push(sample);
      }
      if (run.counts) {
        run.counts[sample.evaluated - 2] += 1;
      }
      if (i > saveRecentAfter) {
        run.recent.push({ ...sample, index: i });
      }
    }
    if (run.recent.length > 6) {
      run.recent.splice(0, run.recent.length - 6);
    }
  }

  function statistics(run) {
    const { n, total, scale, reference, m2 } = run;
    const estimate = n ? scale * (total / n) : null;
    return {
      estimate,
      error: n ? Math.abs(estimate - reference) : null,
      standardError: n > 1 ? scale * Math.sqrt(Math.max(0, m2) / (n - 1) / n) : null,
    };
  }

  function repeatedPi(repeats) {
    const sizes = [100, 400, 1600, 6400];
    const squaredErrors = sizes.map(() => 0);
    const p = Math.PI / 4;
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const random = seededRandom((42 + Math.imul(repeat, 0x9e3779b9)) >>> 0);
      let inside = 0;
      let previous = 0;
      for (const [index, size] of sizes.entries()) {
        for (let n = previous; n < size; n += 1) {
          const x = random();
          const y = random();
          inside += Number(x * x + y * y <= 1);
        }
        const error = 4 * inside / size - Math.PI;
        squaredErrors[index] += error * error;
        previous = size;
      }
    }
    return sizes.map((n, i) => ({
      n,
      observed: Math.sqrt(squaredErrors[i] / repeats),
      theoretical: 4 * Math.sqrt(p * (1 - p) / n),
    }));
  }

  return { BIASED_LIMIT, functions, diceWays, createRun, advance, statistics, repeatedPi };
})();
