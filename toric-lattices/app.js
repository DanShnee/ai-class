const inputs = ["b11", "b12", "b21", "b22"].map(id => document.getElementById(id));
const characterCanvas = document.getElementById("characterCanvas");
const dualCanvas = document.getElementById("dualCanvas");
const toggles = {
  vectors: document.getElementById("showVectors"),
  points: document.getElementById("showPoints"),
  guides: document.getElementById("showGuides"),
  fan: document.getElementById("showFan")
};
const fanRaysInput = document.getElementById("fanRays");
const fanConesInput = document.getElementById("fanCones");
const weightInput = document.getElementById("weightInput");

let zoom = 1;
let lastValid = [[1, 0], [0, 1]];
let lastDual = [[1, 0], [0, 1]];
const selected = { character: [1, 0], dual: [1, 0] };
let fanLabel = "Projective plane ℙ²";
let weightedWeights = null;

const fanExamples = {
  p2: { name: "Projective plane ℙ²", rays: [[1,0],[0,1],[-1,-1]], cones: [[1,2],[2,3],[3,1]] },
  p1xp1: { name: "Quadric surface ℙ¹ × ℙ¹", rays: [[1,0],[0,1],[-1,0],[0,-1]], cones: [[1,2],[2,3],[3,4],[4,1]] },
  a2: { name: "Affine plane 𝔸²", rays: [[1,0],[0,1]], cones: [[1,2]] },
  f2: { name: "Hirzebruch surface F₂", rays: [[1,0],[0,1],[-1,2],[0,-1]], cones: [[1,2],[2,3],[3,4],[4,1]] }
};
const coneColors = [
  { solid: "#7655a3", fill: "rgba(118,85,163,.24)" },
  { solid: "#df704f", fill: "rgba(223,112,79,.24)" },
  { solid: "#208e87", fill: "rgba(32,142,135,.24)" },
  { solid: "#c0922f", fill: "rgba(192,146,47,.24)" },
  { solid: "#4776ad", fill: "rgba(71,118,173,.24)" },
  { solid: "#b85578", fill: "rgba(184,85,120,.24)" },
  { solid: "#688e43", fill: "rgba(104,142,67,.24)" },
  { solid: "#9b6545", fill: "rgba(155,101,69,.24)" }
];
function coneColor(index) {
  if (index < coneColors.length) return coneColors[index];
  const hue = Math.round((index * 137.508 + 265) % 360);
  return { solid: `hsl(${hue} 48% 43%)`, fill: `hsl(${hue} 55% 52% / .24)` };
}

const clean = n => Math.abs(n) < 1e-10 ? 0 : n;
const format = n => {
  n = clean(n);
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(3)).toString();
};

function matrixFromInputs() {
  const [a, c, b, d] = inputs.map(input => Number(input.value));
  return [[a, c], [b, d]];
}

function determinant(B) { return B[0][0] * B[1][1] - B[0][1] * B[1][0]; }

function inverseTranspose(B) {
  const det = determinant(B);
  return [[B[1][1] / det, -B[1][0] / det], [-B[0][1] / det, B[0][0] / det]];
}

function inverse(B) {
  const det = determinant(B);
  return [[B[1][1] / det, -B[0][1] / det], [-B[1][0] / det, B[0][0] / det]];
}

function basisExtent(B) {
  return Math.max(
    Math.hypot(B[0][0], B[1][0]),
    Math.hypot(B[0][1], B[1][1]),
    .15
  );
}

