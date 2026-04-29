// SpeedTest Configuration
const CONFIG = {
    // HTTP/1.1 browsers allow max 6 concurrent connections per origin.
    // Streaming downloads hold connections open for the full duration,
    // so requests 7-10 never run. Use 6 for download.
    DOWNLOAD_CONNECTIONS: 6,
    // Upload uses request-response (connections get reused), so more
    // workers queue efficiently against the 6-slot pool.
    UPLOAD_CONNECTIONS: 10,
    DOWNLOAD_DURATION: 10, // seconds
    UPLOAD_DURATION: 10,   // seconds
    PING_COUNT: 20,        // lebih banyak sampel untuk akurasi minimum
    PING_INTERVAL: 50,     // ms antar paket — cukup pendek agar koneksi tetap hangat
    MAX_HISTORY: 10,
    // Timeout settings (dalam milliseconds)
    PING_TIMEOUT: 5000,    // 5 detik per ping packet
    DOWNLOAD_TIMEOUT: 15000, // 15 detik untuk inisiasi download
    UPLOAD_TIMEOUT: 15000    // 15 detik untuk inisiasi upload
};

// Global state
let currentServer = null;
let isTestRunning = false;
let abortControllers = [];

// DOM Elements
const serverSelect = document.getElementById('server-select');
const startTestBtn = document.getElementById('start-test');
const stopTestBtn = document.getElementById('stop-test');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const pingResult = document.getElementById('ping-result');
const jitterResult = document.getElementById('jitter-result');
const downloadResult = document.getElementById('download-result');
const uploadResult = document.getElementById('upload-result');
const currentServerText = document.getElementById('current-server');
const historyContainer = document.getElementById('history-container');

// Lookup server name from dropdown options by URL (fallback for old entries without serverName)
function resolveServerName(serverUrl, savedName) {
    if (savedName && savedName.trim()) return savedName;
    if (serverUrl && serverSelect) {
        for (const opt of serverSelect.options) {
            if (opt.value && opt.value === serverUrl && opt.dataset.name) {
                return opt.dataset.name;
            }
        }
    }
    // Last resort: strip protocol/port from URL
    return (serverUrl || '').replace(/^https?:\/\//, '').replace(/:8080$/, '') || 'Unknown';
}

// Helper: Fetch dengan timeout detection
function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    if (options.signal) {
        // Jika sudah ada signal (untuk manual abort), gabungkan
        const originalSignal = options.signal;
        originalSignal.addEventListener('abort', () => controller.abort());
    }
    
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

// Helper: Tampilkan custom error modal (menggantikan browser alert())
function showErrorModal(title, body) {
    const modal   = document.getElementById('st-error-modal');
    const titleEl = document.getElementById('st-err-title');
    const bodyEl  = document.getElementById('st-err-body');
    if (!modal) { alert(`${title}\n\n${body}`); return; } // fallback
    // Strip emoji untuk judul yang lebih bersih di modal
    titleEl.textContent = title.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}⚠️❌🌐⏱️]\s*/u, '');
    bodyEl.textContent  = body;
    modal.style.display = 'flex';
    // Tutup jika klik backdrop
    modal.querySelector('.st-err-backdrop').onclick = () => { modal.style.display = 'none'; };
    // Fokus tombol OK untuk aksesibilitas keyboard
    setTimeout(() => { const btn = document.getElementById('st-err-ok'); if (btn) btn.focus(); }, 50);
}

// Helper: Tampilkan error notification yang user-friendly
function showTestError(phase, errorType, serverName) {
    let message = '';
    let suggestion = '';
    
    if (errorType === 'timeout') {
        message = `⏱️ Timeout: Server tidak merespon`;
        suggestion = `Server "${serverName}" terlalu jauh atau tidak aktif. Silakan pilih server yang lebih dekat atau coba lagi nanti.`;
    } else if (errorType === 'network') {
        message = `🌐 Koneksi Gagal: Tidak dapat menghubungi server`;
        suggestion = `Periksa koneksi internet Anda atau pilih server lain yang lebih stabil.`;
    } else if (errorType === 'server-error') {
        message = `❌ Server Error: Server mengalami masalah`;
        suggestion = `Server "${serverName}" sedang bermasalah. Coba pilih server lain atau hubungi administrator.`;
    } else {
        message = `⚠️ Error: ${phase} gagal`;
        suggestion = `Terjadi kesalahan tidak terduga. Silakan coba lagi atau pilih server lain.`;
    }
    
    // Update progress bar dengan error message
    if (progressText) {
        progressText.innerHTML = `<span style="color: #ef4444;">${message}</span>`;
    }
    
    // Tampilkan gauge error state
    setGaugeDisplay('ERROR', '!', '', '#ef4444');
    
    // Tampilkan custom modal
    setTimeout(() => {
        showErrorModal(message, suggestion);
    }, 500);
    
    console.error(`[SpeedTest ${phase}] ${errorType}:`, { server: serverName });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    initializeEventListeners();
});

function initializeEventListeners() {
    serverSelect.addEventListener('change', (e) => {
        currentServer = e.target.value;
        startTestBtn.disabled = !currentServer;
        if (currentServerText) currentServerText.textContent = currentServer || 'Belum dipilih';
    });

    startTestBtn.addEventListener('click', startSpeedTest);
    stopTestBtn.addEventListener('click', stopSpeedTest);
}

