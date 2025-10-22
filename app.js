// app.js - simple SPA-like helpers for music listing + player + track page
// Works with songs.json structure.
(async ()=>{
  const res = await fetch('songs.json?v='+Date.now());
  const text = await res.text();
  console.log("RAW RESPONSE:", text.slice(0,200));
})();
async function fetchSongs(){
  const res = await fetch('songs.json');
  const data = await res.json();
  return data;
}

/* ---------- MUSIC LIST PAGE (music.html) ---------- */
async function renderPlaylist(containerId){
  const songs = await fetchSongs();
  const container = document.getElementById(containerId);
  if(!container) return;
  if(songs.length === 0){ container.innerHTML = `<p style="text-align:center;color:#777">هنوز آهنگی اضافه نشده.</p>`; return; }

  const grid = document.createElement('div');
  grid.className = 'grid';

  songs.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="cover" src="${s.cover}" alt="${escapeHtml(s.title)}" />
      <div class="meta">
        <div>
          <div class="title">${escapeHtml(s.title)}</div>
          <div class="artist">${escapeHtml(s.artist)}</div>
        </div>
        <div>
          <a class="small-btn" href="track.html?id=${encodeURIComponent(s.id)}">صفحهٔ ترک</a>
        </div>
      </div>
      <div class="desc">${escapeHtml(s.description || '')}</div>
      <div class="player-row">
        <button class="play-btn" data-src="${s.src}" data-index="${idx}">▶ پخش</button>
        <button class="small-btn" data-src="${s.src}" data-index="${idx}">افزودن به پلیر</button>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // attach play behavior
  container.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const src = btn.getAttribute('data-src');
      const index = Number(btn.getAttribute('data-index'));
      await globalPlayer.loadAndPlayByIndex(index);
    });
  });
}

