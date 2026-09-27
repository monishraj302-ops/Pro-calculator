/**
 * Modern Precision Calculator - Core Engine & Interactive UI
 */

class Calculator {
    constructor(previousOperandEl, currentOperandEl, operatorBadgeEl, onHistoryChange = null) {
        this.previousOperandEl = previousOperandEl;
        this.currentOperandEl = currentOperandEl;
        this.operatorBadgeEl = operatorBadgeEl;
        this.onHistoryChange = onHistoryChange;
        
        // Sound setup using Web Audio API
        try {
            this.soundEnabled = localStorage.getItem('calc_sound') !== 'false';
        } catch (e) {
            this.soundEnabled = true;
        }
        this.audioCtx = null;
        
        try {
            const savedHistory = JSON.parse(localStorage.getItem('calc_history') || '[]');
            this.history = Array.isArray(savedHistory) ? savedHistory : [];
        } catch (e) {
            this.history = [];
        }
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.shouldResetScreen = false;
        this.lastOperand = null;
        this.lastOperation = null;
        this.hasError = false;
        this.updateDisplay();
    }

    delete() {
        if (this.hasError) {
            this.clear();
            return;
        }

        if (this.shouldResetScreen) {
            this.currentOperand = '0';
            this.shouldResetScreen = false;
            this.updateDisplay();
            return;
        }

        if (this.currentOperand === '-0' || this.currentOperand.length === 1 || (this.currentOperand.length === 2 && this.currentOperand.startsWith('-'))) {
            this.currentOperand = '0';
        } else {
            this.currentOperand = this.currentOperand.slice(0, -1);
        }
        this.updateDisplay();
    }

    appendNumber(number) {
        if (this.hasError) {
            this.clear();
        }

        if (this.shouldResetScreen) {
            this.currentOperand = '';
            this.shouldResetScreen = false;
        }

        if (this.currentOperand === '-0') {
            this.currentOperand = number === '.' ? '-0.' : '-' + number;
            this.updateDisplay();
            return;
        }

        if (number === '.' && this.currentOperand.includes('.')) return;
        if (number === '.' && (this.currentOperand === '' || this.currentOperand === '0')) {
            this.currentOperand = '0.';
            this.updateDisplay();
            return;
        }

        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number.toString();
        } else {
            // Limit digit entry length to avoid overflow
            if (this.currentOperand.replace(/[^0-9]/g, '').length >= 15) return;
            this.currentOperand += number.toString();
        }

