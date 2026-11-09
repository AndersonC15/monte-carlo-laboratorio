"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../assets/simulation.js"), "utf8");
const engine = vm.runInNewContext(`${source}\nMonteCarlo;`);
const plain = value => JSON.parse(JSON.stringify(value));

function run(mode, config = {}, count) {
  const result = engine.createRun({ mode, samples: 10000, seed: 42, sampling: "uniform", ...config });
  engine.advance(result, count ?? result.config.samples);
  return result;
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

test("all four models reproduce their sequence across seeds, batches, and restarts", () => {
  for (const mode of ["pi", "hospital", "finance", "volume"]) {
    const one = run(mode);
    const batched = run(mode, {}, 0);
    for (const size of [1, 3, 17, 400, 5000, 4579]) engine.advance(batched, size);
    for (const key of ["n", "total", "mean", "m2", "trace", "recent", "totals"]) {
      assert.deepEqual(plain(batched[key]), plain(one[key]), `${mode}: ${key}`);
    }
    assert.deepEqual(Array.from(batched.counts || []), Array.from(one.counts || []));
    assert.deepEqual(plain(run(mode).recent), plain(one.recent));
    assert.notDeepEqual(plain(run(mode, { seed: 43 }).recent), plain(one.recent));
  }
});

test("application outcomes partition all scenarios and match the tracked event", () => {
  for (const mode of ["hospital", "finance"]) {
    const result = run(mode);
    const stats = engine.applicationStatistics(result);
    assert.equal(stats.counts.reduce((a, b) => a + b, 0), result.n);
    close(stats.proportions.reduce((a, b) => a + b, 0), 1);
    assert.equal(result.total, stats.counts[mode === "hospital" ? 2 : 0]);
    assert.equal(result.reference, null);
    assert.equal(engine.statistics(result).error, null);
    assert.equal(result.recent.length, 6);
    for (const sample of result.recent) {
      assert.ok([0, 1, 2].includes(sample.category));
      assert.ok(Number.isFinite(sample.evaluated));
    }
  }
});

test("hospital staffing comparison keeps demand identical and saturation nonincreasing", () => {
  const results = [2, 3, 4, 5, 6].map(doctors => run("hospital", { doctors }));
  for (let i = 1; i < results.length; i++) {
    const previous = results[i - 1];
    const current = results[i];
    assert.equal(current.totals.workload, previous.totals.workload);
    assert.equal(current.totals.patients, previous.totals.patients);
    assert.equal(current.totals.emergencies, previous.totals.emergencies);
    assert.ok(current.counts[2] <= previous.counts[2]);
    assert.ok(current.counts[0] >= previous.counts[0]);
    assert.equal(current.parameters.capacity, current.config.doctors * current.config.hours * 60);
  }
  assert.ok(results.at(-1).counts[2] < results[0].counts[2]);
});

test("hospital simulated means agree with the independently derived demand model", () => {
  const result = run("hospital");
  const stats = engine.applicationStatistics(result);
  close(stats.averagePatients, 60, .5);
  close(stats.averageEmergencies, 6, .2);
  // Mean service = 25 min; 10% of patients use 3x that time.
  close(stats.averageWorkload, 60 * 25 * (.9 + .1 * 3), 25);
  close(stats.averageUtilization, stats.averageWorkload / (4 * 8 * 60));
  const withoutEmergencies = run("hospital", { emergency: 0 });
  const allEmergencies = run("hospital", { emergency: 100 });
  assert.equal(withoutEmergencies.totals.emergencies, 0);
  assert.equal(allEmergencies.totals.emergencies, allEmergencies.totals.patients);
  close(allEmergencies.totals.workload, 3 * withoutEmergencies.totals.workload, .0001);
});

test("hospital category boundaries include 85% in normal and 100% in waiting", () => {
  for (const [minutes, expected] of [[51, 0], [60, 1], [60.01, 2]]) {
    const result = run("hospital", { samples: 1, patients: 1, doctors: 1, hours: 1, emergency: 0, minutes }, 0);
    result.random = () => .5;
    engine.advance(result, 1);
    assert.equal(result.recent[0].category, expected);
  }
});

test("finance with zero volatility has deterministic outcomes and exact expected value", () => {
  for (const [annualReturn, gainThreshold, category] of [[-50, 150, 0], [0, 150, 1], [100, 1000, 1], [100, 999, 2]]) {
    const result = run("finance", { volatility: 0, annualReturn, gainThreshold });
    assert.equal(result.counts[category], result.n);
    close(engine.applicationStatistics(result).averageFinal, 1000 * (1 + annualReturn / 100), .000001);
    close(engine.statistics(result).standardError, 0);
    assert.equal(result.parameters.sigma, 0);
  }
});

test("finance return distribution has the configured arithmetic mean and deviation", () => {
  const result = run("finance", { samples: 100000 }, 0);
  let n = 0;
  let mean = 0;
  let m2 = 0;
  let minimumFinal = Infinity;
  while (result.n < result.config.samples) {
    engine.advance(result, 1);
    const sample = result.recent.at(-1);
    const delta = sample.return - mean;
    n++;
    mean += delta / n;
    m2 += delta * (sample.return - mean);
    minimumFinal = Math.min(minimumFinal, sample.final);
  }
  const deviation = Math.sqrt(m2 / (n - 1));
  close(mean, .06, .004);
  close(deviation, .20, .004);
  close(engine.applicationStatistics(result).averageReturn, mean, .00000001);
  close(engine.applicationStatistics(result).modelExpectedFinal, 1060);
  assert.ok(minimumFinal > 0, "lognormal terminal wealth stays positive");
});

test("changing only the gain threshold reclassifies profits without changing scenarios or losses", () => {
  const lower = run("finance", { gainThreshold: 0 });
  const higher = run("finance", { gainThreshold: 1000 });
  assert.equal(lower.totals.final, higher.totals.final);
  assert.equal(lower.counts[0], higher.counts[0]);
  assert.ok(higher.counts[1] >= lower.counts[1]);
  assert.ok(higher.counts[2] <= lower.counts[2]);
});

test("sample caps, empty runs and single samples stay well defined", () => {
  for (const mode of ["pi", "hospital", "finance", "volume"]) {
    const empty = run(mode, { samples: 1 }, 0);
    assert.deepEqual(plain(engine.statistics(empty)), { estimate: null, error: null, standardError: null });
    engine.advance(empty, 2000);
    assert.equal(empty.n, 1);
    assert.equal(engine.statistics(empty).standardError, null);
    const snapshot = plain(empty.recent);
    engine.advance(empty, 2000);
    assert.equal(empty.n, 1);
    assert.deepEqual(plain(empty.recent), snapshot);
  }
});

test("indicator standard errors match their independent Bernoulli calculation", () => {
  for (const mode of ["pi", "hospital", "finance", "volume"]) {
    const result = run(mode);
    const p = result.total / result.n;
    const expected = result.scale * Math.sqrt(p * (1 - p) / (result.n - 1));
    close(engine.statistics(result).standardError, expected, 1e-12);
  }
});

test("pi and volume regressions preserve references, known seed and point boundaries", () => {
  const pi = run("pi", { samples: 100 });
  assert.equal(pi.total, 82);
  assert.equal(engine.statistics(pi).estimate, 3.28);
  assert.equal(pi.reference, Math.PI);
  const volume = run("volume", { samples: 100000 });
  assert.equal(volume.reference, 4 * Math.PI / 3);
  assert.ok(Math.abs(engine.statistics(volume).estimate - volume.reference) < .05);
  for (const mode of ["pi", "volume"]) {
    const result = run(mode, { samples: 1 }, 0);
    const sequence = [1, 0, 0];
    result.random = () => sequence.shift();
    engine.advance(result, 1);
    assert.equal(result.total, 1, `${mode}: points on the boundary count inside`);
  }
});

test("precision comparison retains the inverse square-root theoretical relationship", () => {
  const values = engine.repeatedPi(60);
  assert.deepEqual(Array.from(values, item => item.n), [100, 400, 1600, 6400]);
  for (let i = 1; i < values.length; i++) {
    close(values[i].theoretical, values[i - 1].theoretical / 2);
    assert.ok(values[i].observed < values[i - 1].observed);
  }
});
