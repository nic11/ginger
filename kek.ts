import { decodeB64, encodeB64 } from './base64';
import { encodeUrlWithConfig, GingerConfig, GingerConfigZod, loadConfigFromUrl, ParsedStep, ParseResult, Resource, STEP_OUTCOME_VALS, StepOutcome, StepType } from './config';
import { formatDateNow } from './datetime';
import { S, setLocale } from './strings';

class GingerEngine {
  private config: GingerConfig;
  private state: {
    currentStageIndex: number;
    currentStepIndex: number;
    stageStartTime: number;
    results: StepOutcome[];
    isRunning: boolean;
  };

  private container: HTMLElement;
  private imageElement: HTMLImageElement;
  private textElement: HTMLSpanElement;
  private baseFontSize: number;
  private stepStartTime: number;

  private inputListener: ((e: KeyboardEvent | MouseEvent) => void) | null = null;

  private hasInteractedInCurrentStep: boolean = false;

  constructor(config: GingerConfig, root: HTMLElement) {
    this.config = config;
    this.state = {
      currentStageIndex: -1, // -1 means Intro/Welcome
      currentStepIndex: 0,
      stageStartTime: 0,
      results: [],
      isRunning: false,
    };

    this.stepStartTime = 0;

    root.style.backgroundColor = config.backgroundColor ?? 'black';

    this.baseFontSize = Math.round(+(config.textSize ?? 32) * screen.height / 1080);

    this.container = root;
    this.textElement = document.createElement('span');
    this.textElement.style.color = config.textColor ?? 'white';
    this.textElement.style.fontSize = `${this.baseFontSize}px`;
    this.textElement.style.display = "block";
    this.textElement.style.marginBottom = `${this.baseFontSize}px`;
    this.textElement.style.textAlign = 'center';

    this.imageElement = document.createElement('img');
    this.imageElement.style.display = "none";
    this.imageElement.style.maxWidth = "100%";

    this.container.appendChild(this.textElement);
    this.container.appendChild(this.imageElement);

    this.handleInput = this.handleInput.bind(this);
    document.addEventListener('keydown', this.handleInput);
    document.addEventListener('mousedown', this.handleInput);

    this.parseConfig();
  }

  private parseConfig() {
    this.config.stages.forEach(stage => {
      stage.parsedSteps = stage.steps.map(s => {
        const char = s.charAt(0);
        const dur = parseInt(s.slice(1), 10);
        let type: StepType;
        if (char === 'G') {
          type = 'GO';
        } else if (char === 'N') {
          type = 'NOGO';
        } else if (char === 'B') {
          type = 'BLOCK';
        } else {
          throw new Error('invalid config');
        }
        return { type, durationMs: dur, originalString: s };
      });
    });
  }

  public async init() {
    this.textElement.innerText = "Loading assets...";

    try {
      await Promise.all([
        this.preloadImage(this.config.go),
        this.preloadImage(this.config.nogo)
      ]);
      this.startIntroFlow();
    } catch (e) {
      this.textElement.innerText = "Error loading images.";
    }
  }

