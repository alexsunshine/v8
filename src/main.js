let audioContext, analyser, source, gainNode;
const visualizerCanvas = document.getElementById('visualizer');
const visualizerCtx = visualizerCanvas.getContext('2d');
const paintingCanvas = document.getElementById('painting');
const paintingCtx = paintingCanvas.getContext('2d');
const paintingContainer = document.getElementById('paintingContainer');
let paintingWidth = 0;
let paintingHeight = 0;
const colorWidth = 2;
const colorHeight = 2;
const maxWidth = 600;
let isRecording = false;
let currentColor = [0, 0, 0];
let targetColor = [0, 0, 0];
const transitionSpeed = 0.1;

let timeSignature = 4;
let tempo = 120;
let metronome;
let countdownInterval;
let beatCount = 0;
let measureCount = 0;

function startAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            startAnalysis();
            document.getElementById('startRecordingButton').disabled = false;
        })
        .catch(err => {
            console.error('Error al acceder al micrófono:', err);
            alert('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
        });
}

function startAnalysis() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        targetColor = getColorFromFrequencies(dataArray);
        currentColor = interpolateColor(currentColor, targetColor, transitionSpeed);

        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        visualizerCtx.clearRect(0, 0, width, height);

        visualizerCtx.fillStyle = `rgb(${currentColor.map(Math.round).join(',')})`;
        visualizerCtx.fillRect(0, 0, width, height);

        if (isRecording) {
            addColorToPainting(currentColor);
        }
    }

    draw();
}

function interpolateColor(color1, color2, factor) {
    return color1.map((c, i) => c + (color2[i] - c) * factor);
}

function getColorFromFrequencies(frequencies) {
    const totalAmplitude = frequencies.reduce((sum, amp) => sum + amp, 0);
    if (totalAmplitude === 0) return [0, 0, 0];

    let maxAmplitude = 0;
    let dominantFrequency = 0;

    for (let i = 0; i < frequencies.length; i++) {
        const amplitude = frequencies[i];
        if (amplitude > maxAmplitude) {
            maxAmplitude = amplitude;
            dominantFrequency = i * audioContext.sampleRate / (2 * frequencies.length);
        }
    }

    const wavelength = 1 / dominantFrequency * 343;
    const visibleWavelength = mapSoundToVisibleSpectrum(wavelength);
    let [r, g, b] = wavelengthToRGB(visibleWavelength);

    const intensity = maxAmplitude / 255;
    return [
        r * intensity,
        g * intensity,
        b * intensity
    ];
}

function mapSoundToVisibleSpectrum(wavelength) {
    const minSound = 0.017;
    const maxSound = 17;
    const minVisible = 380;
    const maxVisible = 780;
    return (wavelength - minSound) / (maxSound - minSound) * (maxVisible - minVisible) + minVisible;
}

function wavelengthToRGB(wavelength) {
    let r, g, b;
    if (wavelength >= 380 && wavelength < 440) {
        r = (440 - wavelength) / (440 - 380);
        g = 0;
        b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
        r = 0;
        g = (wavelength - 440) / (490 - 440);
        b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
        r = 0;
        g = 1;
        b = (510 - wavelength) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        r = (wavelength - 510) / (580 - 510);
        g = 1;
        b = 0;
    } else if (wavelength >= 580 && wavelength < 645) {
        r = 1;
        g = (645 - wavelength) / (645 - 580);
        b = 0;
    } else if (wavelength >= 645 && wavelength <= 780) {
        r = 1;
        g = 0;
        b = 0;
    } else {
        r = 0;
        g = 0;
        b = 0;
    }

    let factor;
    if (wavelength >= 380 && wavelength < 420) {
        factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    } else if (wavelength >= 420 && wavelength < 701) {
        factor = 1;
    } else if (wavelength >= 701 && wavelength <= 780) {
        factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
    } else {
        factor = 0;
    }

    return [
        r * factor * 255,
        g * factor * 255,
        b * factor * 255
    ];
}

