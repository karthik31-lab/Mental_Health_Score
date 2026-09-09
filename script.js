const API_URL = "http://localhost:2000/predict";

const form = document.getElementById("predict-form");
const formErrorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const loadingState = document.getElementById("loading-state");
const resultState = document.getElementById("result-state");
const resetBtn = document.getElementById("reset-btn");

const gaugeFill = document.getElementById("gauge-fill");
const gaugeScoreEl = document.getElementById("gauge-score");
const gaugeBandEl = document.getElementById("gauge-band");
const gaugeNoteEl = document.getElementById("gauge-note");

const GAUGE_ARC_LENGTH = 251.2; // matches stroke-dasharray in CSS
const SCORE_MIN = 0;
const SCORE_MAX = 10;

const NUMERIC_FIELDS = [
  "age",
  "avg_daily_usage_hours",
  "daily_unlocks",
  "study_hours",
  "physical_activity_hours",
  "sleep_hours_per_night",
];

function showState(state) {
  form.hidden = state !== "form";
  loadingState.hidden = state !== "loading";
  resultState.hidden = state !== "result";
}

function clearError() {
  formErrorEl.hidden = true;
  formErrorEl.textContent = "";
}

function showError(message) {
  formErrorEl.textContent = message;
  formErrorEl.hidden = false;
}

function buildPayload(formData) {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = NUMERIC_FIELDS.includes(key) ? Number(value) : value;
  }
  return payload;
}

function describeScore(score) {
  if (score >= 7) {
    return {
      band: "Looking fairly steady",
      note: "Your habits line up with the patterns the model associates with better balance. Keep an eye on whatever's working for you.",
      color: "var(--accent)",
    };
  }
  if (score >= 4) {
    return {
      band: "Worth keeping an eye on",
      note: "A few of your answers — sleep, screen time, or stress — are pulling the estimate down. Small adjustments there tend to help most.",
      color: "var(--secondary)",
    };
  }
  return {
    band: "Signs of real strain",
    note: "This estimate sits on the lower end. Consider talking to someone you trust, or a counselor — you don't have to sort this out alone.",
    color: "var(--danger)",
  };
}

function renderResult(score) {
  const clamped = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
  const fraction = (clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
  const { band, note, color } = describeScore(clamped);

  gaugeScoreEl.textContent = clamped.toFixed(1);
  gaugeBandEl.textContent = band;
  gaugeNoteEl.textContent = note;
  gaugeFill.style.stroke = color;

  // Reset then animate on next frame so the transition actually plays.
  gaugeFill.style.transition = "none";
  gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
  requestAnimationFrame(() => {
    gaugeFill.style.transition = "";
    const offset = GAUGE_ARC_LENGTH * (1 - fraction);
    gaugeFill.style.strokeDashoffset = String(offset);
  });

  showState("result");
}

async function handleSubmit(event) {
  event.preventDefault();
  clearError();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = buildPayload(new FormData(form));
  showState("loading");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `The server responded with an error (status ${response.status}).`;
      try {
        const errorBody = await response.json();
        if (errorBody && errorBody.detail) {
          detail = Array.isArray(errorBody.detail)
            ? errorBody.detail.map((d) => d.msg || JSON.stringify(d)).join(" ")
            : String(errorBody.detail);
        }
      } catch (_) {
        // response body wasn't JSON — keep the generic message
      }
      throw new Error(detail);
    }

    const data = await response.json();
    renderResult(Number(data.predicted_mental_health_score));
  } catch (err) {
    showState("form");
    const isNetworkError = err instanceof TypeError;
    showError(
      isNetworkError
        ? "Couldn't reach the prediction server. Check that the API is running on port 2000 and try again."
        : err.message || "Something went wrong while getting your estimate. Please try again."
    );
  }
}

function handleReset() {
  showState("form");
  clearError();
  form.reset();
}

form.addEventListener("submit", handleSubmit);
resetBtn.addEventListener("click", handleReset);