/* ---------- GLOBAL BOTTOM PLAYER ---------- */
const globalPlayer = {
  songs: [],
  currentIndex: 0,
  audio: new Audio(),
  init: async function(){
    this.songs = await fetchSongs();
    this.cacheElements();
    this.bindEvents();
    // if URL has ?id=... and we are on track.html that page will handle load
    return this;
  },
  cacheElements: function(){
    this.el = {
      container: document.querySelector('.bottom-player'),
      cover: document.querySelector('.bp-cover'),
      title: document.querySelector('.bp-title'),
      artist: document.querySelector('.bp-artist'),
      playBtn: document.querySelector('.bp-play'),
      prevBtn: document.querySelector('.bp-prev'),
      nextBtn: document.querySelector('.bp-next'),
      progressWrap: document.querySelector('.progress-wrap'),
      progress: document.querySelector('.progress'),
      currentTime: document.querySelector('.time-cur'),
      duration: document.querySelector('.time-dur')
    };
    if(!this.el.container) {
      // inject bottom-player to body
      const html = `
        <div class="bottom-player" style="display:none">
          <img class="bp-cover" src="" alt="cover">
          <div class="bp-meta">
            <div class="bp-title">—</div>
            <div class="bp-artist">—</div>
            <div class="progress-wrap"><div class="progress"></div></div>
            <div class="time-row"><span class="time-cur">0:00</span><span class="time-dur">0:00</span></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
            <button class="small-btn bp-prev">⏮</button>
            <button class="play-btn bp-play">▶</button>
            <button class="small-btn bp-next">⏭</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
      this.cacheElements(); // re-cache
    }
  },
  bindEvents: function(){
    const self = this;
    this.el.playBtn.addEventListener('click', () => {
      if(this.audio.paused) this.audio.play(); else this.audio.pause();
    });
    this.el.prevBtn.addEventListener('click', () => {
      this.prev();
    });
    this.el.nextBtn.addEventListener('click', () => {
      this.next();
    });
    // progress click
    this.el.progressWrap.addEventListener('click', (e) => {
      const rect = this.el.progressWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      if(this.audio.duration) this.audio.currentTime = pct * this.audio.duration;
    });
    // audio events
    this.audio.addEventListener('timeupdate', () => {
      const pct = (this.audio.currentTime / (this.audio.duration || 1)) * 100;
      this.el.progress.style.width = pct + '%';
      this.el.currentTime.textContent = formatTime(this.audio.currentTime);
    });
    this.audio.addEventListener('loadedmetadata', () => {
      this.el.duration.textContent = formatTime(this.audio.duration || 0);
    });
    this.audio.addEventListener('play', () => {
      this.el.playBtn.textContent = '⏸';
      this.el.container.style.display = 'flex';
    });
    this.audio.addEventListener('pause', () => {
      this.el.playBtn.textContent = '▶';
    });
    this.audio.addEventListener('ended', () => {
      this.next();
    });
  },
  loadByIndex: function(i){
    const s = this.songs[i];
    if(!s) return;
    this.currentIndex = i;
    this.audio.src = s.src;
    this.el.cover.src = s.cover;
    this.el.title.textContent = s.title;
    this.el.artist.textContent = s.artist;
    this.el.progress.style.width = '0%';
    // update URL hash for visibility (but don't reload)
    history.replaceState(null, '', window.location.pathname + '?now=' + encodeURIComponent(s.id));
  },
  loadAndPlayByIndex: async function(i){
    this.loadByIndex(i);
    await this.audio.play().catch(()=>{ /* autoplay blocked */});
  },
  prev: function(){
    const n = (this.currentIndex - 1 + this.songs.length) % this.songs.length;
    this.loadAndPlayByIndex(n);
  },
  next: function(){
    const n = (this.currentIndex + 1) % this.songs.length;
    this.loadAndPlayByIndex(n);
  }
};

/* ---------- TRACK PAGE (track.html) ---------- */
async function renderTrackPage(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if(!id) return;
  const songs = await fetchSongs();
  const track = songs.find(s => s.id === id);
  if(!track){
    document.getElementById('track-root').innerHTML = '<p style="color:#ccc">ترک پیدا نشد.</p>';
    return;
  }
  // populate
  document.getElementById('track-root').innerHTML = `
    <div class="container">
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <img src="${track.cover}" style="width:260px;height:260px;border-radius:12px;object-fit:cover" alt="${escapeHtml(track.title)}">
        <div style="flex:1;min-width:220px">
          <h2 style="color:var(--accent);margin:0">${escapeHtml(track.title)}</h2>
          <div style="color:var(--muted);margin-top:6px">${escapeHtml(track.artist)}</div>
          <p style="color:var(--muted);margin-top:14px;line-height:1.7">${escapeHtml(track.description)}</p>
          <div style="margin-top:16px;display:flex;gap:10px">
            <button class="play-btn" id="track-play">▶ پخش</button>
            <a class="small-btn" href="${track.src}">دانلود</a>
            <a class="small-btn" href="music.html">برگشت</a>
          </div>
        </div>
      </div>
      <div style="margin-top:22px">
        <h3 style="color:var(--accent)">متن آهنگ</h3>
        <pre style="white-space:pre-wrap;color:var(--muted)">${escapeHtml(track.lyrics || 'متن موجود نیست.')}</pre>
      </div>
    </div>
  `;
  // add play behavior (use global player)
  document.getElementById('track-play').addEventListener('click', async () => {
    const index = (await fetchSongs()).findIndex(s => s.id === id);
    if(index !== -1) globalPlayer.loadAndPlayByIndex(index);
  });
}

/* ---------- UTIL ---------- */
function formatTime(sec){
  if(!sec || isNaN(sec)) return '0:00';
  const s = Math.floor(sec % 60).toString().padStart(2,'0');
  const m = Math.floor(sec / 60);
  return `${m}:${s}`;
}
function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]}); }

/* ---------- AUTO INIT ---------- */
// initialize bottom player data
document.addEventListener('DOMContentLoaded', async () => {
  await globalPlayer.init();
  // If on music.html -> render playlist
  if(document.getElementById('playlist-root')) renderPlaylist('playlist-root');
  // If on track.html -> render track page
  if(document.getElementById('track-root')) renderTrackPage();
});

