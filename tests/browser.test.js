"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { launchBrowser } = require("./browser-harness");

async function main() {
  const browser = await launchBrowser();
  const passed = [];
  const screenshots = "/tmp/monte-carlo-qa";
  const text = id => browser.evaluate(`document.getElementById(${JSON.stringify(id)}).textContent.trim()`);
  const visible = id => browser.evaluate(`!document.getElementById(${JSON.stringify(id)}).hidden`);
  async function snapshot(name, anchor = "laboratorio") {
    await browser.evaluate(`(() => { const anchor=document.getElementById(${JSON.stringify(anchor)}); const target=anchor.id==='conclusion'?anchor.closest('article'):anchor.id==='outcome-rows'?anchor.closest('table'):anchor; target.scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy({top:-90,behavior:'instant'}); })()`);
    await browser.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await browser.screenshot(`${screenshots}/${name}.png`);
  }
  function pass(message) { passed.push(message); console.log(`PASS ${message}`); }
  try {
    await browser.viewport(1440, 1100);
    await browser.goto(path.resolve(__dirname, "../index.html"));
    await browser.waitFor("document.getElementById('estimate').textContent !== '—'");
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('[data-model]')].map(x=>x.dataset.model).sort()"), ["finance", "hospital", "pi", "volume"]);
    assert.equal(await browser.evaluate("document.querySelectorAll('#dice-options,#integral-options,#tab-dice,#tab-integral').length"), 0);
    const duplicates = await browser.evaluate("[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,ids)=>ids.indexOf(id)!==i)");
    assert.deepEqual(duplicates, []);
    pass("four intended tabs, removed controls, unique document IDs");

    await browser.input("samples", 100);
    await browser.input("seed", 42);
    await browser.click("finish");
    assert.match(await text("estimate"), /3[,.]28/);
    assert.match(await text("reference"), /3[,.]14159/);
    const originalPi = await text("estimate");
    await browser.click("reset");
    assert.equal(await text("estimate"), "—");
    await browser.click("step");
    assert.match(await text("progress"), /^1\s*\//);
    await browser.click("finish");
    assert.equal(await text("estimate"), originalPi);
    await browser.click("show-convergence");
    assert.equal(await browser.evaluate("document.getElementById('show-convergence').getAttribute('aria-pressed')"), "true");
    await snapshot("pi-desktop");
    await browser.click("show-samples");
    pass("pi known seed, empty restart, step, batch restart equality and convergence");

    await browser.click("tab-hospital");
    await browser.input("samples", 10000);
    await browser.input("seed", 42);
    assert.equal(await browser.evaluate("document.getElementById('hospital-doctors').disabled"), false);
    await browser.click("finish");
    assert.equal(await browser.evaluate("document.querySelectorAll('#outcome-rows tr:not(.total-row)').length"), 3);
    assert.ok((await text("conclusion")).length > 30);
    assert.ok((await text("conclusion-why")).length > 30);
    await browser.click("compare-staff");
    assert.ok((await text("comparison-result")).length > 40);
    const hospitalSummary = await text("outcome-rows");
    await browser.click("reset");
    await browser.click("finish");
    assert.equal(await text("outcome-rows"), hospitalSummary);
    await snapshot("hospital-desktop");
    await snapshot("hospital-results", "outcome-rows");
    await snapshot("hospital-conclusion", "conclusion");
    await browser.input("hospital-doctors", 1);
    await browser.click("finish");
    const hospitalLowStaff = await text("estimate");
    await browser.input("hospital-doctors", 20);
    await browser.click("finish");
    assert.notEqual(await text("estimate"), hospitalLowStaff);
    await browser.input("hospital-doctors", 0);
    await browser.click("finish");
    assert.equal(await visible("form-message"), true);
    assert.equal(await browser.evaluate("document.getElementById('hospital-doctors').getAttribute('aria-invalid')"), "true");
    await browser.input("hospital-doctors", 4);
    await browser.click("finish");
    pass("hospital categories, readable conclusions, staffing comparison, reproducibility and doctor validation");

    for (const [id, value] of [["hospital-patients", 1], ["hospital-doctors", 1], ["hospital-minutes", 1], ["hospital-hours", 24], ["hospital-emergency", 100]]) await browser.input(id, value);
    await browser.click("finish");
    assert.match(await text("estimate"), /^0(?:[,.]0+)?\s*%$/);
    assert.match(await text("reference"), /1[.,]440\s*min/);
    for (const [id, value] of [["hospital-patients", 60], ["hospital-doctors", 1], ["hospital-minutes", 120], ["hospital-hours", 1], ["hospital-emergency", 100]]) await browser.input(id, value);
    await browser.click("finish");
    assert.match(await text("estimate"), /^100(?:[,.]0+)?\s*%$/);
    await browser.input("hospital-doctors", 50);
    assert.equal(await browser.evaluate("document.getElementById('compare-staff').disabled"), true);
    for (const [id, value] of [["hospital-patients", 60], ["hospital-doctors", 4], ["hospital-minutes", 25], ["hospital-hours", 8], ["hospital-emergency", 10]]) await browser.input(id, value);
    await browser.click("finish");
    pass("all five hospital controls affect the model and maximum staff disables comparison");

    await browser.click("tab-finance");
    await browser.input("samples", 10000);
    await browser.input("seed", 42);
    await browser.click("finish");
    assert.equal(await browser.evaluate("document.querySelectorAll('#outcome-rows tr:not(.total-row)').length"), 3);
    assert.ok((await text("conclusion")).length > 30);
    assert.ok((await text("conclusion-why")).length > 30);
    const financeSummary = await text("outcome-rows");
    await browser.click("reset");
    await browser.click("finish");
    assert.equal(await text("outcome-rows"), financeSummary);
    await snapshot("finance-desktop");
    await snapshot("finance-results", "outcome-rows");
    await snapshot("finance-conclusion", "conclusion");
    await browser.input("finance-volatility", 0);
    await browser.input("finance-return", 0);
    await browser.click("finish");
    assert.match(await text("estimate"), /^0(?:[,.]0+)?\s*%$/);
    assert.match(await text("outcome-rows"), /100/);
    await browser.click("show-convergence");
    assert.equal(await browser.evaluate("document.getElementById('show-convergence').getAttribute('aria-pressed')"), "true");
    await browser.click("show-samples");
    await browser.input("finance-return", -96);
    await browser.click("finish");
    assert.equal(await visible("form-message"), true);
    await browser.input("finance-return", 6);
    await browser.input("finance-volatility", 20);
    await browser.click("finish");
    pass("finance categories, conclusions, reproducibility, zero-volatility scenario and return validation");

    for (const [id, value] of [["finance-initial", 2000], ["finance-return", 10], ["finance-volatility", 0], ["finance-threshold", 150]]) await browser.input(id, value);
    await browser.click("finish");
    assert.match(await text("reference"), /2[.,]200/);
    assert.match(await text("error"), /200/);
    assert.match(await browser.evaluate("document.querySelectorAll('#outcome-rows tr')[2].textContent"), /100/);
    await browser.input("finance-threshold", 250);
    await browser.click("finish");
    assert.match(await browser.evaluate("document.querySelectorAll('#outcome-rows tr')[1].textContent"), /100/);
    for (const [id, value] of [["finance-initial", 1000], ["finance-return", 6], ["finance-volatility", 20], ["finance-threshold", 150]]) await browser.input(id, value);
    await browser.click("finish");
    pass("all four finance controls affect final wealth and profit classification");

    await browser.click("tab-volume");
    await browser.input("samples", 10000);
    await browser.click("finish");
    assert.match(await text("reference"), /4[,.]18879/);
    assert.equal(await visible("rotate-controls"), true);
    await browser.click("rotate-left");
    await browser.click("rotate-right");
    await snapshot("volume-desktop");
    await browser.click("show-convergence");
    assert.equal(await visible("rotate-controls"), false);
    await browser.click("show-samples");
    await browser.input("samples", 100001);
    await browser.click("finish");
    assert.equal(await visible("form-message"), true);
    await browser.input("samples", 100);
    await browser.input("seed", 4294967296);
    await browser.click("finish");
    assert.equal(await visible("form-message"), true);
    await browser.input("seed", 42);
    await browser.click("finish");
    pass("volume reference, rotation, convergence, sample and seed limits");

    await browser.click("tab-pi");
    await browser.input("samples", 1000);
    await browser.input("seed", 42);
    await browser.click("finish");
    const animationReference = await text("estimate");
    await browser.click("reset");
    await browser.input("speed", "fast");
    await browser.click("play");
    await browser.waitFor("parseFloat(document.getElementById('progress-fill').style.width)>0 && !document.getElementById('finish').disabled");
    await browser.click("play");
    const pausedProgress = await text("progress");
    await browser.evaluate("new Promise(resolve=>setTimeout(resolve,150))");
    assert.equal(await text("progress"), pausedProgress);
    await browser.click("play");
    await browser.waitFor("document.getElementById('finish').disabled");
    assert.equal(await text("estimate"), animationReference);
    await browser.evaluate("document.getElementById('tab-pi').focus()");
    await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    assert.equal(await browser.evaluate("document.activeElement.id"), "tab-volume");
    assert.equal(await browser.evaluate("document.getElementById('tab-volume').getAttribute('aria-selected')"), "true");
    await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "End", code: "End", windowsVirtualKeyCode: 35 });
    assert.equal(await browser.evaluate("document.activeElement.id"), "tab-finance");
    await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Home", code: "Home", windowsVirtualKeyCode: 36 });
    assert.equal(await browser.evaluate("document.activeElement.id"), "tab-pi");
    pass("real animation pause/resume reproduces batch results and keyboard tab navigation works");

    for (const mode of ["hospital", "finance"]) {
      await browser.click(`tab-${mode}`);
      await browser.click("finish");
      await browser.evaluate("document.getElementById('sample-details').open=true");
      await browser.waitFor("document.querySelectorAll('#sample-rows tr').length===6");
      const recent = await browser.evaluate("[...document.querySelectorAll('#sample-rows tr')].map(tr=>[...tr.cells].map(cell=>cell.textContent))");
      assert.equal(recent.length, 6);
      assert.ok(recent.every(cells => cells.length === 4));
      assert.doesNotMatch(JSON.stringify(recent), /NaN|undefined|Infinity/);
      if (mode === "hospital") assert.ok(recent.every(cells => /pacientes \/ .*emergencias/.test(cells[1]) && /%/.test(cells[2])));
      else assert.ok(recent.every(cells => cells[1].includes("$") && cells[2].includes("$")));
      await browser.click("show-convergence");
      assert.doesNotMatch(await text("legend"), /Referencia/);
      assert.match(await text("plot-unit"), /sin referencia futura conocida/);
      await browser.click("show-samples");
      await browser.evaluate("document.getElementById('sample-details').open=false");
    }
    await browser.input("finance-volatility", 0);
    await browser.input("finance-return", 0);
    await browser.input("finance-threshold", 0);
    await browser.click("finish");
    assert.match(await text("outcome-rows"), /Sin ganancia ni pérdida/);
    assert.match(await text("conclusion"), /Sin ganancia ni pérdida/);
    assert.match(await browser.evaluate("document.querySelectorAll('#outcome-rows tr')[1].textContent"), /100/);
    for (const [id, value] of [["finance-initial", 1000], ["finance-return", 6], ["finance-volatility", 20], ["finance-threshold", 150]]) await browser.input(id, value);
    await browser.click("finish");
    pass("recent hospital/finance rows are finite, threshold zero is explicit, scenario convergence invents no reference");

    const extremeResults = await browser.evaluate(`(() => {
      const cases=[
        {mode:'hospital',patients:300,doctors:1,minutes:120,hours:1,emergency:100},
        {mode:'hospital',patients:1,doctors:50,minutes:1,hours:24,emergency:0},
        {mode:'finance',initial:10000000,annualReturn:100,volatility:150,gainThreshold:0},
        {mode:'finance',initial:.01,annualReturn:-95,volatility:150,gainThreshold:10000000}
      ];
      return cases.map(config=>{const run=MonteCarlo.createRun({...config,samples:200,seed:42});MonteCarlo.advance(run,200);return {mode:config.mode,n:run.n,counts:[...run.counts],finite:Object.values(run.totals).every(Number.isFinite),positive:config.mode!=='finance'||run.recent.every(sample=>sample.final>0),error:MonteCarlo.statistics(run).error};});
    })()`);
    assert.ok(extremeResults.every(result => result.n === 200 && result.counts.reduce((a, b) => a + b, 0) === 200 && result.finite && result.positive && result.error === null));
    pass("extreme valid scenario parameters stay finite, positive and conserve counts");

    await browser.evaluate("document.querySelectorAll('#quiz fieldset').forEach(q=>{q.querySelector(`input[value='${q.dataset.correct}']`).checked=true});document.getElementById('quiz').requestSubmit()");
    assert.match(await text("quiz-score"), /^5 de 5/);
    assert.equal(await browser.evaluate("document.querySelectorAll('.participation-question').length"), 15);
    await browser.click("compare-runs");
    assert.equal(await browser.evaluate("document.querySelectorAll('#repeat-rows tr').length"), 4);
    pass("quiz, 15 participation questions and repeated-run precision table");
    await snapshot("method-desktop", "metodo");
    await snapshot("history-desktop", "historia");

    for (const width of [375, 768, 1440]) {
      await browser.viewport(width, 1100);
      for (const mode of ["pi", "hospital", "finance", "volume"]) {
        await browser.click(`tab-${mode}`);
        await browser.click("finish");
        assert.ok(await browser.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), `${mode} overflows at ${width}px`);
        assert.ok(await browser.evaluate("document.getElementById('plot').width > 0 && document.getElementById('plot').height > 0"));
        if (width !== 1440) {
          await snapshot(`${mode}-${width}`);
          if (mode === "hospital" || mode === "finance") {
            await snapshot(`${mode}-${width}-chart`, "plot-title");
            await snapshot(`${mode}-${width}-outcomes`, "outcome-rows");
            await snapshot(`${mode}-${width}-conclusion`, "conclusion");
          }
        }
      }
    }
    pass("all four models fit 375, 768 and 1440px viewports; charts have dimensions");
    assert.deepEqual(browser.errors, [], "no browser console/runtime errors");
    pass("no runtime or browser console errors");
    console.log(JSON.stringify({ passed: passed.length, screenshots, browserErrors: browser.errors }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
