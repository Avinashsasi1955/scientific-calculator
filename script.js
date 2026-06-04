/**
 * QuantumCalc - Premium Scientific Calculator Logic
 * Powered by math.js for ultimate precision and algebraic support.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // STATE VARIABLES
    // ==========================================================================
    let tokens = []; // Array of { display: string, math: string }
    let angleMode = localStorage.getItem('calc_angle_mode') || 'RAD'; // 'RAD' or 'DEG'
    let soundEnabled = localStorage.getItem('calc_sound_enabled') !== 'false';
    let precision = parseInt(localStorage.getItem('calc_precision')) || 12;
    let memoryValue = parseFloat(localStorage.getItem('calc_memory')) || 0;
    let isSecondMode = false;
    let calcHistory = JSON.parse(localStorage.getItem('calc_history')) || [];
    let audioCtx = null;

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    const expressionDisplay = document.getElementById('expressionDisplay');
    const livePreviewDisplay = document.getElementById('livePreviewDisplay');
    const resultDisplay = document.getElementById('resultDisplay');
    const memoryIndicator = document.getElementById('memoryIndicator');
    const modeIndicator = document.getElementById('modeIndicator');
    const btnRad = document.getElementById('btnRad');
    const btnDeg = document.getElementById('btnDeg');
    const soundToggle = document.getElementById('soundToggle');
    const historyToggle = document.getElementById('historyToggle');
    const historyDrawer = document.getElementById('historyDrawer');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const copyResultBtn = document.getElementById('copyResultBtn');
    const precisionSelect = document.getElementById('precisionSelect');
    const btnToggle2nd = document.getElementById('btnToggle2nd');
    const toast = document.getElementById('toast');

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================
    function init() {
        // Set UI State from variables
        updateAngleModeUI();
        updateSoundButtonUI();
        updateMemoryIndicator();
        precisionSelect.value = precision.toString();
        renderHistory();
        setupGlossaryHighlights();
        updateDisplay();
    }

    // ==========================================================================
    // AUDIO FEEDBACK SYSTEM (Web Audio API Synthesizer)
    // ==========================================================================
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!soundEnabled) return;
        
        try {
            initAudio();
            if (!audioCtx) return;
            
            // Resume context if suspended (browser security)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, now);
                gainNode.gain.setValueAtTime(0.08, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'operator') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                gainNode.gain.setValueAtTime(0.12, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, now);
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) {
            console.warn('Web Audio failure', e);
        }
    }

    // ==========================================================================
    // ANGLE MODE & SCOPE MANAGEMENT
    // ==========================================================================
    function updateAngleModeUI() {
        if (angleMode === 'RAD') {
            btnRad.classList.add('active');
            btnDeg.classList.remove('active');
            modeIndicator.textContent = 'RAD';
        } else {
            btnDeg.classList.add('active');
            btnRad.classList.remove('active');
            modeIndicator.textContent = 'DEG';
        }
        localStorage.setItem('calc_angle_mode', angleMode);
        updateDisplay();
    }

    function toggleAngleMode(mode) {
        if (angleMode !== mode) {
            angleMode = mode;
            playSound('click');
            updateAngleModeUI();
        }
    }

    function getEvaluationScope() {
        if (angleMode === 'DEG') {
            return {
                sin: x => math.sin(x * Math.PI / 180),
                cos: x => math.cos(x * Math.PI / 180),
                tan: x => {
                    const norm = (x % 360 + 360) % 360;
                    if (Math.abs(norm - 90) < 1e-10 || Math.abs(norm - 270) < 1e-10) {
                        throw new Error("Undefined (tan of 90°/270°)");
                    }
                    return math.tan(x * Math.PI / 180);
                },
                asin: x => math.asin(x) * 180 / Math.PI,
                acos: x => math.acos(x) * 180 / Math.PI,
                atan: x => math.atan(x) * 180 / Math.PI,
                sec: x => 1 / math.cos(x * Math.PI / 180),
                csc: x => 1 / math.sin(x * Math.PI / 180),
                cot: x => 1 / math.tan(x * Math.PI / 180),
            };
        }
        return {}; 
    }

    // ==========================================================================
    // SOUND & MEMORY CONTROLS
    // ==========================================================================
    function updateSoundButtonUI() {
        if (soundEnabled) {
            soundToggle.classList.add('active');
            soundToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            soundToggle.classList.remove('active');
            soundToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        }
        localStorage.setItem('calc_sound_enabled', soundEnabled);
    }

    function updateMemoryIndicator() {
        if (memoryValue !== 0) {
            memoryIndicator.style.visibility = 'visible';
            memoryIndicator.title = `Memory stored: ${memoryValue}`;
        } else {
            memoryIndicator.style.visibility = 'hidden';
        }
        localStorage.setItem('calc_memory', memoryValue.toString());
    }

    // ==========================================================================
    // GLOSSARY INTERACTION LINKAGE (Scans all items with data-glossary)
    // ==========================================================================
    function setupGlossaryHighlights() {
        document.querySelectorAll('[data-glossary]').forEach(el => {
            const glossId = el.getAttribute('data-glossary');
            if (!glossId) return;

            el.addEventListener('mouseenter', () => {
                const card = document.getElementById(`gloss-${glossId}`);
                if (card) {
                    card.classList.add('gloss-active');
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            el.addEventListener('mouseleave', () => {
                const card = document.getElementById(`gloss-${glossId}`);
                if (card) {
                    card.classList.remove('gloss-active');
                }
            });
        });
    }

    // ==========================================================================
    // TOKEN AND DISPLAY CONTROLS
    // ==========================================================================
    function pushToken(displayVal, mathVal) {
        const operators = ['+', '-', '*', '/', '^', ' mod '];
        const lastToken = tokens[tokens.length - 1];

        if (operators.includes(mathVal.trim()) && lastToken && operators.includes(lastToken.math.trim())) {
            tokens.pop();
        }

        tokens.push({ display: displayVal, math: mathVal });
        updateDisplay();
    }

    function popToken() {
        if (tokens.length > 0) {
            tokens.pop();
            updateDisplay();
        }
    }

    function clearAll() {
        tokens = [];
        resultDisplay.textContent = '0';
        livePreviewDisplay.textContent = '';
        updateDisplay();
    }

    function getExpressionDisplayString() {
        if (tokens.length === 0) return '0';
        return tokens.map(t => t.display).join('');
    }

    function getExpressionMathString() {
        return tokens.map(t => t.math).join('');
    }

    function updateDisplay() {
        expressionDisplay.textContent = getExpressionDisplayString();
        setTimeout(() => {
            expressionDisplay.parentElement.scrollLeft = expressionDisplay.parentElement.scrollWidth;
        }, 10);

        const mathExpr = getExpressionMathString();
        if (!mathExpr) {
            livePreviewDisplay.textContent = '';
            return;
        }

        try {
            const scope = getEvaluationScope();
            const rawResult = math.evaluate(mathExpr, scope);
            
            if (rawResult !== undefined && rawResult !== null && typeof rawResult !== 'function') {
                const formatted = formatResult(rawResult);
                livePreviewDisplay.textContent = `= ${formatted}`;
            } else {
                livePreviewDisplay.textContent = '';
            }
        } catch (e) {
            livePreviewDisplay.textContent = '';
        }
    }

    function formatResult(val) {
        if (val === undefined || val === null) return '';
        
        if (typeof val === 'object' && val.isComplex) {
            const re = formatNumber(val.re);
            const im = formatNumber(val.im);
            if (val.im === 0) return re;
            if (val.re === 0) return `${im}i`;
            return `${re} ${val.im >= 0 ? '+' : '-'} ${Math.abs(val.im)}i`;
        }

        if (Array.isArray(val)) {
            return `[${val.map(formatResult).join(', ')}]`;
        }
        if (typeof val === 'object' && val.isMatrix) {
            return `[${val.toArray().map(formatResult).join(', ')}]`;
        }

        if (typeof val === 'number') {
            return formatNumber(val);
        }

        return val.toString();
    }

    function formatNumber(num) {
        if (isNaN(num)) return 'NaN';
        if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';

        if (Number.isInteger(num) && Math.abs(num) < Math.pow(10, precision - 1)) {
            return num.toString();
        }

        let formatted = math.format(num, { precision: precision, lowerExp: -5, upperExp: 12 });

        if (formatted.includes('.') && !formatted.includes('e')) {
            formatted = formatted.replace(/\.?0+$/, '');
        }

        return formatted;
    }

    function calculate() {
        const mathExpr = getExpressionMathString();
        const displayExpr = getExpressionDisplayString();

        if (!mathExpr) {
            playSound('error');
            return;
        }

        try {
            const scope = getEvaluationScope();
            const rawResult = math.evaluate(mathExpr, scope);

            if (rawResult === undefined || typeof rawResult === 'function') {
                throw new Error("Invalid Expression");
            }

            const formatted = formatResult(rawResult);

            playSound('success');

            resultDisplay.textContent = formatted;
            livePreviewDisplay.textContent = '';

            addToHistory(displayExpr, formatted);

            tokens = [{ display: formatted, math: formatted }];
        } catch (error) {
            playSound('error');
            console.error('Calculation Error:', error);
            
            const appEl = document.getElementById('calculatorApp');
            appEl.style.boxShadow = '0 0 30px rgba(255, 55, 95, 0.4)';
            setTimeout(() => {
                appEl.style.boxShadow = '';
            }, 500);

            resultDisplay.textContent = 'Error';
            livePreviewDisplay.textContent = error.message.includes('Undefined') ? error.message : 'Invalid Syntax';
        }
    }

    // ==========================================================================
    // HISTORY SYSTEM
    // ==========================================================================
    function addToHistory(expr, result) {
        if (calcHistory.length > 0 && calcHistory[0].expression === expr && calcHistory[0].result === result) {
            return;
        }

        calcHistory.unshift({ expression: expr, result: result });
        if (calcHistory.length > 50) calcHistory.pop();
        
        localStorage.setItem('calc_history', JSON.stringify(calcHistory));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        
        if (calcHistory.length === 0) {
            historyList.innerHTML = `<div class="empty-history-msg">No calculations yet. Complete some expressions to build your history!</div>`;
            return;
        }

        calcHistory.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-expr">${item.expression}</div>
                <div class="history-card-res">${item.result}</div>
            `;
            
            card.addEventListener('click', () => {
                playSound('click');
                tokens = [{ display: item.result, math: item.result }];
                updateDisplay();
                resultDisplay.textContent = item.result;
                historyDrawer.classList.remove('open');
                historyToggle.classList.remove('active');
            });
            
            historyList.appendChild(card);
        });
    }

    // ==========================================================================
    // EVENT BINDINGS
    // ==========================================================================

    // Toggle 2nd Mode
    btnToggle2nd.addEventListener('click', () => {
        playSound('click');
        isSecondMode = !isSecondMode;
        btnToggle2nd.classList.toggle('active', isSecondMode);
        
        // Re-label scientific keys depending on the state of Shift/2nd
        document.querySelectorAll('.btn-sci').forEach(btn => {
            if (isSecondMode) {
                btn.classList.add('active-alt');
                if (btn.id === 'btnSin') btn.innerHTML = 'sin⁻¹';
                else if (btn.id === 'btnCos') btn.innerHTML = 'cos⁻¹';
                else if (btn.id === 'btnTan') btn.innerHTML = 'tan⁻¹';
                else if (btn.id === 'btnSinh') btn.innerHTML = 'sinh⁻¹';
                else if (btn.id === 'btnCosh') btn.innerHTML = 'cosh⁻¹';
                else if (btn.id === 'btnTanh') btn.innerHTML = 'tanh⁻¹';
                else if (btn.id === 'btnSqrt') btn.innerHTML = '∛';
                else if (btn.id === 'btnSquare') btn.innerHTML = 'x³';
                else if (btn.id === 'btnPower') btn.innerHTML = 'ʸ√x';
                else if (btn.id === 'btnExp') btn.innerHTML = 'eˣ';
                else if (btn.id === 'btn10x') btn.innerHTML = 'eˣ';
                else if (btn.id === 'btnInv') btn.innerHTML = 'x⁻¹';
                else if (btn.id === 'btnLn') btn.innerHTML = 'eˣ';
                else if (btn.id === 'btnLog') btn.innerHTML = '2ˣ';
                else if (btn.id === 'btnLog2') btn.innerHTML = 'ln';
                else if (btn.id === 'btnFactorial') btn.innerHTML = 'gamma';
                else if (btn.id === 'btnAbs') btn.innerHTML = 'sign';
                else if (btn.id === 'btnMod') btn.innerHTML = '%';
                else if (btn.id === 'btnPi') btn.innerHTML = '2π';
                else if (btn.id === 'btnE') btn.innerHTML = 'φ';
                else if (btn.id === 'btnPhi') btn.innerHTML = 'i';
                else if (btn.id === 'btnImaginary') btn.innerHTML = 'φ';
                else if (btn.id === 'btnRound') btn.innerHTML = 'round';
                
                // Bottom Row Scientific Additions
                else if (btn.id === 'btnGcd') btn.innerHTML = 'lcm';
                else if (btn.id === 'btnLcm') btn.innerHTML = 'gcd';
                else if (btn.id === 'btnIsPrime') btn.innerHTML = 'isPrime';
                else if (btn.id === 'btnMean') btn.innerHTML = 'median';
                else if (btn.id === 'btnStd') btn.innerHTML = 'variance';
                else if (btn.id === 'btnLogxb') btn.innerHTML = 'log₁₀';
            } else {
                btn.classList.remove('active-alt');
                if (btn.id === 'btnSin') btn.innerHTML = 'sin';
                else if (btn.id === 'btnCos') btn.innerHTML = 'cos';
                else if (btn.id === 'btnTan') btn.innerHTML = 'tan';
                else if (btn.id === 'btnSinh') btn.innerHTML = 'sinh';
                else if (btn.id === 'btnCosh') btn.innerHTML = 'cosh';
                else if (btn.id === 'btnTanh') btn.innerHTML = 'tanh';
                else if (btn.id === 'btnSqrt') btn.innerHTML = '√';
                else if (btn.id === 'btnSquare') b.innerHTML = 'x²';
                else if (btn.id === 'btnPower') btn.innerHTML = 'xʸ';
                else if (btn.id === 'btnExp') btn.innerHTML = 'EXP';
                else if (btn.id === 'btn10x') btn.innerHTML = '10ˣ';
                else if (btn.id === 'btnInv') btn.innerHTML = '1/x';
                else if (btn.id === 'btnLn') btn.innerHTML = 'ln';
                else if (btn.id === 'btnLog') btn.innerHTML = 'log';
                else if (btn.id === 'btnLog2') btn.innerHTML = 'log₂';
                else if (btn.id === 'btnFactorial') btn.innerHTML = 'x!';
                else if (btn.id === 'btnAbs') btn.innerHTML = 'abs';
                else if (btn.id === 'btnMod') btn.innerHTML = 'mod';
                else if (btn.id === 'btnPi') btn.innerHTML = 'π';
                else if (btn.id === 'btnE') btn.innerHTML = 'e';
                else if (btn.id === 'btnPhi') btn.innerHTML = 'φ';
                else if (btn.id === 'btnImaginary') btn.innerHTML = 'i';
                else if (btn.id === 'btnRound') btn.innerHTML = 'round';

                // Bottom Row Scientific Additions
                else if (btn.id === 'btnGcd') btn.innerHTML = 'gcd';
                else if (btn.id === 'btnLcm') btn.innerHTML = 'lcm';
                else if (btn.id === 'btnIsPrime') btn.innerHTML = 'isPrime';
                else if (btn.id === 'btnMean') btn.innerHTML = 'mean';
                else if (btn.id === 'btnStd') btn.innerHTML = 'std';
                else if (btn.id === 'btnLogxb') btn.innerHTML = 'log(x,b)';
            }
        });
    });

    // Handle Precision Change
    precisionSelect.addEventListener('change', (e) => {
        precision = parseInt(e.target.value);
        localStorage.setItem('calc_precision', precision.toString());
        playSound('click');
        updateDisplay();
    });

    // Sound Toggle
    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        updateSoundButtonUI();
        playSound('click');
    });

    // History Toggle
    historyToggle.addEventListener('click', () => {
        playSound('click');
        historyDrawer.classList.toggle('open');
        historyToggle.classList.toggle('active');
    });

    closeHistoryBtn.addEventListener('click', () => {
        playSound('click');
        historyDrawer.classList.remove('open');
        historyToggle.classList.remove('active');
    });

    clearHistoryBtn.addEventListener('click', () => {
        playSound('operator');
        if (confirm('Clear all calculation logs?')) {
            calcHistory = [];
            localStorage.setItem('calc_history', JSON.stringify(calcHistory));
            renderHistory();
        }
    });

    // Copy Result to Clipboard
    copyResultBtn.addEventListener('click', () => {
        const text = resultDisplay.textContent;
        if (text && text !== 'Error' && text !== '0') {
            navigator.clipboard.writeText(text).then(() => {
                playSound('success');
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 2000);
            }).catch(err => {
                console.error('Copy failure', err);
            });
        } else {
            playSound('error');
        }
    });

    // Angle Mode Selector bindings
    btnRad.addEventListener('click', () => toggleAngleMode('RAD'));
    btnDeg.addEventListener('click', () => toggleAngleMode('DEG'));

    // Standard Buttons Bindings
    document.getElementById('btnAC').addEventListener('click', () => { playSound('operator'); clearAll(); });
    document.getElementById('btnBack').addEventListener('click', () => { playSound('operator'); popToken(); });
    document.getElementById('btnEquals').addEventListener('click', calculate);

    // Number Inputs
    for (let i = 0; i <= 9; i++) {
        document.getElementById(`btn${i}`).addEventListener('click', () => {
            playSound('click');
            pushToken(i.toString(), i.toString());
        });
    }

    document.getElementById('btnDot').addEventListener('click', () => {
        playSound('click');
        pushToken('.', '.');
    });

    // Arithmetic Operators
    const opBindings = [
        { id: 'btnAdd', disp: ' + ', math: ' + ' },
        { id: 'btnSub', disp: ' − ', math: ' - ' },
        { id: 'btnMul', disp: ' × ', math: ' * ' },
        { id: 'btnDiv', disp: ' ÷ ', math: ' / ' },
        { id: 'btnOpenP', disp: '(', math: '(' },
        { id: 'btnCloseP', disp: ')', math: ')' }
    ];

    opBindings.forEach(binding => {
        document.getElementById(binding.id).addEventListener('click', () => {
            playSound('operator');
            pushToken(binding.disp, binding.math);
        });
    });

    // Memory Buttons Actions
    document.getElementById('btnMC').addEventListener('click', () => {
        playSound('operator');
        memoryValue = 0;
        updateMemoryIndicator();
    });

    document.getElementById('btnMR').addEventListener('click', () => {
        playSound('click');
        pushToken(memoryValue.toString(), memoryValue.toString());
    });

    document.getElementById('btnMPlus').addEventListener('click', () => {
        playSound('operator');
        const num = parseFloat(resultDisplay.textContent);
        if (!isNaN(num)) {
            memoryValue += num;
            updateMemoryIndicator();
        }
    });

    document.getElementById('btnMMinus').addEventListener('click', () => {
        playSound('operator');
        const num = parseFloat(resultDisplay.textContent);
        if (!isNaN(num)) {
            memoryValue -= num;
            updateMemoryIndicator();
        }
    });

    document.getElementById('btnMS').addEventListener('click', () => {
        playSound('operator');
        const num = parseFloat(resultDisplay.textContent);
        if (!isNaN(num)) {
            memoryValue = num;
            updateMemoryIndicator();
        }
    });

    // Scientific Button Event Dispatcher (Applies to all .btn-sci in right & bottom pads)
    document.querySelectorAll('.btn-sci').forEach(btn => {
        btn.addEventListener('click', () => {
            playSound('click');
            
            let val = btn.getAttribute('data-val');
            let disp = btn.innerHTML; // Take display label

            if (isSecondMode) {
                val = btn.getAttribute('data-alt');
            }

            let mathVal = val;
            let dispVal = disp;

            // Handle special conversion cases
            if (btn.id === 'btnSqrt') {
                if (isSecondMode) {
                    mathVal = 'cbrt(';
                    dispVal = '∛(';
                } else {
                    mathVal = 'sqrt(';
                    dispVal = '√(';
                }
            } else if (btn.id === 'btnSquare') {
                if (isSecondMode) {
                    mathVal = '^3';
                    dispVal = '³';
                } else {
                    mathVal = '^2';
                    dispVal = '²';
                }
            } else if (btn.id === 'btnPower') {
                if (isSecondMode) {
                    mathVal = 'nthRoot(';
                    dispVal = 'ʸ√(';
                } else {
                    mathVal = '^';
                    dispVal = '^';
                }
            } else if (btn.id === 'btnExp') {
                if (isSecondMode) {
                    mathVal = 'exp(';
                    dispVal = 'exp(';
                } else {
                    mathVal = '*10^';
                    dispVal = 'E';
                }
            } else if (btn.id === 'btn10x') {
                if (isSecondMode) {
                    mathVal = 'exp(';
                    dispVal = 'e^(';
                } else {
                    mathVal = '10^';
                    dispVal = '10^(';
                }
            } else if (btn.id === 'btnInv') {
                if (isSecondMode) {
                    mathVal = '^-1';
                    dispVal = '⁻¹';
                } else {
                    mathVal = '1/';
                    dispVal = '1/';
                }
            } else if (btn.id === 'btnLn') {
                if (isSecondMode) {
                    mathVal = 'exp(';
                    dispVal = 'e^(';
                } else {
                    mathVal = 'log('; 
                    dispVal = 'ln(';
                }
            } else if (btn.id === 'btnLog') {
                if (isSecondMode) {
                    mathVal = '2^';
                    dispVal = '2^(';
                } else {
                    mathVal = 'log10(';
                    dispVal = 'log(';
                }
            } else if (btn.id === 'btnLog2') {
                if (isSecondMode) {
                    mathVal = 'log(';
                    dispVal = 'ln(';
                } else {
                    mathVal = 'log2(';
                    dispVal = 'log₂(';
                }
            } else if (btn.id === 'btnFactorial') {
                if (isSecondMode) {
                    mathVal = 'gamma(';
                    dispVal = 'gamma(';
                } else {
                    mathVal = '!';
                    dispVal = '!';
                }
            } else if (btn.id === 'btnAbs') {
                if (isSecondMode) {
                    mathVal = 'sign(';
                    dispVal = 'sign(';
                } else {
                    mathVal = 'abs(';
                    dispVal = 'abs(';
                }
            } else if (btn.id === 'btnMod') {
                if (isSecondMode) {
                    mathVal = '%';
                    dispVal = '%';
                } else {
                    mathVal = ' mod ';
                    dispVal = ' mod ';
                }
            } else if (btn.id === 'btnPi') {
                if (isSecondMode) {
                    mathVal = '2*pi';
                    dispVal = '2π';
                } else {
                    mathVal = 'pi';
                    dispVal = 'π';
                }
            } else if (btn.id === 'btnE') {
                if (isSecondMode) {
                    mathVal = 'phi';
                    dispVal = 'φ';
                } else {
                    mathVal = 'e';
                    dispVal = 'e';
                }
            } else if (btn.id === 'btnPhi') {
                if (isSecondMode) {
                    mathVal = 'i';
                    dispVal = 'i';
                } else {
                    mathVal = 'phi';
                    dispVal = 'φ';
                }
            } else if (btn.id === 'btnImaginary') {
                if (isSecondMode) {
                    mathVal = 'phi';
                    dispVal = 'φ';
                } else {
                    mathVal = 'i';
                    dispVal = 'i';
                }
            } else if (btn.id === 'btnNcr') {
                if (isSecondMode) {
                    mathVal = 'permutations(';
                    dispVal = 'nPr(';
                } else {
                    mathVal = 'combinations(';
                    dispVal = 'nCr(';
                }
            } else if (btn.id === 'btnNpr') {
                if (isSecondMode) {
                    mathVal = 'combinations(';
                    dispVal = 'nCr(';
                } else {
                    mathVal = 'permutations(';
                    dispVal = 'nPr(';
                }
            } else if (btn.id === 'btnPercent') {
                if (isSecondMode) {
                    mathVal = '*0.01';
                    dispVal = '%';
                } else {
                    mathVal = '%';
                    dispVal = '%';
                }
            } else if (btn.id === 'btnRand') {
                if (isSecondMode) {
                    mathVal = 'randomInt(1, 100)';
                    dispVal = 'randInt(1,100)';
                } else {
                    mathVal = 'random()';
                    dispVal = 'rand';
                }
            } else if (btn.id === 'btnFloor') {
                if (isSecondMode) {
                    mathVal = 'ceil(';
                    dispVal = 'ceil(';
                } else {
                    mathVal = 'floor(';
                    dispVal = 'floor(';
                }
            } else if (btn.id === 'btnCeil') {
                if (isSecondMode) {
                    mathVal = 'floor(';
                    dispVal = 'floor(';
                } else {
                    mathVal = 'ceil(';
                    dispVal = 'ceil(';
                }
            } else if (btn.id === 'btnMin') {
                if (isSecondMode) {
                    mathVal = 'max(';
                    dispVal = 'max(';
                } else {
                    mathVal = 'min(';
                    dispVal = 'min(';
                }
            } else if (btn.id === 'btnMax') {
                if (isSecondMode) {
                    mathVal = 'min(';
                    dispVal = 'min(';
                } else {
                    mathVal = 'max(';
                    dispVal = 'max(';
                }
            } 
            
            // Bottom Row Scientific Additions
            else if (btn.id === 'btnGcd') {
                if (isSecondMode) {
                    mathVal = 'lcm(';
                    dispVal = 'lcm(';
                } else {
                    mathVal = 'gcd(';
                    dispVal = 'gcd(';
                }
            } else if (btn.id === 'btnLcm') {
                if (isSecondMode) {
                    mathVal = 'gcd(';
                    dispVal = 'gcd(';
                } else {
                    mathVal = 'lcm(';
                    dispVal = 'lcm(';
                }
            } else if (btn.id === 'btnIsPrime') {
                mathVal = 'isPrime(';
                dispVal = 'isPrime(';
            } else if (btn.id === 'btnMean') {
                if (isSecondMode) {
                    mathVal = 'median(';
                    dispVal = 'median(';
                } else {
                    mathVal = 'mean(';
                    dispVal = 'mean(';
                }
            } else if (btn.id === 'btnStd') {
                if (isSecondMode) {
                    mathVal = 'std('; // math.js uses std
                    dispVal = 'std(';
                } else {
                    mathVal = 'std(';
                    dispVal = 'std(';
                }
            } else if (btn.id === 'btnLogxb') {
                if (isSecondMode) {
                    mathVal = 'log10(';
                    dispVal = 'log(';
                } else {
                    mathVal = 'log('; // custom base takes (x, b)
                    dispVal = 'log(';
                }
            } else {
                if (isSecondMode) {
                    mathVal = btn.getAttribute('data-alt');
                    dispVal = dispVal.replace('⁻¹', '(');
                    if (!dispVal.endsWith('(')) dispVal += '(';
                } else {
                    mathVal = btn.getAttribute('data-val');
                    if (!dispVal.endsWith('(')) dispVal += '(';
                }
            }

            pushToken(dispVal, mathVal);

            // Auto-disable second mode after single action
            if (isSecondMode) {
                isSecondMode = false;
                btnToggle2nd.classList.remove('active');
                document.querySelectorAll('.btn-sci').forEach(b => {
                    b.classList.remove('active-alt');
                    const bId = b.id;
                    if (bId === 'btnSin') b.innerHTML = 'sin';
                    else if (bId === 'btnCos') b.innerHTML = 'cos';
                    else if (bId === 'btnTan') b.innerHTML = 'tan';
                    else if (bId === 'btnSinh') b.innerHTML = 'sinh';
                    else if (bId === 'btnCosh') b.innerHTML = 'cosh';
                    else if (bId === 'btnTanh') b.innerHTML = 'tanh';
                    else if (bId === 'btnSqrt') b.innerHTML = '√';
                    else if (bId === 'btnSquare') b.innerHTML = 'x²';
                    else if (bId === 'btnPower') b.innerHTML = 'xʸ';
                    else if (bId === 'btnExp') b.innerHTML = 'EXP';
                    else if (bId === 'btn10x') b.innerHTML = '10ˣ';
                    else if (bId === 'btnInv') b.innerHTML = '1/x';
                    else if (bId === 'btnLn') b.innerHTML = 'ln';
                    else if (bId === 'btnLog') b.innerHTML = 'log';
                    else if (bId === 'btnLog2') b.innerHTML = 'log₂';
                    else if (bId === 'btnFactorial') b.innerHTML = 'x!';
                    else if (bId === 'btnAbs') b.innerHTML = 'abs';
                    else if (bId === 'btnMod') b.innerHTML = 'mod';
                    else if (bId === 'btnPi') b.innerHTML = 'π';
                    else if (bId === 'btnE') b.innerHTML = 'e';
                    else if (bId === 'btnPhi') b.innerHTML = 'φ';
                    else if (bId === 'btnImaginary') b.innerHTML = 'i';
                    else if (bId === 'btnRound') b.innerHTML = 'round';

                    else if (bId === 'btnGcd') b.innerHTML = 'gcd';
                    else if (bId === 'btnLcm') b.innerHTML = 'lcm';
                    else if (bId === 'btnIsPrime') b.innerHTML = 'isPrime';
                    else if (bId === 'btnMean') b.innerHTML = 'mean';
                    else if (bId === 'btnStd') b.innerHTML = 'std';
                    else if (bId === 'btnLogxb') b.innerHTML = 'log(x,b)';
                });
            }
        });
    });

    // ==========================================================================
    // PHYSICAL KEYBOARD LISTENERS
    // ==========================================================================
    window.addEventListener('keydown', (e) => {
        if (['/', '*', '-', '+', 'Enter', 'Backspace', 'Escape'].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key >= '0' && e.key <= '9') {
            playSound('click');
            pushToken(e.key, e.key);
        }
        else if (e.key === '+') {
            playSound('operator');
            pushToken(' + ', ' + ');
        }
        else if (e.key === '-') {
            playSound('operator');
            pushToken(' − ', ' - ');
        }
        else if (e.key === '*') {
            playSound('operator');
            pushToken(' × ', ' * ');
        }
        else if (e.key === '/') {
            playSound('operator');
            pushToken(' ÷ ', ' / ');
        }
        else if (e.key === '.') {
            playSound('click');
            pushToken('.', '.');
        }
        else if (e.key === '(') {
            playSound('operator');
            pushToken('(', '(');
        }
        else if (e.key === ')') {
            playSound('operator');
            pushToken(')', ')');
        }
        else if (e.key === '^') {
            playSound('operator');
            pushToken('^', '^');
        }
        else if (e.key === '%') {
            playSound('operator');
            pushToken('%', '%');
        }
        else if (e.key === 'Enter' || e.key === '=') {
            calculate();
        }
        else if (e.key === 'Backspace') {
            playSound('operator');
            popToken();
        }
        else if (e.key === 'Escape') {
            playSound('operator');
            clearAll();
        }
        else if (!historyDrawer.classList.contains('open')) {
            const keyLower = e.key.toLowerCase();
            if (keyLower === 's') {
                playSound('click');
                pushToken('sin(', 'sin(');
            } else if (keyLower === 'c') {
                playSound('click');
                pushToken('cos(', 'cos(');
            } else if (keyLower === 't') {
                playSound('click');
                pushToken('tan(', 'tan(');
            } else if (keyLower === 'l') {
                playSound('click');
                pushToken('ln(', 'log(');
            } else if (keyLower === 'p') {
                playSound('click');
                pushToken('π', 'pi');
            } else if (keyLower === 'e') {
                playSound('click');
                pushToken('e', 'e');
            } else if (keyLower === 'i') {
                playSound('click');
                pushToken('i', 'i');
            }
        }
    });

    init();
});