async function startSpeedTest() {
    if (!currentServer || isTestRunning) return;

    isTestRunning = true;
    startTestBtn.disabled = true;
    startTestBtn.classList.add('running');  // Hide button label, show displays
    stopTestBtn.disabled = false;
    progressContainer.style.display = 'block';
    abortControllers = [];

    // Reset results
    pingResult.textContent = '—';
    if (jitterResult) jitterResult.textContent = '—';
    downloadResult.textContent = '—';
    uploadResult.textContent = '—';
    setGaugeSpeed(0, null);
    setGaugeDisplay('PING', null, 'ms', null);

    try {
        // Test 1: Ping
        await testPing();

        // Test 2: Download
        await testDownload();

        // Test 3: Upload
        await testUpload();

        // Save to history
        await saveToHistory({
            server: currentServer,
            serverName: serverSelect ? (serverSelect.options[serverSelect.selectedIndex]?.dataset?.name || serverSelect.options[serverSelect.selectedIndex]?.text || '') : '',
            timestamp: new Date().toLocaleString('id-ID'),
            ping: pingResult.textContent,
            jitter: jitterResult ? jitterResult.textContent : '—',
            download: downloadResult.textContent,
            upload: uploadResult.textContent
        });

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Test error:', error);
            
            // Jangan tampilkan alert di sini karena sudah ditampilkan di showTestError()
            // Alert sudah di-handle per phase (ping/download/upload)
        }
    } finally {
        isTestRunning = false;
        startTestBtn.disabled = false;
        startTestBtn.classList.remove('running');  // Restore button label
        stopTestBtn.disabled = true;
        progressContainer.style.display = 'none';
        document.querySelectorAll('.metric-card').forEach(card => card?.classList.remove('testing'));
        // Fade gauge back to zero after a short delay
        setTimeout(() => { setGaugeSpeed(0, null); setGaugeDisplay('', null, '', null); }, 1800);
    }
}

function stopSpeedTest() {
    abortControllers.forEach(controller => controller.abort());
    abortControllers = [];
}

async function testPing() {
    updateProgress(10, 'Testing Ping...');
    document.querySelector('.metric-card.ping')?.classList.add('testing');
    setGaugeDisplay('PING', null, 'ms', null);

    // ── Warmup: 3 paket GET untuk pastikan koneksi TCP sudah terbuka ──────────
    // GET tidak punya request body sehingga server langsung membalas "pong"
    // tanpa membaca/parsing body → overhead minimum, mendekati ICMP ping.
    const _apiBaseWarmup = window.API_URL || '';
    const _warmupUrl = `${_apiBaseWarmup}/api/ping-server?url=${encodeURIComponent(currentServer)}`;
    for (let w = 0; w < 3; w++) {
        try {
            const wr = await fetchWithTimeout(_warmupUrl, {
                method: 'GET',
                cache: 'no-store'
            }, CONFIG.PING_TIMEOUT + 2000);
            await wr.json();
        } catch (e) {
            if (e.name === 'AbortError') {
                const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                showTestError('Ping Warmup', 'timeout', serverName);
                throw e;
            }
            // Error non-timeout di warmup diabaikan
        }
    }

    // ── Pengukuran: PING_COUNT paket GET dengan interval pendek ──────────────
    //
    // Mengapa GET (bukan POST):
    //   POST mengharuskan server membaca seluruh request body sebelum membalas.
    //   GET tidak punya body → server membalas "pong" seketika → overhead lebih
    //   kecil dan hasil lebih mendekati ICMP ping dari CMD/terminal.
    //
    // Mengapa MINIMUM (bukan median/rata-rata):
    //   Nilai minimum RTT = latensi jaringan murni.
    //   Nilai yang lebih besar dari minimum disebabkan oleh variabilitas
    //   server (GC pause, context switch) bukan kondisi jaringan.
    //   ICMP ping di CMD juga menampilkan nilai minimum sebagai acuan.
    //
    // Mengapa interval 50ms (bukan 300ms):
    //   Interval pendek menjaga koneksi tetap hangat (tidak perlu re-handshake)
    //   dan menghasilkan 20 sampel dalam ~1 detik.
    const pingTimes = [];

    // Use backend proxy for ping to avoid Mixed Content errors (HTTPS page → HTTP server)
    const apiBase = window.API_URL || '';
    const pingProxyUrl = `${apiBase}/api/ping-server?url=${encodeURIComponent(currentServer)}`;

    for (let i = 0; i < CONFIG.PING_COUNT; i++) {
        const controller = new AbortController();
        abortControllers.push(controller);

        const progress = 10 + Math.round(i * (15 / CONFIG.PING_COUNT));
        updateProgress(progress, `Ping ${i + 1}/${CONFIG.PING_COUNT}...`);

        try {
            const resp = await fetchWithTimeout(pingProxyUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            }, CONFIG.PING_TIMEOUT + 2000); // extra buffer for proxy hop

            if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
            const d = await resp.json();
            if (!d.ok) throw new Error('ping-server proxy failed');

            const rtt = d.latency;
            pingTimes.push(rtt);

            // Tampilkan minimum berjalan agar user melihat angka terendah
            const currentMin = Math.round(Math.min(...pingTimes));
            updateProgress(
                10 + Math.round((i + 1) * (15 / CONFIG.PING_COUNT)),
                `Ping ${i + 1}/${CONFIG.PING_COUNT}: ${Math.round(rtt)} ms  (min: ${currentMin} ms)`
            );
            setGaugeDisplay('PING', currentMin, 'ms', '#a78bfa');

        } catch (error) {
            if (error.name === 'AbortError') {
                const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                if (!isTestRunning) throw error; // manual stop
                showTestError('Ping', 'timeout', serverName);
                throw error;
            }
            if (error.message?.includes('Server error')) {
                const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                showTestError('Ping', 'server-error', serverName);
                throw error;
            }
            console.warn(`Ping packet ${i + 1} failed:`, error.message);
            if (i >= Math.floor(CONFIG.PING_COUNT / 2) && pingTimes.length === 0) {
                const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                showTestError('Ping', 'network', serverName);
                throw error;
            }
        }

        // Interval antar paket — pendek agar koneksi tetap hangat
        if (i < CONFIG.PING_COUNT - 1) {
            await new Promise(r => setTimeout(r, CONFIG.PING_INTERVAL));
        }
    }

    // Ping = RTT minimum dari semua sampel (mencerminkan latensi jaringan murni,
    // sama seperti yang ditampilkan oleh perintah ping di CMD/terminal).
    const minPing = Math.round(Math.min(...pingTimes));

    // Jitter = rata-rata selisih absolut antar paket berurutan (metode Ookla).
    // Mengukur variabilitas/ketidakstabilan latensi, bukan besarnya latency.
    const jitter = pingTimes.length > 1
        ? Math.round(
            pingTimes.slice(1).reduce((sum, t, i) => sum + Math.abs(t - pingTimes[i]), 0)
            / (pingTimes.length - 1)
          )
        : 0;

    pingResult.textContent = minPing;
    if (jitterResult) jitterResult.textContent = jitter;

    setGaugeDisplay('PING', minPing, 'ms', '#a78bfa');
    await new Promise(r => setTimeout(r, 1500));

    setGaugeDisplay('JITTER', jitter, 'ms', '#f472b6');
    await new Promise(r => setTimeout(r, 1500));

    document.querySelector('.metric-card.ping')?.classList.remove('testing');
}