function addColorToPainting(color) {
    const x = (paintingWidth % maxWidth) + (beatCount * colorWidth);
    const y = Math.floor(paintingWidth / maxWidth) * (colorHeight * timeSignature);

    if (x === 0 && y + (colorHeight * timeSignature) > paintingCanvas.height) {
        const newHeight = paintingCanvas.height + 300;
        const imageData = paintingCtx.getImageData(0, 0, paintingCanvas.width, paintingCanvas.height);
        paintingCanvas.height = newHeight;
        paintingCtx.putImageData(imageData, 0, 0);
    }

    paintingCtx.fillStyle = `rgb(${color.map(Math.round).join(',')})`;
    paintingCtx.fillRect(x, y, colorWidth, colorHeight * timeSignature);

    beatCount++;
    if (beatCount >= timeSignature) {
        beatCount = 0;
        paintingWidth += maxWidth;
    }

    const containerHeight = paintingContainer.clientHeight;
    const scrollMax = Math.max(0, paintingCanvas.height - containerHeight);
    paintingContainer.scrollTop = scrollMax;
}

function clearPainting() {
    paintingWidth = 0;
    paintingHeight = 0;
    beatCount = 0;
    measureCount = 0;
    paintingCanvas.width = maxWidth;
    paintingCanvas.height = 300;
    paintingCtx.clearRect(0, 0, paintingCanvas.width, paintingCanvas.height);
    document.getElementById('saveButton').disabled = true;
}

function startRecording() {
    isRecording = false;
    document.getElementById('startRecordingButton').disabled = true;
    document.getElementById('stopRecordingButton').disabled = true;
    
    const countdownElement = document.getElementById('countdown');
    countdownElement.classList.remove('hidden');
    
    let countdown = 4;
    countdownElement.textContent = countdown;
    
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownElement.textContent = countdown;
        } else {
            clearInterval(countdownInterval);
            countdownElement.classList.add('hidden');
            isRecording = true;
            document.getElementById('stopRecordingButton').disabled = false;
            startMetronome();
        }
    }, 1000);
}

function stopRecording() {
    isRecording = false;
    stopCountdown();
    document.getElementById('startRecordingButton').disabled = false;
    document.getElementById('stopRecordingButton').disabled = true;
    document.getElementById('saveButton').disabled = false;
    stopMetronome();
}

function savePaintingAsJPG() {
    const link = document.createElement('a');
    link.download = 'audio_painting.jpg';
    link.href = paintingCanvas.toDataURL('image/jpeg');
    link.click();
}

function startMetronome() {
    if (metronome) {
        clearInterval(metronome);
    }
    
    const interval = 60000 / tempo;
    metronome = setInterval(() => {
        const oscillator = audioContext.createOscillator();
        oscillator.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
        beatCount++;
        if (beatCount >= timeSignature) {
            beatCount = 0;
            measureCount++;
        }
    }, interval);
}

function stopMetronome() {
    if (metronome) {
        clearInterval(metronome);
        metronome = null;
    }
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        document.getElementById('countdown').classList.add('hidden');
        document.getElementById('startRecordingButton').disabled = false;
        document.getElementById('stopRecordingButton').disabled = true;
    }
}

document.getElementById('startButton').addEventListener('click', startAudio);
document.getElementById('clearButton').addEventListener('click', clearPainting);
document.getElementById('startRecordingButton').addEventListener('click', startRecording);
document.getElementById('stopRecordingButton').addEventListener('click', stopRecording);
document.getElementById('saveButton').addEventListener('click', savePaintingAsJPG);
document.getElementById('metronomeButton').addEventListener('click', () => {
    if (metronome) {
        stopMetronome();
        document.getElementById('metronomeButton').textContent = 'Iniciar Metrónomo';
    } else {
        startMetronome();
        document.getElementById('metronomeButton').textContent = 'Detener Metrónomo';
    }
});

document.getElementById('timeSignature').addEventListener('change', (e) => {
    timeSignature = parseInt(e.target.value.split('/')[0]);
});

document.getElementById('tempo').addEventListener('change', (e) => {
    tempo = parseInt(e.target.value);
    if (metronome) {
        stopMetronome();
        startMetronome();
    }
});

document.getElementById('importButton').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target.result;
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            gainNode = audioContext.createGain();
            gainNode.gain.value = 1;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser);
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            document.getElementById('playButton').disabled = false;
            document.getElementById('startRecordingButton').disabled = false;
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
});

document.getElementById('playButton').addEventListener('click', () => {
    if (source && source.buffer) {
        source.start(0);
        startAnalysis();
    }
});

function resizeCanvas() {
    visualizerCanvas.width = visualizerCanvas.clientWidth;
    visualizerCanvas.height = visualizerCanvas.clientHeight;
    if (paintingWidth === 0) {
        paintingCanvas.width = maxWidth;
        paintingCanvas.height = 300;
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