        this.lastOperand = null;
        this.lastOperation = null;
        this.updateDisplay();
    }

    chooseOperation(operation) {
        if (this.hasError) {
            this.clear();
        }

        if (this.currentOperand === '' && this.previousOperand === '') return;

        if (this.operation && !this.shouldResetScreen) {
            this.compute();
        }

        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.shouldResetScreen = true;
        this.lastOperand = null;
        this.lastOperation = null;
        this.updateDisplay();
    }

    toggleSign() {
        if (this.hasError) return;

        if (this.shouldResetScreen) {
            this.currentOperand = '-0';
            this.shouldResetScreen = false;
            this.updateDisplay();
            return;
        }

        if (this.currentOperand === '0') return;

        if (this.currentOperand.startsWith('-')) {
            this.currentOperand = this.currentOperand.slice(1);
        } else {
            this.currentOperand = '-' + this.currentOperand;
        }
        this.updateDisplay();
    }

    applyPercentage() {
        if (this.hasError || this.currentOperand === '') return;

        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;

        let result;
        // If in middle of an addition or subtraction, percentage is relative to previous operand
        if (this.previousOperand && (this.operation === '+' || this.operation === '−')) {
            const prev = parseFloat(this.previousOperand);
            result = (prev * current) / 100;
        } else {
            result = current / 100;
        }

        this.currentOperand = this.formatNumberResult(result);
        this.shouldResetScreen = false;
        this.updateDisplay();
    }

    compute() {
        let computation;
        let prev = parseFloat(this.previousOperand);
        let current = parseFloat(this.currentOperand);

        // Repeated equals support
        if (isNaN(prev) && this.lastOperation && this.lastOperand !== null) {
            prev = current;
            current = this.lastOperand;
            this.operation = this.lastOperation;
        } else if (isNaN(prev) || isNaN(current)) {
            return;
        }

        const op = this.operation;

        switch (op) {
            case '+':
                computation = prev + current;
                break;
            case '−':
            case '-':
                computation = prev - current;
                break;
            case '×':
            case '*':
                computation = prev * current;
                break;
            case '÷':
            case '/':
                if (current === 0) {
                    this.hasError = true;
                    this.currentOperand = 'Cannot divide by 0';
                    this.previousOperand = '';
                    this.operation = undefined;
                    this.updateDisplay();
                    return;
                }
                computation = prev / current;
                break;
            default:
                return;
        }

        const formattedResult = this.formatNumberResult(computation);
        const equationString = `${this.formatDisplayNumber(prev)} ${op} ${this.formatDisplayNumber(current)}`;

        // Save into history
        this.saveHistory(equationString, formattedResult);

        this.lastOperand = current;
        this.lastOperation = op;
        this.currentOperand = formattedResult;
        this.operation = undefined;
        this.previousOperand = '';
        this.shouldResetScreen = true;
        this.updateDisplay();
    }

    formatNumberResult(num) {
        if (isNaN(num)) return 'Error';
        if (!isFinite(num)) return 'Overflow';

        // Precision cleanup for JS floating point quirks (e.g. 0.1 + 0.2 = 0.30000000000000004)
        const rounded = Number(Math.round(num + 'e12') + 'e-12');

        // If scientific notation is appropriate for extremely large or tiny numbers
        if (Math.abs(rounded) >= 1e14 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-6)) {
            return rounded.toExponential(6);
        }

        return rounded.toString();
    }

    formatDisplayNumber(numberStr) {
        if (numberStr === '' || numberStr === null || numberStr === undefined) return '';
        if (numberStr === 'Cannot divide by 0' || numberStr === 'Error' || numberStr === 'Overflow') {
            return numberStr;
        }

        const stringNumber = numberStr.toString();
        if (stringNumber.includes('e')) return stringNumber;

        const parts = stringNumber.split('.');
        const integerDigits = parseFloat(parts[0]);
        const decimalDigits = parts[1];

        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = stringNumber.startsWith('-') ? '-' : '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en-US');
        }

        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        if (this.hasError) {
            this.currentOperandEl.textContent = this.currentOperand;
            this.previousOperandEl.textContent = '';
            this.operatorBadgeEl.classList.add('hidden');
            this.adjustFontSize();
            this.highlightActiveOperator();
            return;
        }

        this.currentOperandEl.textContent = this.formatDisplayNumber(this.currentOperand);

        if (this.operation != null) {
            this.previousOperandEl.textContent = `${this.formatDisplayNumber(this.previousOperand)} ${this.operation}`;
            this.operatorBadgeEl.textContent = this.operation;
            this.operatorBadgeEl.classList.remove('hidden');
        } else {
            this.previousOperandEl.textContent = '';
            this.operatorBadgeEl.classList.add('hidden');
        }

        this.adjustFontSize();
        this.highlightActiveOperator();
    }

    adjustFontSize() {
        const len = this.currentOperandEl.textContent.length;
        if (len > 14) {
            this.currentOperandEl.style.fontSize = '24px';
        } else if (len > 10) {
            this.currentOperandEl.style.fontSize = '30px';
        } else if (len > 7) {
            this.currentOperandEl.style.fontSize = '36px';
        } else {
            this.currentOperandEl.style.fontSize = '';
        }
    }

    highlightActiveOperator() {
        document.querySelectorAll('.btn-operator').forEach(btn => {
            if (this.operation && (btn.getAttribute('data-operator') === this.operation)) {
                btn.classList.add('active-operator');
            } else {
                btn.classList.remove('active-operator');
            }
        });
    }

    playClickSound() {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.04);

            gainNode.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);

            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.04);
        } catch (e) {
            // Audio error gracefully ignored
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('calc_sound', this.soundEnabled);
        return this.soundEnabled;
    }

    saveHistory(equation, result) {
        const item = { equation, result, timestamp: Date.now() };
        this.history.unshift(item);
        if (this.history.length > 30) {
            this.history.pop();
        }
        localStorage.setItem('calc_history', JSON.stringify(this.history));
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange(this.history);
        }
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('calc_history');
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange(this.history);
        }
    }

    loadHistoryItem(item) {
        this.clear();
        this.currentOperand = item.result.replace(/,/g, '');
        this.previousOperandEl.textContent = item.equation + ' =';
        this.updateDisplay();
    }
}

