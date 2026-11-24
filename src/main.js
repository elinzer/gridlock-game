var BUILD = 'spike';

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', draw);
  }
}

function draw() {
  var canvas = document.getElementById('screen');
  var dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ffd34a';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOWER WACKER', window.innerWidth / 2, window.innerHeight / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '24px monospace';
  ctx.fillText('build ' + BUILD, window.innerWidth / 2, window.innerHeight / 2 + 10);
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    ctx.fillStyle = '#4ade80';
    ctx.fillText('OFFLINE OK', window.innerWidth / 2, window.innerHeight / 2 + 60);
  }
}

registerServiceWorker();
draw();
window.addEventListener('resize', draw);