  private preloadImage(res: Resource): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = res.src;
      img.onload = () => {
        res.element = img;
        resolve();
      };
      img.onerror = reject;
    });
  }

  private startIntroFlow() {
    this.renderScreen(this.config.welcomeText, null);

    this.waitForInput(() => {
      this.renderScreen(S().thisIsGo, this.config.go.src);

      this.waitForInput(() => {
        this.renderScreen(S().thisIsNogo, this.config.nogo.src);

        this.waitForInput(() => {
          this.startNextStage();
        });
      });
    });
  }

  private startNextStage() {
    this.state.currentStageIndex++;

    if (this.state.currentStageIndex >= this.config.stages.length) {
      this.finishExperiment();
      return;
    }

    const stage = this.config.stages[this.state.currentStageIndex];

    this.renderScreen(stage.welcomeText, null);

    this.waitForInput(() => {
      this.state.currentStepIndex = 0;
      this.state.stageStartTime = performance.now();
      this.state.isRunning = true;
      this.runStep(this.state.stageStartTime);
    });
  }

  private runStep(expectedStartTime: number) {
    if (!this.state.isRunning) {
      return;
    }

    const stage = this.config.stages[this.state.currentStageIndex];
    const steps = stage.parsedSteps!;

    const totalTimeMs = stage.totalTimeMs ?? 0;
    const elapsed = performance.now() - this.state.stageStartTime;
    if ((totalTimeMs > 0 && elapsed >= totalTimeMs) || this.state.currentStepIndex >= steps.length) {
      if (totalTimeMs > 0 && elapsed < totalTimeMs) {
        this.state.currentStepIndex = 0;
      } else {
        // stage complete
        this.state.isRunning = false;
        this.startNextStage();
        return;
      }
    }

    const step = steps[this.state.currentStepIndex];
    this.hasInteractedInCurrentStep = false;

    this.renderStepVisuals(step);

    this.stepStartTime = expectedStartTime;
    const nextExpectedTime = expectedStartTime + step.durationMs;
    const now = performance.now();
    const delay = nextExpectedTime - now;

    const actualDelay = Math.max(0, delay);

    window.setTimeout(() => {
      this.recordOutcome(step, 'TIMEOUT');

      this.state.currentStepIndex++;
      this.runStep(nextExpectedTime);
    }, actualDelay);
  }

  private renderStepVisuals(step: ParsedStep) {
    this.textElement.style.display = 'none';

    if (step.type === 'GO') {
      this.imageElement.src = this.config.go.src;
      this.imageElement.style.display = 'block';
    } else if (step.type === 'NOGO') {
      this.imageElement.src = this.config.nogo.src;
      this.imageElement.style.display = 'block';
    } else if (step.type === 'BLOCK') {
      this.imageElement.style.display = 'none';
    } else {
      throw new Error('invalid step type');
    }
  }

  private handleInput(e: KeyboardEvent | MouseEvent) {
    if (e instanceof KeyboardEvent && e.code !== 'Space') {
      return;
    }

    // Prevent scrolling on spacebar
    if (e instanceof KeyboardEvent) {
      e.preventDefault();
    }

    if (!this.state.isRunning && this.inputListener) {
      const callback = this.inputListener;
      this.inputListener = null;
      callback(e);
      return;
    }

    if (this.state.isRunning && !this.hasInteractedInCurrentStep) {
      const stage = this.config.stages[this.state.currentStageIndex];
      const step = stage.parsedSteps![this.state.currentStepIndex];

      this.hasInteractedInCurrentStep = true;

      this.recordOutcome(step, 'INPUT');
    }
  }

  private waitForInput(callback: (e: Event) => void) {
    this.inputListener = callback;
  }

  private renderScreen(text: string, imgSrc: string | null) {
    this.textElement.style.display = 'block';
    this.textElement.innerText = text;
    if (imgSrc) {
      this.imageElement.src = imgSrc;
      this.imageElement.style.display = 'block';
    } else {
      this.imageElement.style.display = 'none';
    }
  }

  private recordOutcome(step: ParsedStep, trigger: 'INPUT' | 'TIMEOUT', timestamp: number = performance.now()) {
    if (this.state.results.at(-1)?.stepIndex === this.state.currentStepIndex) {
      // also stage?
      return;
    }

    if (this.config.stages[this.state.currentStageIndex].name.toLocaleLowerCase() === 'trial') {
      return;
    }

    let outcome: StepOutcome['outcome'];
    let responseTimeMs: number | null = null;

    if (trigger === 'INPUT') {
      responseTimeMs = Math.round((timestamp - this.stepStartTime) * 10) / 10; // Placeholder, see note below on precision

      if (step.type === 'GO') {
        outcome = 'HIT';
      } else if (step.type === 'NOGO') {
        outcome = 'FALSE_ALARM';
      } else if (step.type === 'BLOCK') {
        return;
      } else {
        throw new Error('invalid step type');
      }
    } else if (trigger === 'TIMEOUT') {
      if (step.type === 'GO') {
        outcome = 'MISS';
      } else if (step.type === 'NOGO') {
        outcome = 'CORRECT_REJECTION';
      } else if (step.type === 'BLOCK') {
        outcome = 'CORRECT_REJECTION';
      } else {
        throw new Error('invalid step type');
      }
    } else {
      throw new Error('invalid trigger');
    }

    // Don't record the block setp
    if (step.type !== 'BLOCK') {
      console.log(`Step: ${step.type} | Result: ${outcome}`);
      this.state.results.push({
        stageIndex: this.state.currentStageIndex,
        stepIndex: this.state.currentStepIndex,
        type: step.type,
        outcome: outcome,
        responseTimeMs: responseTimeMs,
        timestamp: timestamp,
      });
    }
  }

  private finishExperiment() {
    this.textElement.style.display = 'block';
    this.imageElement.style.display = 'none';
    this.textElement.innerText = S().doneThanks;

    setTimeout(() => {
      this.textElement.innerText += '\n\n' + S().doneOverToExaminer;
      this.waitForInput(() => {
        this.displayResults();
      });
    }, 5000);
  }

  private displayResults() {
    this.textElement.innerText = S().doneHereAreResults;
    const dt = formatDateNow('YYYYDDMM-HHmm');
    addArtifact(this.textElement, S().rawResults, `ginger-raw-${dt}.json`, JSON.stringify({
      stageStartTimes: [ this.state.stageStartTime ],
      results: this.state.results,
    }, null, 2));
    addArtifact(this.textElement, S().resultsNumbers, `ginger-numbers-${dt}.csv`, this.reportNumbers());
    addArtifact(this.textElement, S().resultsTimes, `ginger-times-${dt}.csv`, this.reportTimes());
    // TODO: save all (zip)
  }

  private reportNumbers() {
    let report = '%,number,type\n';
    let counts = new Map<string, number>();
    for (const possibleOutcome of STEP_OUTCOME_VALS) {
      counts.set(possibleOutcome, 0);
    }
    for (const entry of this.state.results) {
      counts.set(entry.outcome, counts.get(entry.outcome)! + 1)
    }
    for (const [outcome, num] of counts.entries()) {
      report += `${Math.round(num / this.state.results.length * 100)},${num},${outcome}\n`;
    }
    report += `100,${this.state.results.length},TOTAL\n`;

    // TODO: looped by totalTime is unsupported
    let cntGo = 0, cntNogo = 0;
    for (const stage of this.config.stages) {
      if (stage.name.toLocaleLowerCase() === 'trial') {
        continue;
      }
      for (const step of stage.parsedSteps!) {
        if (step.type == 'GO') {
          ++cntGo;
        }
        if (step.type == 'NOGO') {
          ++cntNogo;
        }
      }
    }

    report += `${Math.round(100 * cntGo / this.state.results.length)},${cntGo},TOTAL_GO\n`;
    report += `${Math.round(100 * cntNogo / this.state.results.length)},${cntNogo},TOTAL_NOGO\n`;

    return report;
  }

  private reportTimes() {
    let report = 'time_ms,stage_idx,step_idx\n';
    for (const entry of this.state.results) {
      report += `${entry.responseTimeMs ?? 'NONE'},${entry.stageIndex},${entry.stepIndex}\n`;
    }
    return report;
  }
}