async function testDownload() {
    updateProgress(25, 'Testing Download Speed...');
    document.querySelector('.metric-card.download')?.classList.add('testing');
    setGaugeDisplay('UNDUH', null, 'Mbps', '#22d3ee');

    const _dlApiBase = window.API_URL || '';
    const _dlTarget  = encodeURIComponent(currentServer);
    const _dlProxy   = `${_dlApiBase}/api/speedtest-proxy?target=${_dlTarget}`;

    // ── Warmup phase ─────────────────────────────────────────────────────────
    // TCP slow-start ramps up slowly; discard the first 2 seconds so that
    // measured bytes reflect steady-state throughput, not ramp-up.
    const WARMUP_MS = 2000;
    const warmupControllers = [];
    const warmupEnd = performance.now() + WARMUP_MS;
    updateProgress(26, 'Warmup Download...');

    const warmupPromises = Array.from({ length: CONFIG.DOWNLOAD_CONNECTIONS }, () => {
        const wc = new AbortController();
        warmupControllers.push(wc);
        return (async () => {
            try {
                const resp = await fetch(`${_dlProxy}&duration=3`, {
                    method: 'GET', cache: 'no-store', signal: wc.signal
                });
                if (!resp.body) return;
                const reader = resp.body.getReader();
                while (performance.now() < warmupEnd) {
                    const { done } = await reader.read();
                    if (done) break;
                }
                reader.cancel();
            } catch (e) { /* warmup errors ignored */ }
        })();
    });
    await Promise.race([
        Promise.all(warmupPromises),
        new Promise(r => setTimeout(r, WARMUP_MS + 200))
    ]);
    warmupControllers.forEach(c => c.abort());

    // ── Measurement phase ─────────────────────────────────────────────────────
    const startTime = performance.now();
    const endTime = startTime + (CONFIG.DOWNLOAD_DURATION * 1000);
    let totalBytes = 0;
    let lastUpdate = startTime;

    // Use DOWNLOAD_CONNECTIONS (6) — matches HTTP/1.1 per-origin browser limit
    const downloadPromises = [];
    
    for (let i = 0; i < CONFIG.DOWNLOAD_CONNECTIONS; i++) {
        const controller = new AbortController();
        abortControllers.push(controller);

        const downloadPromise = (async () => {
            while (performance.now() < endTime) {
                try {
                    const response = await fetchWithTimeout(
                        `${_dlProxy}&duration=${CONFIG.DOWNLOAD_DURATION}`,
                        {
                            method: 'GET',
                            cache: 'no-store',
                            signal: controller.signal
                        },
                        CONFIG.DOWNLOAD_TIMEOUT
                    );

                    if (!response.ok) {
                        const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                        showTestError('Download', 'server-error', serverName);
                        throw new Error('Download failed');
                    }

                    if (!response.body) throw new Error('No response body');
                    const reader = response.body.getReader();
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done || performance.now() >= endTime) break;
                        
                        totalBytes += value.length;

                        // Update display every 200ms
                        const now = performance.now();
                        if (now - lastUpdate > 200) {
                            const elapsed = (now - startTime) / 1000;
                            const speedMbps = ((totalBytes * 8) / (1000 * 1000)) / elapsed;
                            downloadResult.textContent = speedMbps.toFixed(2);
                            setGaugeSpeed(speedMbps, 'download');
                            setGaugeDisplay('UNDUH', speedMbps.toFixed(1), 'Mbps', '#22d3ee');
                            
                            const progress = 25 + ((now - startTime) / (CONFIG.DOWNLOAD_DURATION * 1000)) * 35;
                            updateProgress(Math.min(60, progress), `Download: ${speedMbps.toFixed(2)} Mbps`);
                            
                            lastUpdate = now;
                        }
                    }

                    reader.cancel();
                    break;
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        // Timeout atau manual stop
                        if (performance.now() < endTime && totalBytes === 0) {
                            // Timeout di awal download (tidak ada data sama sekali)
                            const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                            showTestError('Download', 'timeout', serverName);
                        }
                        throw error;
                    }
                    if (performance.now() >= endTime) break;
                    console.error(`Download stream ${i} error:`, error);
                    
                    // Jika semua connection gagal di awal, stop test
                    if (totalBytes === 0 && i === CONFIG.DOWNLOAD_CONNECTIONS - 1) {
                        const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                        showTestError('Download', 'network', serverName);
                        throw error;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        })();

        downloadPromises.push(downloadPromise);
    }

    await Promise.all(downloadPromises);

    const totalTime = (performance.now() - startTime) / 1000;
    const finalSpeedMbps = ((totalBytes * 8) / (1000 * 1000)) / totalTime;
    downloadResult.textContent = finalSpeedMbps.toFixed(2);
    
    document.querySelector('.metric-card.download')?.classList.remove('testing');
}

