const connectBtn = document.getElementById('connectBtn');
const walletForm = document.getElementById('walletForm');
const tronInput = document.getElementById('tronAddress');
const checkBtn = document.getElementById('checkBtn');
const statusMsg = document.getElementById('statusMsg');
const nextStep = document.getElementById('nextStep');

// Публичные эндпоинты (НЕ требуют API-ключа)
const TRONGRID_API = 'https://api.trongrid.io';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd';
const USDT_CONTRACT = 'TR7NhqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const MIN_USD = 20;

// Показать форму при клике на "Подключить кошелек"
connectBtn.addEventListener('click', () => {
    walletForm.classList.remove('hidden');
    connectBtn.classList.add('hidden');
    tronInput.focus();
});

// Валидация TRON-адреса
function isValidTron(addr) {
    return /^T[a-zA-Z0-9]{33}$/.test(addr);
}

// Обновление статуса
function setStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status ' + type;
}

// Переход к следующему шагу
function goToNextStep() {
    nextStep.classList.remove('hidden');
    walletForm.classList.add('hidden');
    nextStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Получение баланса TRX (в SUN → TRX)
async function getTrxBalance(address) {
    const res = await fetch(`${TRONGRID_API}/v1/accounts/${address}`);
    if (!res.ok) throw new Error('TRX fetch failed');
    const data = await res.json();
    const account = data.data && data.data[0];
    if (!account || !account.balance) return 0;
    return account.balance / 1_000_000; // SUN → TRX
}

// Получение баланса USDT TRC-20
async function getUsdtBalance(address) {
    const hexAddr = address.substring(1).toLowerCase().padStart(64, '0');
    const res = await fetch(`${TRONGRID_API}/wallet/triggersmartcontract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contract_address: USDT_CONTRACT,
            function_selector: 'balanceOf(address)',
            parameter: hexAddr,
            owner_address: address
        })
    });
    if (!res.ok) return 0;
    const data = await res.json();
    if (!data.constant_result || !data.constant_result[0]) return 0;
    const raw = parseInt(data.constant_result[0], 16);
    return raw / 1_000_000; // USDT has 6 decimals
}

// Получение цены TRX/USD
async function getTrxPrice() {
    const res = await fetch(COINGECKO_API);
    if (!res.ok) throw new Error('Price fetch failed');
    const data = await res.json();
    if (!data.tron || !data.tron.usd) throw new Error('Invalid price data');
    return data.tron.usd;
}

// Основная проверка
async function checkWallet() {
    const addr = tronInput.value.trim();

    if (!addr) { setStatus('Введите адрес кошелька', 'error'); return; }
    if (!isValidTron(addr)) { setStatus('Некорректный TRON-адрес', 'error'); return; }

    checkBtn.disabled = true;
    setStatus('Проверяем...', 'loading');

    try {
        const [trxBal, usdtBal, trxPrice] = await Promise.all([
            getTrxBalance(addr),
            getUsdtBalance(addr),
            getTrxPrice()
        ]);

        const totalUsd = (trxBal * trxPrice) + usdtBal;

        if (totalUsd >= MIN_USD) {
            setStatus('✓ Проверка пройдена', 'success');
            setTimeout(goToNextStep, 1200);
        } else {
            setStatus('Недостаточный баланс', 'error');
            checkBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        setStatus('Не удалось проверить кошелёк. Попробуйте ещё раз.', 'error');
        checkBtn.disabled = false;
    }
}

checkBtn.addEventListener('click', checkWallet);
tronInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkWallet(); });
