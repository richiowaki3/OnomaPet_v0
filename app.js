// app.js - OnomaPet Seismograph Application Main Controller

let engine;
let seismograph;
let mesh3d;
let gallery;
let lastTimestamp = 0;

function initApp() {
    console.log("[App] Initializing OnomaPet Seismograph Visualizer...");

    // 1. Initialize Engine, Seismograph, 3D Mesh, and 10-Variation Gallery
    const dictData = typeof ONOMA_DICT !== 'undefined' ? ONOMA_DICT : [];
    engine = new OnomaPetEngine({
        dictionaryData: dictData,
        nodeCount: 1,
        historyDuration: 15.0
    });

    const canvas = document.getElementById('seismograph-canvas');
    seismograph = new SeismographRenderer(canvas, {
        theme: 'dark',
        windowSeconds: 8.0
    });

    mesh3d = new NodeMesh3DRenderer('mesh3d-canvas');
    gallery = new TenVariationsGallery('ten-variations-grid');

    // 2. Setup UI Elements
    initUI();

    // 3. Select default initial word
    const defaultWord = dictData.find(item => item.word === 'がたがた') || dictData[0] || { word: 'がたがた' };
    selectWord(defaultWord);

    // 4. Start Render Loop
    requestAnimationFrame(renderLoop);
}

function initUI() {
    const list = document.getElementById('onomato-list');
    const scrollSelect = document.getElementById('scroll-word-select');
    const input = document.getElementById('onomato-input');
    const btnExecute = document.getElementById('btn-execute');
    const btnClear = document.getElementById('btn-clear');
    const btnRandom = document.getElementById('btn-random');
    const btnSound = document.getElementById('btn-sound');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const selectTheme = document.getElementById('select-theme');
    const selectWindow = document.getElementById('select-window');

    const dictData = engine.dictionary.dictionary;

    // Populate Datalist & Scroll Select
    dictData.forEach(item => {
        // Datalist option
        const opt = document.createElement('option');
        opt.value = item.word;
        list.appendChild(opt);

        // Scroll select option
        const selectOpt = document.createElement('option');
        selectOpt.value = item.word;
        selectOpt.textContent = item.word;
        scrollSelect.appendChild(selectOpt);
    });

    // Audio context lazy activation & unlock on ANY user interaction
    const initAudio = () => {
        if (engine && engine.synth) {
            engine.synth.init();
        }
    };

    // Unlock AudioContext on first user click or key anywhere on page
    ['click', 'pointerdown', 'keydown'].forEach(evtType => {
        window.addEventListener(evtType, initAudio, { once: false });
    });

    // Trigger word selection
    const triggerExecute = () => {
        initAudio();
        const query = input.value.trim();
        if (!query) return;

        const wordData = engine.setWord(query);
        if (wordData) {
            updateUIParameters(wordData);
            scrollSelect.value = wordData.word || '';
        }
    };

    // Scroll select change event
    scrollSelect.addEventListener('change', () => {
        initAudio();
        const selected = scrollSelect.value;
        if (selected) {
            input.value = selected;
            const wordData = engine.setWord(selected);
            if (wordData) updateUIParameters(wordData);
        }
    });

    btnExecute.addEventListener('click', triggerExecute);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') triggerExecute();
    });

    // Clear
    btnClear.addEventListener('click', () => {
        initAudio();
        input.value = '';
        scrollSelect.value = '';
        engine.clearHistory();
    });

    // Random
    btnRandom.addEventListener('click', () => {
        initAudio();
        if (dictData.length > 0) {
            const randomIndex = Math.floor(Math.random() * dictData.length);
            const randomItem = dictData[randomIndex];
            input.value = randomItem.word;
            scrollSelect.value = randomItem.word;
            selectWord(randomItem);
        }
    });

    // Sound Toggle
    btnSound.addEventListener('click', () => {
        initAudio();
        const isMuted = !engine.synth.isEnabled;
        engine.synth.setMuted(!isMuted);
        if (engine.synth.isEnabled) {
            btnSound.classList.add('active');
            btnSound.textContent = 'SOUND ON';
        } else {
            btnSound.classList.remove('active');
            btnSound.textContent = 'SOUND OFF';
        }
    });

    // Test Audio Button
    const btnTestAudio = document.getElementById('btn-test-audio');
    if (btnTestAudio) {
        btnTestAudio.addEventListener('click', () => {
            initAudio();
            if (engine && engine.synth) {
                engine.synth.init();
                const word = engine.getActiveWord() || { word: 'がたがた', effort: { weight: 6, time: 6 }, acoustic: { hardness: 5, decay: 5, freq_hz: 220 } };
                engine.synth.playNote(0, 1, word);
            }
        });
    }

    // Tempo BPM Slider
    const sliderBpm = document.getElementById('slider-bpm');
    const badgeBpm = document.getElementById('badge-bpm');
    if (sliderBpm) {
        sliderBpm.addEventListener('input', () => {
            const bpmVal = parseInt(sliderBpm.value, 10);
            if (badgeBpm) badgeBpm.textContent = `${bpmVal} BPM`;
            if (engine) engine.setBpm(bpmVal);
        });
    }

    // Play/Pause
    btnPlayPause.addEventListener('click', () => {
        engine.isPlaying = !engine.isPlaying;
        btnPlayPause.textContent = engine.isPlaying ? 'PAUSE' : 'PLAY';
    });

    // Theme select
    selectTheme.addEventListener('change', () => {
        seismograph.setTheme(selectTheme.value);
    });

    // Window select
    selectWindow.addEventListener('change', () => {
        seismograph.windowSeconds = parseFloat(selectWindow.value) || 8.0;
    });
}