async function testUpload() {
    updateProgress(60, 'Testing Upload Speed...');
    document.querySelector('.metric-card.upload')?.classList.add('testing');
    setGaugeDisplay('UNGGAH', null, 'Mbps', '#fbbf24');

    const _ulApiBase = window.API_URL || '';
    const _ulTarget  = encodeURIComponent(currentServer);
    const _ulProxy   = `${_ulApiBase}/api/speedtest-proxy?target=${_ulTarget}`;

    // ── Upload data buffer ────────────────────────────────────────────────────
    // 4MB chunks: amortizes per-request HTTP overhead (was 64KB = bottleneck).
    // Bandwidth-Delay Product for 1Gbps@8ms = 1MB, so 4MB covers 4× BDP.
    // Math.random() loop for 4MB would take ~2s — use WebCrypto instead.
    // crypto.getRandomValues is limited to 65536 bytes per call, loop it.
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const uploadData = new Uint8Array(chunkSize);
    for (let off = 0; off < uploadData.length; off += 65536) {
        crypto.getRandomValues(uploadData.subarray(off, Math.min(off + 65536, uploadData.length)));
    }

    // Time-based limit — prevents infinite loop on mobile
    const startTime = performance.now();
    const endTime = startTime + (CONFIG.UPLOAD_DURATION * 1000);
    let totalBytes = 0;
    let lastUpdate = startTime;

    const uploadPromises = [];

    for (let i = 0; i < CONFIG.UPLOAD_CONNECTIONS; i++) {
        const controller = new AbortController();
        abortControllers.push(controller);

        const uploadPromise = (async () => {
            while (performance.now() < endTime) {
                try {
                    const response = await fetchWithTimeout(
                        _ulProxy,
                        {
                            method: 'POST',
                            body: uploadData,
                            cache: 'no-store',
                            signal: controller.signal,
                            headers: { 'Content-Type': 'application/octet-stream' }
                        },
                        CONFIG.UPLOAD_TIMEOUT
                    );

                    if (!response.ok) {
                        const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                        showTestError('Upload', 'server-error', serverName);
                        throw new Error('Upload failed');
                    }

                    totalBytes += uploadData.length;

                    const now = performance.now();
                    if (now - lastUpdate > 200) {
                        const elapsed = (now - startTime) / 1000;
                        const speedMbps = ((totalBytes * 8) / (1000 * 1000)) / elapsed;
                        uploadResult.textContent = speedMbps.toFixed(2);
                        setGaugeSpeed(speedMbps, 'upload');
                        setGaugeDisplay('UNGGAH', speedMbps.toFixed(1), 'Mbps', '#fbbf24');

                        const progress = 60 + ((now - startTime) / (CONFIG.UPLOAD_DURATION * 1000)) * 35;
                        updateProgress(Math.min(95, progress), `Upload: ${speedMbps.toFixed(2)} Mbps`);

                        lastUpdate = now;
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        // Timeout atau manual stop
                        if (performance.now() < endTime && totalBytes === 0) {
                            // Timeout di awal upload (tidak ada data terkirim)
                            const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                            showTestError('Upload', 'timeout', serverName);
                        }
                        throw error;
                    }
                    if (performance.now() >= endTime) break;
                    console.error(`Upload stream ${i} error:`, error);
                    
                    // Jika semua connection gagal di awal, stop test
                    if (totalBytes === 0 && i === CONFIG.UPLOAD_CONNECTIONS - 1) {
                        const serverName = serverSelect?.options[serverSelect.selectedIndex]?.dataset?.name || currentServer;
                        showTestError('Upload', 'network', serverName);
                        throw error;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        })();

        uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);

    const totalTime = (performance.now() - startTime) / 1000;
    const finalSpeedMbps = totalTime > 0 ? ((totalBytes * 8) / (1000 * 1000)) / totalTime : 0;
    uploadResult.textContent = finalSpeedMbps.toFixed(2);

    updateProgress(100, 'Test Selesai! ✓');
    document.querySelector('.metric-card.upload')?.classList.remove('testing');
}

function updateProgress(percent, text) {
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
    // Gauge is driven by setGaugeSpeed() during download/upload.
    // For ping/idle phases, keep arc at 0 if explicitly reset.
}

/* ── Gauge speed helpers ──────────────────────────────────────── */
/* ── In-button display helper ────────────────────────────────── */
function setGaugeDisplay(label, value, unit, color) {
    const lbl = document.getElementById('gd-label');
    const val = document.getElementById('gd-value');
    const unt = document.getElementById('gd-unit');
    if (!lbl || !val || !unt) return;
    lbl.textContent = label;
    unt.textContent = unit;
    if (value === null || value === undefined) {
        val.textContent = '—';
        val.style.fontSize = '';
    } else {
        const str = String(value);
        val.textContent = str;
        // Adaptive font size
        val.style.fontSize = str.length <= 3 ? '1.75rem' : str.length <= 5 ? '1.5rem' : '1.25rem';
    }
    val.style.color = color || '#fff';
    val.style.textShadow = color ? `0 0 14px ${color}88` : '0 0 12px rgba(255,255,255,0.25)';
}

function speedToArc(mbps) {
    // Logarithmic scale: 0–1000 Mbps maps to 0–471 (270° arc)
    const maxArc = 471;
    if (mbps <= 0) return 0;
    const logVal = Math.log10(1 + mbps);
    const logMax = Math.log10(1001);
    return Math.min(maxArc, Math.round((logVal / logMax) * maxArc));
}

function setGaugeSpeed(mbps, phase) {
    const liveEl = document.getElementById('gauge-live-speed');
    // Update arc dasharray + color
    const arc = document.getElementById('gauge-progress');
    if (arc) {
        const filled = speedToArc(mbps);
        arc.style.strokeDasharray = `${filled} ${628 - filled}`;
        if (phase === 'download') {
            arc.style.stroke = 'url(#gaugeGradDownload)';
        } else if (phase === 'upload') {
            arc.style.stroke = 'url(#gaugeGradUpload)';
        } else {
            arc.style.stroke = '';
        }
    }
    // Update live speed number with adaptive font size
    const numEl = document.getElementById('gls-num');
    if (numEl) {
        if (mbps > 0) {
            const str = mbps.toFixed(2);
            numEl.textContent = str;
            // Adapt size: "9.99"=4chars, "99.99"=5, "999.99"=6
            numEl.style.fontSize = str.length <= 4 ? '2.6rem' : str.length <= 5 ? '2.2rem' : '1.85rem';
        } else {
            numEl.textContent = '—';
            numEl.style.fontSize = '';
        }
    }
    // Show/hide the readout
    if (liveEl) {
        liveEl.classList.toggle('visible', mbps > 0);
    }
    // Hide gauge-display when live-speed is visible
    const displayEl = document.getElementById('gauge-display');
    if (displayEl) {
        if (mbps > 0) {
            displayEl.style.opacity = '0';
            displayEl.style.visibility = 'hidden';
        } else {
            displayEl.style.opacity = '';
            displayEl.style.visibility = '';
        }
    }
    // Update phase icon color to match arc
    const iconEl = document.getElementById('gls-phase-icon');
    if (iconEl) {
        if (phase === 'download') {
            iconEl.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
            iconEl.style.color = '#22d3ee';
        } else if (phase === 'upload') {
            iconEl.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
            iconEl.style.color = '#fbbf24';
        } else {
            iconEl.innerHTML = '';
            iconEl.style.color = '';
        }
    }
}

function animateGauge(percent) {
    const arc = document.getElementById('gauge-progress');
    if (!arc) return;
    const maxArc = 471;
    const filled = Math.round((percent / 100) * maxArc);
    arc.style.strokeDasharray = `${filled} ${628 - filled}`;
}

async function saveToHistory(result) {
    const token = localStorage.getItem('speedtest_token');
    if (token) {
        try {
            await saveToHistoryDB({
                server: result.server || '',
                serverName: result.serverName || '',
                ping: parseFloat(result.ping) || 0,
                jitter: parseFloat(result.jitter) || 0,
                download: parseFloat(result.download) || 0,
                upload: parseFloat(result.upload) || 0
            });
            await loadHistory();
            return;
        } catch { /* fallback to localStorage */ }
    }
    let history = JSON.parse(localStorage.getItem('speedtest_history') || '[]');
    history.unshift(result);
    if (history.length > CONFIG.MAX_HISTORY) history = history.slice(0, CONFIG.MAX_HISTORY);
    localStorage.setItem('speedtest_history', JSON.stringify(history));
    loadHistory();
}

async function clearHistory() {
    const token = localStorage.getItem('speedtest_token');
    if (token) { try { await clearHistoryDB(); } catch {} }
    localStorage.removeItem('speedtest_history');
    if (historyContainer) historyContainer.innerHTML = '<p class="no-history">Belum ada riwayat test</p>';
}

async function loadHistory() {
    if (!historyContainer) return;
    const token = localStorage.getItem('speedtest_token');
    if (token) {
        try {
            const rows = await getHistoryFromDB();
            if (rows.length === 0) {
                historyContainer.innerHTML = '<p class="no-history">Belum ada riwayat test</p>';
                return;
            }
            // Get current session for username display
            const session = (typeof getCurrentSession === 'function') ? getCurrentSession() : null;
            const displayUser = session ? (session.fullname || session.username) : null;
            historyContainer.innerHTML = rows.map(item => {
                const srvName = resolveServerName(item.server, item.serverName);
                const ts      = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
                const userBadge = displayUser
                    ? `<span class="shi-hdr-lbl" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;color:var(--accent);font-size:0.6rem">
                           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                           ${displayUser}
                       </span>`
                    : '';
                const _sd = btoa(unescape(encodeURIComponent(JSON.stringify({displayName:srvName,displayTs:ts,ping:item.ping,jitter:item.jitter,download:item.download,upload:item.upload}))));
                return `<div class="shi">
                    <div class="shi-header">
                        <div class="shi-hdr-server">
                            <span class="shi-hdr-lbl">Server</span>
                            <span class="shi-hdr-name">${srvName}</span>
                            ${userBadge}
                        </div>
                        <div class="shi-hdr-meta">
                            <div class="shi-hdr-time">
                                <span class="shi-hdr-lbl">Tanggal / Waktu</span>
                                <span class="shi-hdr-ts">${ts}</span>
                            </div>
                            <button class="shi-share-btn" data-result="${_sd}" onclick="shareResultFromBtn(this)" title="Bagikan ke sosial media">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                <span class="ssbtn-txt">Bagikan</span>
                            </button>
                        </div>
                    </div>
                    <div class="shi-blocks">
                        <div class="shi-block">
                            <span class="shi-b-lbl">Ping</span>
                            <span class="shi-b-val shi-ping-c">${item.ping || '—'}<small> ms</small></span>
                        </div>
                        <div class="shi-block">
                            <span class="shi-b-lbl">Jitter</span>
                            <span class="shi-b-val shi-jitter-c">${item.jitter || '—'}<small> ms</small></span>
                        </div>
                        <div class="shi-block">
                            <span class="shi-b-lbl">Unduhan</span>
                            <span class="shi-b-val shi-dl-c">${item.download || '—'}<small> Mbps</small></span>
                        </div>
                        <div class="shi-block">
                            <span class="shi-b-lbl">Unggahan</span>
                            <span class="shi-b-val shi-ul-c">${item.upload || '—'}<small> Mbps</small></span>
                        </div>
                    </div>
                </div>`;
            }).join('');
            return;
        } catch { /* fallback */ }
    }
    try {
        const history = JSON.parse(localStorage.getItem('speedtest_history') || '[]');
        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="no-history">Belum ada riwayat test</p>';
            return;
        }
        historyContainer.innerHTML = history.map(item => {
            const srvName = resolveServerName(item.server, item.serverName);
            const ts      = item.timestamp || '';
            const _sd = btoa(unescape(encodeURIComponent(JSON.stringify({displayName:srvName,displayTs:ts,ping:item.ping,jitter:item.jitter,download:item.download,upload:item.upload}))));
            return `<div class="shi">
                <div class="shi-header">
                    <div class="shi-hdr-server">
                        <span class="shi-hdr-lbl">Server</span>
                        <span class="shi-hdr-name">${srvName}</span>
                    </div>
                    <div class="shi-hdr-meta">
                        <div class="shi-hdr-time">
                            <span class="shi-hdr-lbl">Tanggal / Waktu</span>
                            <span class="shi-hdr-ts">${ts}</span>
                        </div>
                        <button class="shi-share-btn" data-result="${_sd}" onclick="shareResultFromBtn(this)" title="Bagikan ke sosial media">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            <span class="ssbtn-txt">Bagikan</span>
                        </button>
                    </div>
                </div>
                <div class="shi-blocks">
                    <div class="shi-block">
                        <span class="shi-b-lbl">Ping</span>
                        <span class="shi-b-val shi-ping-c">${item.ping || '—'}<small> ms</small></span>
                    </div>
                    <div class="shi-block">
                        <span class="shi-b-lbl">Jitter</span>
                        <span class="shi-b-val shi-jitter-c">${item.jitter || '—'}<small> ms</small></span>
                    </div>
                    <div class="shi-block">
                        <span class="shi-b-lbl">Unduhan</span>
                        <span class="shi-b-val shi-dl-c">${item.download || '—'}<small> Mbps</small></span>
                    </div>
                    <div class="shi-block">
                        <span class="shi-b-lbl">Unggahan</span>
                        <span class="shi-b-val shi-ul-c">${item.upload || '—'}<small> Mbps</small></span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch {
        localStorage.removeItem('speedtest_history');
        historyContainer.innerHTML = '<p class="no-history">Belum ada riwayat test</p>';
    }
}

// ── Share Functionality ──────────────────────────────────────────────────────

function shareResultFromBtn(btn) {
    const item = JSON.parse(decodeURIComponent(escape(atob(btn.dataset.result))));
    shareResult(item, btn);
}

async function shareResult(item, btn) {
    // Visual feedback on button
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span class="ssbtn-txt">Membuat…</span>';
    }

    try {
        const canvas = await generateShareCard(item);
        const blob   = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file   = new File([blob], 'speedtest-result.png', { type: 'image/png' });

        const dl   = item.download != null ? item.download : '—';
        const ul   = item.upload   != null ? item.upload   : '—';
        const ping = item.ping     != null ? item.ping     : '—';
        const jit  = item.jitter   != null ? item.jitter   : '—';
        const srv  = item.displayName || '—';
        const shareText = `Hasil Speed Test Internet saya:\n` +
            `\u2193 Unduhan : ${dl} Mbps\n` +
            `\u2191 Unggahan: ${ul} Mbps\n` +
            `\u23f1 Ping    : ${ping} ms  |  Jitter: ${jit} ms\n` +
            `Server   : ${srv}`;

        // Mobile / Safari 15+: share with image file
        const shareWithFile = { title: 'Hasil Speed Test', text: shareText, files: [file] };
        if (navigator.share && navigator.canShare && navigator.canShare(shareWithFile)) {
            await navigator.share(shareWithFile);
            return;
        }
        // Browsers that support share but not file (text share fallback)
        if (navigator.share) {
            await navigator.share({ title: 'Hasil Speed Test', text: shareText });
            return;
        }
        // Desktop fallback: download PNG
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `speedtest-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        if (btn) {
            btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="ssbtn-txt">Tersimpan!</span>';
            setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2000);
            return;
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Share error:', e);
            // Tunjukkan error di tombol agar user tahu apa yang terjadi
            if (btn) {
                btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span class="ssbtn-txt">Gagal</span>';
                btn.style.color = '#f87171';
                btn.style.borderColor = 'rgba(248,113,113,0.4)';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.color = '';
                    btn.style.borderColor = '';
                    btn.disabled = false;
                }, 2500);
                return;
            }
        }
    }
    if (btn) { btn.innerHTML = originalHTML; btn.disabled = false; }
}

// ── Share Card Canvas Generator (1200 × 630 — Open Graph ratio) ─────────────

async function generateShareCard(item) {
    const W = 1200, H = 630;
    const cv  = document.createElement('canvas');
    cv.width  = W;
    cv.height = H;
    const c = cv.getContext('2d');

    // Ambil site config — prioritas: (1) API langsung, (2) cache localStorage
    const _scApiBase = window.API_URL || '';
    let siteCfg = {};
    try {
        const r = await fetch(`${_scApiBase}/api/site-settings`, { cache: 'no-cache', signal: AbortSignal.timeout(3000) });
        if (r.ok) {
            const d = await r.json();
            if (d && Object.keys(d).length > 0) {
                siteCfg = d;
                // Update cache agar site-config.js juga menemukan data terbaru
                try { localStorage.setItem('site_config', JSON.stringify(d)); } catch {}
            }
        }
    } catch {}
    // Fallback ke localStorage jika API gagal
    if (!siteCfg.logoUrl && !siteCfg.brandMain) {
        try { siteCfg = JSON.parse(localStorage.getItem('site_config') || '{}'); } catch {}
    }
    const brandMain = (siteCfg.brandMain || 'WebSpeedTest').trim();
    const brandSub  = (siteCfg.brandSub  || 'Network Speed Test').trim();
    const logoUrl   = siteCfg.logoUrl || '';

    // ── Background ──────────────────────────────────────────────────────────
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#07071c');
    bg.addColorStop(0.5, '#0d0d26');
    bg.addColorStop(1,   '#060618');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // Glow blobs
    _scGlow(c, W, H,  220,  180, 380, 'rgba(99,102,241,0.20)');
    _scGlow(c, W, H, 1010,  490, 340, 'rgba(6,182,212,0.16)');
    _scGlow(c, W, H,  600,   90, 260, 'rgba(168,85,247,0.10)');

    // Dot grid
    c.fillStyle = 'rgba(255,255,255,0.022)';
    for (let gx = 30; gx < W; gx += 52) {
        for (let gy = 30; gy < H; gy += 52) {
            c.beginPath(); c.arc(gx, gy, 1.2, 0, Math.PI * 2); c.fill();
        }
    }

    // ── Border ──────────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(99,102,241,0.42)';
    c.lineWidth   = 2;
    _scRR(c, 1, 1, W - 2, H - 2, 14); c.stroke();

    // Top accent gradient line
    const tl = c.createLinearGradient(0, 0, W, 0);
    tl.addColorStop(0,    'rgba(99,102,241,0)');
    tl.addColorStop(0.2,  '#6366f1');
    tl.addColorStop(0.5,  '#a855f7');
    tl.addColorStop(0.8,  '#06b6d4');
    tl.addColorStop(1,    'rgba(6,182,212,0)');
    c.strokeStyle = tl; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 3); c.lineTo(W, 3); c.stroke();

    // ── Navbar-style brand header panel ─────────────────────────────────────
    // Panel gelap semi-transparan dengan tinggi seperti navbar — persis seperti
    // tampilan navbar di halaman (logo kiri, nama perusahaan, subtitle kecil)
    const PANEL_H = 88;
    const panelBg = c.createLinearGradient(0, 0, W * 0.6, 0);
    panelBg.addColorStop(0,    'rgba(10,10,30,0.96)');
    panelBg.addColorStop(0.55, 'rgba(15,15,38,0.88)');
    panelBg.addColorStop(1,    'rgba(15,15,38,0.0)');
    c.fillStyle = panelBg;
    _scRR(c, 8, 8, W - 16, PANEL_H, 10);
    c.fill();

    // Garis accent tipis di bawah panel (seperti border-bottom navbar)
    const panelLine = c.createLinearGradient(0, 0, W, 0);
    panelLine.addColorStop(0,   'rgba(99,102,241,0)');
    panelLine.addColorStop(0.15,'rgba(99,102,241,0.7)');
    panelLine.addColorStop(0.5, 'rgba(168,85,247,0.5)');
    panelLine.addColorStop(0.85,'rgba(6,182,212,0.7)');
    panelLine.addColorStop(1,   'rgba(6,182,212,0)');
    c.strokeStyle = panelLine; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(8, 8 + PANEL_H); c.lineTo(W - 8, 8 + PANEL_H); c.stroke();

    // ── Logo di dalam panel ───────────────────────────────────────────────────
    const LOGO_SIZE = 54;
    const LOGO_X    = 32;
    const LOGO_CX   = LOGO_X + LOGO_SIZE / 2;
    const LOGO_CY   = 8 + PANEL_H / 2;      // vertikal center di dalam panel
    let logoLoaded  = false;

    if (logoUrl) {
        try {
            const proxyUrl = `${_scApiBase}/api/proxy-image?url=${encodeURIComponent(logoUrl)}`;
            const img = await new Promise((resolve, reject) => {
                const im = new Image();
                im.crossOrigin = 'anonymous';
                im.onload  = () => resolve(im);
                im.onerror = reject;
                im.src = proxyUrl;
            });
            // Gambar logo langsung tanpa clip/cincin — tampil penuh apa adanya
            c.drawImage(img, LOGO_X, LOGO_CY - LOGO_SIZE / 2, LOGO_SIZE, LOGO_SIZE);
            logoLoaded = true;
        } catch { /* fallback */ }
    }

    if (!logoLoaded) {
        // Fallback: ikon petir sederhana (tanpa lingkaran background)
        c.fillStyle = 'rgba(255,255,255,0.90)';
        c.beginPath();
        const bx = LOGO_X, by = LOGO_CY - LOGO_SIZE / 2;
        c.moveTo(bx + 24, by + 2); c.lineTo(bx + 36, by + 26); c.lineTo(bx + 30, by + 26);
        c.lineTo(bx + 38, by + 52); c.lineTo(bx + 18, by + 28); c.lineTo(bx + 26, by + 28);
        c.closePath(); c.fill();
    }

    // ── Teks brand di kanan logo ─────────────────────────────────────────────
    const textX = LOGO_X + LOGO_SIZE + 20;

    // Nama perusahaan — besar & bold (contoh: "SKY TECH")
    c.textAlign = 'left';
    c.font = 'bold 36px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(brandMain, textX, LOGO_CY - 4);

    // Subtitle — nama lengkap perusahaan (contoh: "PT. SKY Base Technologhy Digital")
    c.font = '400 17px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    const brandSubDisp = brandSub.length > 55 ? brandSub.slice(0, 52) + '...' : brandSub;
    c.fillText(brandSubDisp, textX, LOGO_CY + 22);

    // ── Tanggal/waktu di kanan panel ─────────────────────────────────────────
    c.font = '500 18px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.textAlign = 'right';
    c.fillText(item.displayTs || '', W - 32, LOGO_CY - 4);
    // Label kecil di bawah tanggal
    c.font = '400 13px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(99,102,241,0.75)';
    c.fillText('Network Speed Test', W - 32, LOGO_CY + 22);
    c.textAlign = 'left';

    // Divider di bawah panel
    const PANEL_BOTTOM = 8 + PANEL_H + 12; // sedikit space sebelum konten

    // Date/time — right aligned
    c.font = '500 19px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.46)';
    c.textAlign = 'right';
    // ── Download & Upload blocks ─────────────────────────────────────────────
    const dlVal = item.download != null ? String(item.download) : '—';
    const ulVal = item.upload   != null ? String(item.upload)   : '—';

    _scSpeedBlock(c, 300, dlVal, '\u2193', 'UNDUHAN',  '#22d3ee', '#0891b2', PANEL_BOTTOM);
    _scSpeedBlock(c, 900, ulVal, '\u2191', 'UNGGAHAN', '#818cf8', '#4f46e5', PANEL_BOTTOM);

    // Vertical dashed divider between DL and UL
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    c.setLineDash([5, 8]);
    c.beginPath(); c.moveTo(W / 2, PANEL_BOTTOM); c.lineTo(W / 2, PANEL_BOTTOM + 300); c.stroke();
    c.setLineDash([]);

    // ── Ping & Jitter pills ──────────────────────────────────────────────────
    const pingVal = item.ping   != null ? String(item.ping)   : '—';
    const jitVal  = item.jitter != null ? String(item.jitter) : '—';

    const pW = 216, pH = 84, pGap = 28;
    const pStart = (W - (pW * 2 + pGap)) / 2;
    const pY = PANEL_BOTTOM + 310;

    _scPill(c, pStart,               pY, pW, pH, 'PING',   pingVal, 'ms', '#f59e0b', 'rgba(245,158,11,0.10)');
    _scPill(c, pStart + pW + pGap,   pY, pW, pH, 'JITTER', jitVal,  'ms', '#fbbf24', 'rgba(251,191,36,0.08)');

    // ── Footer ───────────────────────────────────────────────────────────────
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(56, 545); c.lineTo(W - 56, 545); c.stroke();

    // Server name — truncate if too long
    const srvRaw  = item.displayName || '—';
    const srvDisp = srvRaw.length > 58 ? srvRaw.slice(0, 55) + '...' : srvRaw;
    c.font = '500 18px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.50)';
    c.textAlign = 'left';
    c.fillText('Server: ' + srvDisp, 60, 584);

    // Branding watermark — right
    c.font = '400 15px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.textAlign = 'right';
    c.fillText('Dibuat oleh server ' + brandMain, W - 60, 584);
    c.textAlign = 'left';

    return cv;
}