function addArtifact(el: HTMLElement, title: string, name: string, content: string) {
  const container = document.createElement('div');
  container.style.border = '1px solid #333';
  container.style.marginBottom = '10px';
  container.style.borderRadius = '4px';
  container.style.overflow = 'hidden';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '8px 12px';
  header.style.backgroundColor = '#0a0a0a';
  header.style.borderBottom = '1px solid #222';

  const titleEl = document.createElement('span');
  titleEl.style.fontWeight = 'bold';
  titleEl.textContent = title;

  const actionsEl = document.createElement('div');
  actionsEl.style.display = 'flex';
  actionsEl.style.gap = '8px';

  const pre = document.createElement('pre');
  pre.textContent = content;
  pre.style.display = 'none'; // Initially hidden
  pre.style.padding = '10px';
  pre.style.margin = '0';
  pre.style.overflowX = 'auto';
  pre.style.overflowY = 'scroll';
  pre.style.height = '200px';
  pre.style.fontSize = `0.5em`;
  pre.style.textAlign = 'left';

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = S().btnShow;
  toggleBtn.onclick = () => {
    if (pre.style.display === 'none') {
      pre.style.display = 'block';
      toggleBtn.textContent = S().btnHide;
    } else {
      pre.style.display = 'none';
      toggleBtn.textContent = S().btnShow;
    }
  };

  const copyBtn = document.createElement('button');
  copyBtn.textContent = S().btnCopy;
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(content);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy to clipboard');
    }
  };

  const saveBtn = document.createElement('button');
  saveBtn.textContent = S().btnSave;
  saveBtn.onclick = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  actionsEl.appendChild(toggleBtn);
  actionsEl.appendChild(copyBtn);
  actionsEl.appendChild(saveBtn);

  header.appendChild(titleEl);
  header.appendChild(actionsEl);

  container.appendChild(header);
  container.appendChild(pre);

  el.appendChild(container);
}