function selectWord(wordData) {
    const input = document.getElementById('onomato-input');
    const scrollSelect = document.getElementById('scroll-word-select');

    input.value = wordData.word;
    scrollSelect.value = wordData.word || '';

    const processed = engine.setWord(wordData);
    if (processed) {
        updateUIParameters(processed);
    }
}

function updateUIParameters(word) {
    const infoWord = document.getElementById('info-word');
    if (infoWord) infoWord.textContent = word.word;

    const infoIpa = document.getElementById('info-ipa');
    if (infoIpa) infoIpa.textContent = `[${word.ipa_clean || word.ipa_original || ''}]`;

    const infoRationale = document.getElementById('info-rationale');
    if (infoRationale) infoRationale.textContent = word.rationale || '登録オノマトペベクトル';

    const colorBadge = document.getElementById('color-badge');
    if (colorBadge && word.extended) {
        colorBadge.style.backgroundColor = word.extended.color_hex || '#6366f1';
    }

    // Update Source-Filter Taxonomy badges
    if (word.taxonomy) {
        const taxCenter = document.getElementById('tax-center');
        if (taxCenter) taxCenter.textContent = word.taxonomy.articulatoryCenter || 'CENTRAL';

        const taxSource = document.getElementById('tax-source');
        if (taxSource) taxSource.textContent = word.taxonomy.sourceType || 'VOICED';

        const taxImpulse = document.getElementById('tax-impulse');
        if (taxImpulse) taxImpulse.textContent = word.taxonomy.impulseType || 'WAVE';
    }

    // Update TEMPO slider & badge from Phonetic Impression
    const sliderBpm = document.getElementById('slider-bpm');
    const badgeBpm = document.getElementById('badge-bpm');
    if (word.estimatedBpm && sliderBpm) {
        sliderBpm.value = word.estimatedBpm;
        if (badgeBpm) badgeBpm.textContent = `${word.estimatedBpm} BPM`;
    }

    // Effort badges
    updateBadge('x1', word.effort ? word.effort.weight : 5);
    updateBadge('x2', word.effort ? word.effort.time : 5);
    updateBadge('x3', word.effort ? word.effort.space : 5);
    updateBadge('x4', word.effort ? word.effort.flow : 5);

    // Acoustic badges
    updateBadge('x5', word.acoustic ? word.acoustic.hardness : 5);
    updateBadge('x9', word.extended ? word.extended.reynolds_norm : 5);
    updateBadge('x8', word.acoustic ? word.acoustic.decay : 5);
}

function updateBadge(id, val) {
    const valEl = document.getElementById(`val-${id}`);
    if (valEl) valEl.textContent = val;

    const fillEl = document.getElementById(`fill-${id}`);
    if (fillEl) {
        const pct = Math.min(Math.max((val / 9) * 100, 0), 100);
        fillEl.style.width = `${pct}%`;
    }
}

function renderLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    if (engine) {
        engine.update(dt);
        const buffer = engine.getTimelineBuffer();
        const currentTime = engine.physics.animationTime;
        const activeWord = engine.getActiveWord();

        if (seismograph) {
            seismograph.render(buffer, currentTime, activeWord);
        }

        if (mesh3d) {
            mesh3d.render(engine.physics, activeWord);
        }

        if (gallery) {
            gallery.render(currentTime, activeWord);
        }
    }

    requestAnimationFrame(renderLoop);
}

window.addEventListener('DOMContentLoaded', () => {
    initApp();
});