function readFan() {
  const rayLines = fanRaysInput.value.split(/[;\n]+/).map(line => line.trim()).filter(Boolean);
  const rays = [];
  const errors = [];
  rayLines.forEach((line, i) => {
    const parts = line.replace(/[()]/g, "").split(/[ ,]+/).filter(Boolean).map(Number);
    if (parts.length !== 2 || !parts.every(Number.isFinite) || (parts[0] === 0 && parts[1] === 0)) {
      errors.push(`Ray ${i + 1} must be a nonzero pair.`);
    } else if (!parts.every(Number.isInteger)) {
      errors.push(`Ray ${i + 1} must have integer coordinates.`);
    } else if (gcd(Math.abs(parts[0]), Math.abs(parts[1])) !== 1) {
      errors.push(`Ray ${i + 1} is not primitive.`);
      rays.push(parts);
    } else {
      rays.push(parts);
    }
  });

  const directions = new Set();
  rays.forEach((ray, i) => {
    const key = `${ray[0]},${ray[1]}`;
    if (directions.has(key)) errors.push(`Ray ${i + 1} is repeated.`);
    directions.add(key);
  });

  const cones = [];
  fanConesInput.value.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean).forEach(part => {
    const match = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (!match) {
      errors.push(`Cone “${part}” should look like 1-2.`);
      return;
    }
    const cone = [Number(match[1]), Number(match[2])];
    if (cone[0] === cone[1] || cone.some(i => i < 1 || i > rays.length)) {
      errors.push(`Cone ${part} references invalid rays.`);
    } else if (rays[cone[0] - 1][0] * rays[cone[1] - 1][1] - rays[cone[0] - 1][1] * rays[cone[1] - 1][0] === 0) {
      errors.push(`Cone ${part} is not strongly convex.`);
    } else {
      cones.push(cone);
    }
  });
  return { rays, cones, errors };
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function extendedGcd(a, b) {
  let oldR = a, r = b, oldS = 1, s = 0, oldT = 0, t = 1;
  while (r !== 0) {
    const quotient = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }
  return [oldR, oldS, oldT];
}

function primitive(vector) {
  const divisor = gcd(Math.abs(vector[0]), Math.abs(vector[1])) || 1;
  return vector.map(value => value / divisor);
}

function weightedProjectiveData(weights) {
  const [a, b, c] = weights;
  const [g, x, y] = extendedGcd(a, b);
  const [d] = extendedGcd(g, c);
  if (d !== 1) throw new Error("Weights must first be normalized.");

  // Integral coordinates for the images of e₀,e₁,e₂ in ℤ³/ℤ(a,b,c).
  const quotientRays = [
    [-b / g, -c * x],
    [a / g, -c * y],
    [0, g]
  ];
  // Map the first two images to (1,0),(0,1). The third then becomes
  // (−a/c,−b/c), giving the requested concrete overlattice in ℝ².
  const firstTwo = [
    [quotientRays[0][0], quotientRays[1][0]],
    [quotientRays[0][1], quotientRays[1][1]]
  ];
  const cocharacterBasis = inverse(firstTwo);
  return {
    rays: quotientRays.map(primitive),
    cocharacterBasis,
    characterBasis: inverseTranspose(cocharacterBasis)
  };
}

function fraction(numerator, denominator) {
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator)) || 1;
  const n = numerator / divisor, d = denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

function weightedLatticeDescription(weights) {
  const [a, b, c] = weights;
  return `N = ℤ² + ℤ(${fraction(-a,c)},${fraction(-b,c)}), M = N∨`;
}

function parseWeights() {
  const weights = weightInput.value.trim().split(/[ ,;]+/).filter(Boolean).map(Number);
  if (weights.length !== 3 || !weights.every(Number.isInteger) || weights.some(weight => weight <= 0)) {
    return { error: "Enter exactly three positive integer weights." };
  }
  const common = weights.reduce((result, weight) => gcd(result, weight));
  return { weights: weights.map(weight => weight / common), original: weights, normalized: common > 1 };
}

function fanProperties(fan) {
  const coneKeys = new Set(fan.cones.map(([a,b]) => [a,b].sort((x,y) => x-y).join("-")));
  const ordered = fan.rays.map((ray, i) => ({ i: i + 1, angle: Math.atan2(ray[1], ray[0]) })).sort((a,b) => a.angle - b.angle);
  const expected = new Set(ordered.map((ray, i) => [ray.i, ordered[(i + 1) % ordered.length].i].sort((a,b) => a-b).join("-")));
  const gaps = ordered.map((ray, i) => {
    const next = ordered[(i + 1) % ordered.length];
    return (next.angle - ray.angle + Math.PI * 2) % (Math.PI * 2);
  });
  const coversPlane = gaps.every(gap => gap < Math.PI - 1e-9);
  const complete = fan.rays.length >= 3 && coversPlane && expected.size === coneKeys.size && [...expected].every(key => coneKeys.has(key));
  const smooth = fan.cones.length > 0 && fan.cones.every(([a,b]) => {
    const u = fan.rays[a - 1], v = fan.rays[b - 1];
    return Math.abs(u[0] * v[1] - u[1] * v[0]) === 1;
  });
  return { complete, smooth };
}

