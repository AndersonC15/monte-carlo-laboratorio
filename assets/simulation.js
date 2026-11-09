"use strict";

const MonteCarlo = (() => {
  const SEED_SPACE = 2 ** 32;
  const BIASED_LIMIT = 2 + Math.PI / 2;
  const DISPLAY_LIMITS = { pi: 2400, hospital: 0, finance: 0, volume: 1400 };

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

  // A normal draw from two independent uniforms. 1-random() is always > 0.
  function standardNormal(random) {
    return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
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
    hospital: {
      scale: () => 1,
      reference: () => null,
      prepare(config) {
        // Symmetric inclusive integer interval, so patients is its exact mean.
        const spread = Math.floor(config.patients * .3);
        return {
          low: config.patients - spread,
          width: 2 * spread + 1,
          capacity: config.doctors * config.hours * 60,
        };
      },
      sample(random, config, parameters) {
        const patients = parameters.low + Math.floor(random() * parameters.width);
        let workload = 0;
        let emergencies = 0;
        for (let patient = 0; patient < patients; patient += 1) {
          const emergency = random() < config.emergency / 100;
          emergencies += Number(emergency);
          // Ordinary care U(0.5t, 1.5t); an emergency requires three times that draw.
          workload += config.minutes * (.5 + random()) * (emergency ? 3 : 1);
        }
        const capacity = parameters.capacity;
        const utilization = workload / capacity;
        // Teaching thresholds for workload, not a queueing or clinical prediction.
        const category = utilization <= .85 ? 0 : utilization <= 1 ? 1 : 2;
        return {
          x: patients, y: workload, z: capacity,
          patients, workload, capacity, utilization, emergencies,
          evaluated: utilization, value: Number(category === 2), category,
        };
      },
    },
    finance: {
      scale: () => 1,
      reference: () => null,
      prepare(config) {
        const meanFactor = 1 + config.annualReturn / 100;
        const deviation = config.volatility / 100;
        // Calibrate the lognormal to the arithmetic annual-return mean and SD.
        const sigmaSquared = Math.log1p((deviation / meanFactor) ** 2);
        return { mu: Math.log(meanFactor) - sigmaSquared / 2, sigma: Math.sqrt(sigmaSquared) };
      },
      sample(random, config, parameters) {
        const factor = Math.exp(parameters.mu + parameters.sigma * standardNormal(random));
        const final = config.initial * factor;
        const profit = final - config.initial;
        const annualReturn = profit / config.initial;
        const category = profit < 0 ? 0 : profit <= config.gainThreshold ? 1 : 2;
        return {
          x: final, y: profit, final, profit, return: annualReturn,
          evaluated: profit, value: Number(category === 0), category,
        };
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
    if (!model) throw new Error("Experimento desconocido.");
    const defaults = config.mode === "hospital"
      ? { patients: 60, doctors: 4, minutes: 25, hours: 8, emergency: 10 }
      : config.mode === "finance"
        ? { initial: 1000, annualReturn: 6, volatility: 20, gainThreshold: 150 }
        : {};
    const settings = { ...defaults, ...config };
    return {
      config: settings,
      parameters: model.prepare ? model.prepare(settings) : null,
      random: seededRandom(settings.seed),
      reference: model.reference(settings),
      scale: model.scale(settings),
      n: 0,
      total: 0,
      mean: 0,
      m2: 0,
      nextTrace: 1,
      trace: [],
      points: [],
      recent: [],
      counts: ["hospital", "finance"].includes(settings.mode) ? new Uint32Array(3) : null,
      totals: { patients: 0, workload: 0, emergencies: 0, final: 0, profit: 0, returns: 0 },
    };
  }

  function advance(run, count) {
    const { config } = run;
    const model = models[config.mode];
    const finishAt = Math.min(run.n + count, config.samples);
    const saveRecentAfter = finishAt - 6;
    for (let i = run.n + 1; i <= finishAt; i += 1) {
      const sample = model.sample(run.random, config, run.parameters);
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
      if (i <= DISPLAY_LIMITS[config.mode]) run.points.push(sample);
      if (run.counts) run.counts[sample.category] += 1;
      if (config.mode === "hospital") {
        run.totals.patients += sample.patients;
        run.totals.workload += sample.workload;
        run.totals.emergencies += sample.emergencies;
      } else if (config.mode === "finance") {
        run.totals.final += sample.final;
        run.totals.profit += sample.profit;
        run.totals.returns += sample.return;
      }
      if (i > saveRecentAfter) run.recent.push({ ...sample, index: i });
    }
    if (run.recent.length > 6) run.recent.splice(0, run.recent.length - 6);
  }

  function statistics(run) {
    const { n, total, scale, reference, m2 } = run;
    const estimate = n ? scale * (total / n) : null;
    return {
      estimate,
      error: n && reference !== null ? Math.abs(estimate - reference) : null,
      standardError: n > 1 ? scale * Math.sqrt(Math.max(0, m2) / (n - 1) / n) : null,
    };
  }

  function applicationStatistics(run) {
    const { config, n, totals } = run;
    const common = {
      counts: run.counts ? Array.from(run.counts) : [],
      proportions: run.counts ? Array.from(run.counts, count => n ? count / n : 0) : [],
    };
    if (config.mode === "hospital") {
      const capacity = run.parameters.capacity;
      return {
        ...common, capacity,
        averagePatients: n ? totals.patients / n : null,
        averageWorkload: n ? totals.workload / n : null,
        averageUtilization: n ? totals.workload / n / capacity : null,
        averageEmergencies: n ? totals.emergencies / n : null,
      };
    }
    if (config.mode === "finance") {
      return {
        ...common,
        averageFinal: n ? totals.final / n : null,
        averageProfit: n ? totals.profit / n : null,
        averageReturn: n ? totals.returns / n : null,
        lossFraction: n ? run.counts[0] / n : null,
        modelExpectedFinal: config.initial * (1 + config.annualReturn / 100),
      };
    }
    return common;
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

  return { BIASED_LIMIT, createRun, advance, statistics, applicationStatistics, repeatedPi };
})();