// ── Canvas helper: draw speed block (Download or Upload) ────────────────────
// offsetY = posisi top area konten (setelah header panel)
function _scSpeedBlock(c, cx, value, arrow, label, colorA, colorB, offsetY = 118) {
    c.textAlign = 'center';

    // Arrow ↓ or ↑
    c.font = 'bold 54px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = colorA;
    c.fillText(arrow, cx, offsetY + 56);

    // Big speed number — gradient
    c.font = 'bold 86px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    const vg = c.createLinearGradient(cx - 220, 0, cx + 220, 0);
    vg.addColorStop(0, colorB); vg.addColorStop(1, colorA);
    c.fillStyle = vg;
    c.fillText(value, cx, offsetY + 178);

    // "Mbps" unit
    c.font = '600 26px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.42)';
    c.fillText('Mbps', cx, offsetY + 218);

    // Label (UNDUHAN / UNGGAHAN)
    c.font = '700 15px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = colorA;
    c.fillText(label, cx, offsetY + 275);

    c.textAlign = 'left';
}

// ── Canvas helper: draw Ping / Jitter pill ───────────────────────────────────
function _scPill(c, x, y, w, h, label, value, unit, color, bgColor) {
    // Pill background
    c.fillStyle = bgColor;
    _scRR(c, x, y, w, h, 12); c.fill();

    // Pill border (semi-transparent)
    c.globalAlpha = 0.38;
    c.strokeStyle = color; c.lineWidth = 1;
    _scRR(c, x, y, w, h, 12); c.stroke();
    c.globalAlpha = 1;

    const cx = x + w / 2;
    c.textAlign = 'center';

    // Label
    c.font = '700 13px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.38)';
    c.fillText(label, cx, y + 24);

    // Value + unit (combined)
    c.font = 'bold 38px system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    c.fillStyle = color;
    c.fillText(`${value} ${unit}`, cx, y + 67);

    c.textAlign = 'left';
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
function _scGlow(c, W, H, x, y, r, color) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function _scRR(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);      c.quadraticCurveTo(x + w, y,     x + w, y + r);
    c.lineTo(x + w, y + h - r);  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);      c.quadraticCurveTo(x,     y + h, x,         y + h - r);
    c.lineTo(x, y + r);          c.quadraticCurveTo(x,     y,     x + r,     y);
    c.closePath();
}
