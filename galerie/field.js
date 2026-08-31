const canvas = document.querySelector('#field');
const ctx = canvas.getContext('2d', { alpha: false });
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = 0, height = 0, ratio = 1, colonies = [];

const hash = (n) => {
  const x = Math.sin(n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  ratio = Math.min(devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  colonies = Array.from({ length: Math.max(42, Math.floor(width / 22)) }, (_, i) => ({
    x: width * (.05 + .9 * hash(i + 2)),
    y: height * (.10 + .78 * hash(i + 27)),
    seed: i + 1,
    span: 10 + hash(i + 61) * Math.min(52, width * .08),
    tilt: (hash(i + 91) - .5) * .7
  }));
  render(performance.now());
}

function line(x1, y1, x2, y2, alpha, weight = 1) {
  ctx.strokeStyle = `rgba(220, 214, 193, ${alpha})`;
  ctx.lineWidth = weight;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function colony(c, phase) {
  const pulse = (Math.sin(phase * Math.PI * 2 + c.seed) + 1) / 2;
  const witness = Math.max(0, 1 - Math.abs(phase - hash(c.seed + 108)) * 3.6);
  const strands = 3 + Math.floor(hash(c.seed + 140) * 6);
  for (let strand = 0; strand < strands; strand += 1) {
    const startX = c.x + (strand - strands / 2) * 2;
    const startY = c.y + (hash(c.seed * 7 + strand) - .5) * c.span * .3;
    let x = startX, y = startY;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let step = 1; step < 22; step += 1) {
      const bend = Math.sin(step * .66 + c.seed * .4 + phase * 8) * (1.5 + pulse * 2.4);
      x += Math.cos(c.tilt + bend * .16) * (c.span / 16);
      y += Math.sin(c.tilt + bend * .22) * (c.span / 18) + (strand - strands / 2) * .08;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(220, 214, 193, ${.04 + witness * .45})`;
    ctx.lineWidth = strand === 0 ? 1.35 : .55;
    ctx.stroke();
  }
  if (witness > .06) {
    ctx.fillStyle = `rgba(188, 68, 43, ${witness * .9})`;
    ctx.beginPath(); ctx.arc(c.x, c.y, 1.5 + witness * 3.4, 0, Math.PI * 2); ctx.fill();
  }
}

function render(now) {
  const phase = reduce ? .62 : (now % 28000) / 28000;
  ctx.fillStyle = '#171714'; ctx.fillRect(0, 0, width, height);

  const canvasBox = canvas.getBoundingClientRect();
  const titleZone = document.querySelector('.title').getBoundingClientRect();
  const margin = 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(
    titleZone.left - canvasBox.left - margin,
    titleZone.top - canvasBox.top - margin,
    titleZone.width + margin * 2,
    titleZone.height + margin * 2
  );
  ctx.clip('evenodd');

  const grain = Math.max(18, Math.floor(width / 31));
  for (let i = 0; i < grain; i += 1) {
    const x = (i / grain) * width;
    line(x, height * .08, x + Math.sin(i * 11) * 9, height * .9, .035, .5);
  }
  colonies.forEach((c) => colony(c, phase));
  const tolerance = width * (.12 + phase * .76);
  ctx.fillStyle = 'rgba(188, 68, 43, .11)'; ctx.fillRect(tolerance - 1, height * .08, 2, height * .82);
  line(tolerance, height * .08, tolerance, height * .90, .95, 1.2);
  if (width >= 650) {
    const score = Math.floor(12 + phase * 74);
    ctx.fillStyle = 'rgba(220, 214, 193, .5)'; ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = tolerance > width - 170 ? 'right' : 'left';
    ctx.fillText(`RETAINED CONTOUR / ${String(score).padStart(2, '0')}%`, tolerance + (tolerance > width - 170 ? -10 : 10), height * .90);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function frame(now) {
  render(now);
  if (!reduce) requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame(frame);