function renderEditConfigScreen(app: HTMLElement, result: ParseResult) {
  let { config, decodedHash, error: loadError } = result;
  const applyStyles = (el: HTMLElement, styles: Object) => Object.assign(el.style, styles);

  const container = document.createElement('div');
  applyStyles(container, {
    fontFamily: 'sans-serif',
    maxWidth: '800px',
    margin: '20px auto',
    padding: '0 10px',
  });

  const label = document.createElement('label');
  label.innerText = S().enterConfig;
  applyStyles(label, { fontSize: '24px', display: 'block', marginBottom: '10px' });

  const configInput = document.createElement('textarea');
  configInput.rows = 15;
  if (config) {
    configInput.value = JSON.stringify(config, null, 2);
  } else {
    configInput.value = decodedHash ?? '';
  }
  configInput.placeholder = "Paste config here...";
  applyStyles(configInput, { width: '100%', fontFamily: 'monospace', boxSizing: 'border-box' });

  const validationError = document.createElement('pre');
  applyStyles(validationError, {
    color: '#d32f2f',
    marginTop: '8px',
    fontSize: '14px',
    minHeight: '1.5em',
  });

  const outputBox = document.createElement('div');
  applyStyles(outputBox, {
    marginTop: '20px',
    padding: '15px',
    background: '#0a0a0a',
    borderRadius: '4px',
  });

  const copyLabel = document.createElement('label');
  copyLabel.innerText = S().enterConfigCopy;
  applyStyles(copyLabel, { display: 'block', marginBottom: '8px', fontWeight: 'bold' });

  const row = document.createElement('div');
  applyStyles(row, { display: 'flex', gap: '10px' });

  const urlOutput = document.createElement('input');
  urlOutput.readOnly = true;
  applyStyles(urlOutput, { flexGrow: '1', padding: '8px' });

  const copyBtn = document.createElement('button');
  copyBtn.innerText = S().btnCopy;
  applyStyles(copyBtn, { cursor: 'pointer', padding: '8px 16px' });

  const updateOutput = () => {
    const setOutputError = (err: any) => {
      validationError.textContent = `Invalid Config: ${err}`;
      urlOutput.value = "";
      copyBtn.disabled = true;
    };
    const setOutput = (value: string) => {
      validationError.textContent = "";
      urlOutput.value = encodeUrlWithConfig(value);
      copyBtn.disabled = false;
    };

    if (loadError) {
      setOutputError(loadError);
      loadError = undefined;
      return;
    }

    const value = configInput.value.trim();
    if (!value) {
      setOutputError('should not be empty');
      return;
    }

    try {
      GingerConfigZod.parse(JSON.parse(value));
      setOutput(value);
    } catch (err) {
      setOutputError(err);
    }
  };

  copyBtn.onclick = async () => {
    if (!urlOutput.value) return;
    try {
      await navigator.clipboard.writeText(urlOutput.value);
      copyBtn.innerText = 'Copied!';
      setTimeout(() => copyBtn.innerText = S().btnCopy, 1000);
    } catch (err) {
      alert('Copy failed!');
    }
  };

  configInput.oninput = updateOutput;

  row.append(urlOutput, copyBtn);
  outputBox.append(copyLabel, row);
  container.append(label, configInput, validationError, outputBox);
  app.appendChild(container);

  updateOutput();
}

window.onload = async () => {
  const app = document.getElementById('app');
  if (!app) {
    alert('Critical error: no app element');
    return;
  }

  let result = loadConfigFromUrl();
  const config = result.config;
  if (!config) {
    setLocale('en');
    renderEditConfigScreen(app, result);
    return;
  }

  setLocale(config.lang);

  const engine = new GingerEngine(config, app);
  engine.init();

  console.log(config);

  const keke = encodeB64(JSON.stringify(config));
  console.log(keke);
  console.log(decodeB64(keke));
};
