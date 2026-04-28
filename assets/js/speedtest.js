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
    
    // Show alert dengan detail
    setTimeout(() => {
        alert(`${message}\n\n${suggestion}`);
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
    for (let w = 0; w < 3; w++) {
        try {
            const wr = await fetchWithTimeout(`${currentServer}/ping`, {
                method: 'GET',
                cache: 'no-store'
            }, CONFIG.PING_TIMEOUT);
            await wr.text();
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

    for (let i = 0; i < CONFIG.PING_COUNT; i++) {
        const controller = new AbortController();
        abortControllers.push(controller);

        const progress = 10 + Math.round(i * (15 / CONFIG.PING_COUNT));
        updateProgress(progress, `Ping ${i + 1}/${CONFIG.PING_COUNT}...`);

        const t0 = performance.now();

        try {
            const resp = await fetchWithTimeout(`${currentServer}/ping`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            }, CONFIG.PING_TIMEOUT);

            if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
            await resp.text();

            const rtt = parseFloat((performance.now() - t0).toFixed(1));
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
                const resp = await fetch(`${currentServer}/download?duration=3`, {
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
                        `${currentServer}/download?duration=${CONFIG.DOWNLOAD_DURATION}`,
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
                        `${currentServer}/upload`,
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
                return `<div class="shi">
                    <div class="shi-header">
                        <div class="shi-hdr-server">
                            <span class="shi-hdr-lbl">Server</span>
                            <span class="shi-hdr-name">${srvName}</span>
                            ${userBadge}
                        </div>
                        <div class="shi-hdr-time">
                            <span class="shi-hdr-lbl">Tanggal / Waktu</span>
                            <span class="shi-hdr-ts">${ts}</span>
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
            return `<div class="shi">
                <div class="shi-header">
                    <div class="shi-hdr-server">
                        <span class="shi-hdr-lbl">Server</span>
                        <span class="shi-hdr-name">${srvName}</span>
                    </div>
                    <div class="shi-hdr-time">
                        <span class="shi-hdr-lbl">Tanggal / Waktu</span>
                        <span class="shi-hdr-ts">${ts}</span>
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