function coneSingularity(fan, a, b) {
  const u = fan.rays[a - 1], v = fan.rays[b - 1];
  const signedDeterminant = u[0] * v[1] - u[1] * v[0];
  const r = Math.abs(signedDeterminant);
  if (r === 1) return { smooth: true, r: 1, a: 0 };

  const [, rawX, rawY] = extendedGcd(Math.abs(u[0]), Math.abs(u[1]));
  const x = rawX * Math.sign(u[0] || 1);
  const y = rawY * Math.sign(u[1] || 1);
  const horizontalCoordinate = x * v[0] + y * v[1];
  const quotientWeight = ((-horizontalCoordinate % r) + r) % r;
  return { smooth: false, r, a: quotientWeight };
}

function singularityText(singularity) {
  return `1/${singularity.r}(1,${singularity.a})`;
}

function subscript(number) {
  const digits = "₀₁₂₃₄₅₆₇₈₉";
  return String(number).split("").map(digit => digits[Number(digit)]).join("");
}

function drawConeLabel(ctx, point, text, color) {
  ctx.font = "500 10px 'DM Mono'";
  const width = ctx.measureText(text).width + 12;
  const height = 20;
  ctx.fillStyle = color;
  ctx.fillRect(point.x - width / 2, point.y - height / 2, width, height);
  ctx.fillStyle = "#fffef9";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, point.x, point.y + .5);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawFan(ctx, center, map, basis, fan, phase) {
  const toAmbient = ray => [
    ray[0] * basis[0][0] + ray[1] * basis[0][1],
    ray[0] * basis[1][0] + ray[1] * basis[1][1]
  ];
  const ambientRays = fan.rays.map(toAmbient);
  const extent = basisExtent(basis);
  ctx.save();
  if (phase === "cones") {
    fan.cones.forEach(([a,b], i) => {
      const u = ambientRays[a - 1], v = ambientRays[b - 1];
      if (!u || !v) return;
      const pu = map([u[0] * 40, u[1] * 40]);
      const pv = map([v[0] * 40, v[1] * 40]);
      ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(pu.x, pu.y); ctx.lineTo(pv.x, pv.y); ctx.closePath();
      ctx.fillStyle = coneColor(i).fill;
      ctx.fill();
      const singularity = coneSingularity(fan, a, b);
      if (!singularity.smooth) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(184,73,58,.34)";
        ctx.lineWidth = 1;
        for (let offset = -1000; offset < 1800; offset += 15) {
          ctx.beginPath();
          ctx.moveTo(offset, -700);
          ctx.lineTo(offset + 1400, 700);
          ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(pu.x, pu.y); ctx.lineTo(pv.x, pv.y); ctx.closePath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#b8493a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  } else {
    ambientRays.forEach((ray, i) => {
      const norm = Math.hypot(ray[0], ray[1]) || 1;
      const end = map([ray[0] * 2.55 * extent / norm, ray[1] * 2.55 * extent / norm]);
      drawArrow(ctx, center, end, "#79549b", `ρ${i + 1}`);
    });
    fan.cones.forEach(([a,b], i) => {
      const u = ambientRays[a - 1], v = ambientRays[b - 1];
      if (!u || !v) return;
      const un = Math.hypot(u[0], u[1]), vn = Math.hypot(v[0], v[1]);
      const bisector = [u[0] / un + v[0] / vn, u[1] / un + v[1] / vn];
      const length = Math.hypot(bisector[0], bisector[1]) || 1;
      const labelPoint = map([bisector[0] * 1.4 * extent / length, bisector[1] * 1.4 * extent / length]);
      const singularity = coneSingularity(fan, a, b);
      const label = singularity.smooth
        ? `σ${subscript(i + 1)}`
        : `⚠ σ${subscript(i + 1)} · ${singularityText(singularity)}`;
      drawConeLabel(ctx, labelPoint, label, singularity.smooth ? coneColor(i).solid : "#b8493a");
    });
  }
  ctx.restore();
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawArrow(ctx, from, to, color, label) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 9 * Math.cos(angle - Math.PI / 6), to.y - 9 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - 9 * Math.cos(angle + Math.PI / 6), to.y - 9 * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
  ctx.font = "500 10px 'DM Mono'";
  ctx.fillText(label, to.x + 7 * Math.cos(angle + .6), to.y + 7 * Math.sin(angle + .6));
}

function drawLattice(canvas, B, type) {
  const { ctx, width, height } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const center = { x: width / 2, y: height / 2 };
  const extent = basisExtent(B);
  const baseScale = Math.min(width, height) / 6.1 / extent * zoom;
  const map = p => ({ x: center.x + p[0] * baseScale, y: center.y - p[1] * baseScale });
  const v1 = [B[0][0], B[1][0]], v2 = [B[0][1], B[1][1]];
  const fan = readFan();

  if (type === "dual" && toggles.fan.checked && fan.errors.length === 0) {
    drawFan(ctx, center, map, B, fan, "cones");
  }

  ctx.strokeStyle = "#e3e0d8";
  ctx.lineWidth = 1;
  const gridLimit = Math.min(120, Math.ceil(Math.max(width, height) / (2 * baseScale)) + 2);
  for (let i = -gridLimit; i <= gridLimit; i++) {
    let p1 = map([-gridLimit, i]), p2 = map([gridLimit, i]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    p1 = map([i, -gridLimit]); p2 = map([i, gridLimit]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }

  ctx.strokeStyle = "#aeb6b6";
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(0, center.y); ctx.lineTo(width, center.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(center.x, 0); ctx.lineTo(center.x, height); ctx.stroke();

  if (toggles.guides.checked) {
    ctx.strokeStyle = type === "character" ? "rgba(22,139,130,.22)" : "rgba(238,115,92,.22)";
    ctx.lineWidth = 1;
    for (let k = -7; k <= 7; k++) {
      const a1 = map([k * v1[0] - 8 * v2[0], k * v1[1] - 8 * v2[1]]);
      const a2 = map([k * v1[0] + 8 * v2[0], k * v1[1] + 8 * v2[1]]);
      const b1 = map([k * v2[0] - 8 * v1[0], k * v2[1] - 8 * v1[1]]);
      const b2 = map([k * v2[0] + 8 * v1[0], k * v2[1] + 8 * v1[1]]);
      ctx.beginPath(); ctx.moveTo(a1.x,a1.y); ctx.lineTo(a2.x,a2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b1.x,b1.y); ctx.lineTo(b2.x,b2.y); ctx.stroke();
    }
  }

  if (toggles.points.checked) {
    ctx.fillStyle = type === "character" ? "#152437" : "#ee735c";
    for (let i = -24; i <= 24; i++) for (let j = -24; j <= 24; j++) {
      const p = map([i * v1[0] + j * v2[0], i * v1[1] + j * v2[1]]);
      if (p.x > 5 && p.x < width - 5 && p.y > 5 && p.y < height - 5) {
        ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 && j === 0 ? 3.6 : 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  const chosen = selected[type];
  const chosenPoint = map([
    chosen[0] * v1[0] + chosen[1] * v2[0],
    chosen[0] * v1[1] + chosen[1] * v2[1]
  ]);
  if (chosenPoint.x > 0 && chosenPoint.x < width && chosenPoint.y > 0 && chosenPoint.y < height) {
    ctx.beginPath();
    ctx.arc(chosenPoint.x, chosenPoint.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fffef9"; ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = type === "character" ? "#168b82" : "#ee735c"; ctx.stroke();
    ctx.beginPath(); ctx.arc(chosenPoint.x, chosenPoint.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  }

  if (toggles.vectors.checked) {
    const color = type === "character" ? "#168b82" : "#ee735c";
    drawArrow(ctx, center, map(v1), color, type === "character" ? "m₁" : "n₁");
    drawArrow(ctx, center, map(v2), color, type === "character" ? "m₂" : "n₂");
  }

  if (type === "dual" && toggles.fan.checked && fan.errors.length === 0) {
    drawFan(ctx, center, map, B, fan, "labels");
  }

  ctx.fillStyle = "#79838b";
  ctx.font = "9px 'DM Mono'";
  ctx.fillText("0", center.x + 7, center.y + 13);
}

function render() {
  const B = matrixFromInputs();
  const det = determinant(B);
  const valid = B.flat().every(Number.isFinite) && Math.abs(det) > 1e-9;
  const error = document.getElementById("matrixError");
  document.getElementById("determinant").textContent = `= ${Number.isFinite(det) ? format(det) : "—"}`;
  const status = document.getElementById("detStatus");

  if (!valid) {
    error.textContent = "The basis must be invertible (det B ≠ 0).";
    status.textContent = "singular";
    status.style.color = "#bc4433";
    return;
  }

  error.textContent = "";
  status.textContent = Math.abs(Math.abs(det) - 1) < 1e-9 ? "unimodular" : `index ${format(Math.abs(det))}`;
  status.style.color = "";
  lastValid = B;
  const dual = inverseTranspose(B);
  lastDual = dual;
  document.getElementById("dualMatrix").textContent = `[ ${format(dual[0][0])}   ${format(dual[0][1])} ]\n[ ${format(dual[1][0])}   ${format(dual[1][1])} ]`;
  document.getElementById("dualDescription").textContent = weightedWeights
    ? weightedLatticeDescription(weightedWeights)
    : "N = B⁻ᵀℤ²";
  drawLattice(characterCanvas, B, "character");
  drawLattice(dualCanvas, dual, "dual");
  const fan = readFan();
  document.getElementById("fanError").textContent = fan.errors[0] || "";
  document.getElementById("rayCount").textContent = fan.rays.length;
  document.getElementById("coneCount").textContent = fan.cones.length;
  document.getElementById("fanName").textContent = fanLabel;
  const coneKey = document.getElementById("coneKey");
  coneKey.replaceChildren(...fan.cones.map(([a,b], i) => {
    const singularity = coneSingularity(fan, a, b);
    const item = document.createElement("span");
    item.style.setProperty("--cone-color", coneColor(i).solid);
    item.classList.toggle("singular", !singularity.smooth);
    item.title = singularity.smooth
      ? `Cone σ${i + 1} is smooth (determinant 1).`
      : `Cone σ${i + 1} has cyclic quotient singularity ${singularityText(singularity)}.`;
    const swatch = document.createElement("i");
    const label = document.createElement("b");
    const status = document.createElement("em");
    label.textContent = `σ${subscript(i + 1)}`;
    status.textContent = singularity.smooth ? "smooth" : `singular ${singularityText(singularity)}`;
    item.append(swatch, label, document.createTextNode(`= ⟨ρ${a}, ρ${b}⟩`), status);
    return item;
  }));
  const props = fanProperties(fan);
  const completeBadge = document.getElementById("completeBadge");
  completeBadge.textContent = props.complete ? "complete" : "not complete";
  completeBadge.classList.toggle("warning", !props.complete);
  const smoothBadge = document.getElementById("smoothBadge");
  const singularCones = fan.cones.filter(([a,b]) => !coneSingularity(fan, a, b).smooth);
  smoothBadge.textContent = singularCones.length
    ? `${singularCones.length} singular cone${singularCones.length === 1 ? "" : "s"}`
    : "smooth";
  smoothBadge.classList.toggle("warning", !props.smooth);
  const value = selected.character[0] * selected.dual[0] + selected.character[1] * selected.dual[1];
  document.getElementById("pairingResult").textContent = `⟨m(${selected.character.join(",")}), n(${selected.dual.join(",")})⟩ = ${value}`;
}

function selectNearest(event, canvas, B, type) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height) / 6.1 / basisExtent(B) * zoom;
  const ambient = [(event.clientX - rect.left - rect.width / 2) / scale, -(event.clientY - rect.top - rect.height / 2) / scale];
  const inv = inverse(B);
  selected[type] = [
    Math.round(inv[0][0] * ambient[0] + inv[0][1] * ambient[1]),
    Math.round(inv[1][0] * ambient[0] + inv[1][1] * ambient[1])
  ];
  render();
}

characterCanvas.addEventListener("click", event => selectNearest(event, characterCanvas, lastValid, "character"));
dualCanvas.addEventListener("click", event => selectNearest(event, dualCanvas, lastDual, "dual"));

inputs.forEach(input => input.addEventListener("input", () => {
  weightedWeights = null;
  document.getElementById("weightedLatticeInfo").textContent = "";
  document.querySelectorAll("[data-matrix]").forEach(button => button.classList.remove("selected"));
  render();
}));
Object.values(toggles).forEach(toggle => toggle.addEventListener("change", render));
document.querySelectorAll("[data-matrix]").forEach(button => button.addEventListener("click", () => {
  const values = button.dataset.matrix.split(",");
  inputs.forEach((input, i) => input.value = values[i]);
  weightedWeights = null;
  document.getElementById("weightedLatticeInfo").textContent = "";
  document.querySelectorAll("[data-matrix]").forEach(b => b.classList.toggle("selected", b === button));
  render();
}));

[fanRaysInput, fanConesInput].forEach(input => input.addEventListener("input", () => {
  fanLabel = "Custom fan";
  weightedWeights = null;
  document.getElementById("weightedLatticeInfo").textContent = "";
  document.querySelectorAll("[data-fan]").forEach(button => button.classList.remove("selected"));
  render();
}));
document.querySelectorAll("[data-fan]").forEach(button => button.addEventListener("click", () => {
  const example = fanExamples[button.dataset.fan];
  fanRaysInput.value = example.rays.map(ray => ray.join(", ")).join("\n");
  fanConesInput.value = example.cones.map(cone => cone.join("-")).join(", ");
  fanLabel = example.name;
  weightedWeights = null;
  document.getElementById("weightedLatticeInfo").textContent = "";
  document.querySelectorAll("[data-fan]").forEach(b => b.classList.toggle("selected", b === button));
  render();
}));

document.getElementById("generateWeighted").addEventListener("click", () => {
  const parsed = parseWeights();
  const error = document.getElementById("weightError");
  if (parsed.error) {
    error.classList.remove("notice");
    error.textContent = parsed.error;
    return;
  }

  const data = weightedProjectiveData(parsed.weights);
  const characterEntries = [
    data.characterBasis[0][0], data.characterBasis[0][1],
    data.characterBasis[1][0], data.characterBasis[1][1]
  ];
  inputs.forEach((input, i) => input.value = format(characterEntries[i]));
  fanRaysInput.value = data.rays.map(ray => ray.join(", ")).join("\n");
  fanConesInput.value = "1-2, 2-3, 3-1";
  weightInput.value = parsed.weights.join(", ");
  fanLabel = `Weighted projective plane ℙ(${parsed.weights.join(",")})`;
  weightedWeights = parsed.weights;
  zoom = 1;
  const [a, b, c] = parsed.weights;
  document.getElementById("weightedLatticeInfo").textContent =
    `N = ⟨(1,0), (0,1), (${fraction(-a,c)},${fraction(-b,c)})⟩ℤ`;
  error.textContent = parsed.normalized ? `Common factor removed: using ℙ(${parsed.weights.join(",")}).` : "";
  error.classList.toggle("notice", parsed.normalized);
  document.querySelectorAll("[data-fan]").forEach(button => button.classList.remove("selected"));
  document.querySelectorAll("[data-matrix]").forEach(button => button.classList.remove("selected"));
  updateZoom();
});
weightInput.addEventListener("keydown", event => {
  if (event.key === "Enter") document.getElementById("generateWeighted").click();
});

document.getElementById("zoomIn").addEventListener("click", () => { zoom = Math.min(4, zoom * 1.25); updateZoom(); });
document.getElementById("zoomOut").addEventListener("click", () => { zoom = Math.max(.25, zoom / 1.25); updateZoom(); });
document.getElementById("zoomReset").addEventListener("click", () => { zoom = 1; updateZoom(); });
function updateZoom() {
  document.getElementById("zoomReset").textContent = `Fit · ${Math.round(zoom * 100)}%`;
  render();
}

[characterCanvas, dualCanvas].forEach(canvas => {
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    zoom = event.deltaY < 0 ? Math.min(4, zoom * 1.12) : Math.max(.25, zoom / 1.12);
    updateZoom();
  }, { passive: false });
  canvas.addEventListener("dblclick", () => {
    zoom = 1;
    updateZoom();
  });
});

const dialog = document.getElementById("aboutDialog");
document.getElementById("aboutButton").addEventListener("click", () => dialog.showModal());
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

window.addEventListener("resize", render);
document.fonts.ready.then(render);
