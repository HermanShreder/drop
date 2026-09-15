const connectBtn = document.getElementById('connectBtn');
const walletForm = document.getElementById('walletForm');
const tronInput = document.getElementById('tronAddress');
const checkBtn = document.getElementById('checkBtn');
const statusMsg = document.getElementById('statusMsg');
const nextStep = document.getElementById('nextStep');

// Public APIs (No Key Required)
const TRONGRID_API = 'https://api.trongrid.io';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd';
const USDT_CONTRACT = 'TR7NhqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const MIN_USD = 20; // Порог проверки

// Show form
connectBtn.addEventListener('click', () => {
    walletForm.classList.remove('hidden');
    connectBtn.classList.add('hidden');
    tronInput.focus();
});

// Validation
function isValidTron(addr) {
    return /^T[a-zA-Z0-9]{33}$/.test(addr);
}

// Status Helper
function setStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status ' + type;
}

// Next Step Logic
function goToNextStep() {
    nextStep.classList.remove('hidden');
    walletForm.classList.add('hidden');
    nextStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Fetch TRX Balance
async function getTrxBalance(address) {
    const res = await fetch(`${TRONGRID_API}/v1/accounts/${address}`);
    if (!res.ok) throw new Error('TRX fetch failed');
    const data = await res.json();
    const account = data.data && data.data[0];
    if (!account || !account.balance) return 0;
    return account.balance / 1_000_000;
}

// Fetch USDT Balance
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
    return raw / 1_000_000;
}

// Fetch Price
async function getTrxPrice() {
    const res = await fetch(COINGECKO_API);
    if (!res.ok) throw new Error('Price fetch failed');
    const data = await res.json();
    if (!data.tron || !data.tron.usd) throw new Error('Invalid price data');
    return data.tron.usd;
}

// Main Check Function
async function checkWallet() {
    const addr = tronInput.value.trim();

    if (!addr) { setStatus('Введите адрес кошелька', 'error'); return; }
    if (!isValidTron(addr)) { setStatus('Некорректный TRON-адрес', 'error'); return; }

    checkBtn.disabled = true;
    setStatus('<i class="fa-solid fa-spinner fa-spin"></i> Проверяем блокчейн...', 'loading');

    try {
        const [trxBal, usdtBal, trxPrice] = await Promise.all([
            getTrxBalance(addr),
            getUsdtBalance(addr),
            getTrxPrice()
        ]);

        const totalUsd = (trxBal * trxPrice) + usdtBal;
        console.log(`Check: ${addr} | Total: $${totalUsd.toFixed(2)}`);

        if (totalUsd >= MIN_USD) {
            setStatus('<i class="fa-solid fa-check-circle"></i> Проверка пройдена', 'success');
            setTimeout(goToNextStep, 1500);
        } else {
            setStatus(`<i class="fa-solid fa-circle-xmark"></i> Баланс <$${MIN_USD} (Текущий: $${totalUsd.toFixed(2)})`, 'error');
            checkBtn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        setStatus('Ошибка сети. Попробуйте позже.', 'error');
        checkBtn.disabled = false;
    }
}

checkBtn.addEventListener('click', checkWallet);
tronInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkWallet(); });
