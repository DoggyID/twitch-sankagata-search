// カオスモード: 激しい変色・明滅・揺れ（本体ロジックから移植）
let running = false;

export function activateChaos() {
  if (running) return;
  running = true;

  // 激しい変色と明滅
  setInterval(() => {
    const hue = Math.floor(Math.random() * 360);
    const rand = Math.random();
    let lightness;
    if (rand < 0.3) lightness = 10;
    else if (rand < 0.6) lightness = 90;
    else lightness = 50;
    const color = `hsl(${hue}, 100%, ${lightness}%)`;
    document.body.style.backgroundColor = color;
    document.documentElement.style.backgroundColor = color;
  }, 50);

  // 激しい揺れ
  setInterval(() => {
    const deg = Math.random() * 40 - 20;
    const x = Math.random() * 40 - 20;
    const y = Math.random() * 40 - 20;
    const scale = 0.8 + Math.random() * 0.4;
    document.body.style.transform = `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${scale})`;
  }, 30);

  // テキスト・要素のカオス
  setInterval(() => {
    document.querySelectorAll('h1, h2, h3, p, a, button').forEach((el) => {
      el.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      if (Math.random() > 0.9) {
        el.style.fontSize = (Math.random() * 2 + 0.5) + 'em';
      }
    });
  }, 200);
}