// Global UI and Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const previousOperandEl = document.getElementById('previousOperand');
    const currentOperandEl = document.getElementById('currentOperand');
    const operatorBadgeEl = document.getElementById('operatorBadge');
    const displayArea = document.getElementById('displayArea');
    const copyToast = document.getElementById('copyToast');

    const historyPanel = document.getElementById('historyPanel');
    const historyToggleBtn = document.getElementById('historyToggleBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyList = document.getElementById('historyList');

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const sunIcon = themeToggleBtn.querySelector('.icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.icon-moon');

    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const soundOnIcon = soundToggleBtn.querySelector('.icon-sound-on');
    const soundOffIcon = soundToggleBtn.querySelector('.icon-sound-off');

    // Helper: HTML sanitization for safe rendering
    const escapeHtml = (str) => {
        return String(str ?? '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Helper: History Drawer Controls
    const openHistory = () => {
        historyPanel.classList.add('open');
        historyPanel.setAttribute('aria-hidden', 'false');
    };

    const closeHistory = () => {
        historyPanel.classList.remove('open');
        historyPanel.setAttribute('aria-hidden', 'true');
    };

    const renderHistoryList = (history) => {
        if (!history || history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
            return;
        }

        historyList.innerHTML = '';
        history.forEach((item) => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-equation">${escapeHtml(item.equation)} =</div>
                <div class="history-result">${escapeHtml(item.result)}</div>
            `;
            el.addEventListener('click', () => {
                calculator.loadHistoryItem(item);
                closeHistory();
                calculator.playClickSound();
            });
            historyList.appendChild(el);
        });
    };

    // Helper: Theme handling
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('calc_theme', theme);
        } catch (e) {}

        if (theme === 'light') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    };

    // Helper: Sound icon update
    const updateSoundIcons = (isEnabled) => {
        if (isEnabled) {
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
        } else {
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
        }
    };

    // Helper: Copy feedback toast
    let toastTimeout = null;
    const showCopyToast = () => {
        copyToast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            copyToast.classList.remove('show');
        }, 1500);
    };

    const copyToClipboard = (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(showCopyToast)
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text) => {
        try {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showCopyToast();
        } catch (e) {
            // Copy failed silently
        }
    };

    // Helper: Visual feedback for keyboard presses
    const simulateKeyPress = (key) => {
        const btn = document.querySelector(`[data-key="${key}"]`);
        if (btn) {
            btn.classList.add('keyboard-active');
            setTimeout(() => btn.classList.remove('keyboard-active'), 120);
        }
    };

    // Instantiate Calculator Core
    const calculator = new Calculator(
        previousOperandEl,
        currentOperandEl,
        operatorBadgeEl,
        (hist) => renderHistoryList(hist)
    );

    // Initial State Setup
    window.renderHistoryList = renderHistoryList;
    renderHistoryList(calculator.history);

    const savedTheme = localStorage.getItem('calc_theme') || 'dark';
    applyTheme(savedTheme);
    updateSoundIcons(calculator.soundEnabled);

    // Number Buttons
    document.querySelectorAll('[data-number]').forEach(button => {
        button.addEventListener('click', () => {
            calculator.appendNumber(button.getAttribute('data-number'));
            calculator.playClickSound();
        });
    });

    // Operator Buttons
    document.querySelectorAll('[data-operator]').forEach(button => {
        button.addEventListener('click', () => {
            calculator.chooseOperation(button.getAttribute('data-operator'));
            calculator.playClickSound();
        });
    });

    // Action Buttons
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            if (action === 'clear') calculator.clear();
            if (action === 'delete') calculator.delete();
            if (action === 'calculate') calculator.compute();
            if (action === 'negate') calculator.toggleSign();
            if (action === 'percent') calculator.applyPercentage();
            calculator.playClickSound();
        });
    });

    // Keyboard support
    window.addEventListener('keydown', (e) => {
        let key = e.key;

        if ((key >= '0' && key <= '9') || key === '.') {
            e.preventDefault();
            calculator.appendNumber(key);
            calculator.playClickSound();
            simulateKeyPress(key);
        } else if (key === '+' || key === '-') {
            e.preventDefault();
            const op = key === '-' ? '−' : '+';
            calculator.chooseOperation(op);
            calculator.playClickSound();
            simulateKeyPress(key);
        } else if (key === '*') {
            e.preventDefault();
            calculator.chooseOperation('×');
            calculator.playClickSound();
            simulateKeyPress('*');
        } else if (key === '/') {
            e.preventDefault();
            calculator.chooseOperation('÷');
            calculator.playClickSound();
            simulateKeyPress('/');
        } else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            calculator.compute();
            calculator.playClickSound();
            simulateKeyPress('Enter');
        } else if (key === 'Backspace') {
            e.preventDefault();
            calculator.delete();
            calculator.playClickSound();
            simulateKeyPress('Backspace');
        } else if (key === 'Escape') {
            e.preventDefault();
            if (historyPanel.classList.contains('open')) {
                closeHistory();
            } else {
                calculator.clear();
            }
            calculator.playClickSound();
            simulateKeyPress('Escape');
        } else if (key === '%') {
            e.preventDefault();
            calculator.applyPercentage();
            calculator.playClickSound();
            simulateKeyPress('%');
        }
    });

    // Display Click to Copy
    displayArea.addEventListener('click', () => {
        const valToCopy = currentOperandEl.textContent;
        if (!valToCopy || valToCopy === 'Cannot divide by 0' || valToCopy === 'Error' || valToCopy === 'Overflow') return;
        copyToClipboard(valToCopy);
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        calculator.playClickSound();
    });

    // Sound Toggle
    soundToggleBtn.addEventListener('click', () => {
        const newState = calculator.toggleSound();
        updateSoundIcons(newState);
        if (newState) calculator.playClickSound();
    });

    // History Panel Controls
    historyToggleBtn.addEventListener('click', () => {
        if (historyPanel.classList.contains('open')) {
            closeHistory();
        } else {
            openHistory();
        }
        calculator.playClickSound();
    });

    closeHistoryBtn.addEventListener('click', () => {
        closeHistory();
        calculator.playClickSound();
    });

    clearHistoryBtn.addEventListener('click', () => {
        calculator.clearHistory();
        calculator.playClickSound();
    });

    // Close history if clicking outside the panel
    document.addEventListener('click', (e) => {
        if (
            historyPanel.classList.contains('open') &&
            !historyPanel.contains(e.target) &&
            !historyToggleBtn.contains(e.target)
        ) {
            closeHistory();
        }
    });
});


