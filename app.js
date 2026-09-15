const form = document.getElementById("walletForm");
const input = document.getElementById("tronAddress");
const status = document.getElementById("statusMsg");
const clearBtn = document.getElementById("clearBtn");
const connectBtn = document.getElementById("connectBtn");
const walletState = document.getElementById("walletState");
const checkBtn = document.getElementById("checkBtn");

// ===== AIRDROP SETTINGS =====
const MIN_USDT = 20;
const USDT_DECIMALS = 6;
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRON_NODE = "https://api.trongrid.io";

// Official USDT on TRON uses the TRC-20 balanceOf(address) method.
// The query is read-only: it does not sign or broadcast a transaction.

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status" + (type ? ` ${type}` : "");
}

function isValidTronAddress(address) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function formatUsdt(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function shorten(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-6)}` : "";
}

function base58ToHex(address) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;

  for (const char of address) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error("Invalid Base58 address");
    num = num * 58n + BigInt(index);
  }

  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;

  let leadingZeros = 0;
  for (const char of address) {
    if (char !== "1") break;
    leadingZeros++;
  }

  hex = "00".repeat(leadingZeros) + hex;
  const bytes = hex.match(/.{2}/g) || [];

  // TRON Base58Check address = 21-byte payload + 4-byte checksum.
  if (bytes.length !== 25) throw new Error("Invalid TRON address length");
  if (bytes[0].toLowerCase() !== "41") throw new Error("Not a TRON mainnet address");

  return bytes.slice(0, 21).join("");
}

async function getUsdtBalance(address) {
  const hexAddress = base58ToHex(address);
  const parameter = hexAddress.slice(2).padStart(64, "0");

  const response = await fetch(`${TRON_NODE}/wallet/triggerconstantcontract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner_address: address,
      contract_address: USDT_CONTRACT,
      function_selector: "balanceOf(address)",
      parameter,
      visible: true
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  if (!data.constant_result || !data.constant_result[0]) {
    throw new Error("USDT balance response is empty");
  }

  const raw = BigInt("0x" + data.constant_result[0]);
  return Number(raw) / 10 ** USDT_DECIMALS;
}

function setConnected(address) {
  input.value = address;
  walletState.hidden = false;
  walletState.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <span><strong>Кошелек подключен</strong><small>${shorten(address)}</small></span>
  `;
  connectBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Кошелек подключен';
  connectBtn.classList.add("connected");
}

async function findTronLinkProvider() {
  if (window.tron?.isTronLink) return window.tron;

  return new Promise((resolve) => {
    let found = null;
    const handler = (event) => {
      if (event.detail?.info?.name === "TronLink") {
        found = event.detail.provider;
      }
    };

    window.addEventListener("TIP6963:announceProvider", handler);
    window.dispatchEvent(new Event("TIP6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("TIP6963:announceProvider", handler);
      resolve(found || window.tron || null);
    }, 500);
  });
}

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  const oldText = connectBtn.innerHTML;
  connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Подключаем...';
  setStatus("Ожидаем подтверждение подключения кошелька...");

  try {
    const provider = await findTronLinkProvider();

    if (!provider) {
      setStatus("TronLink не найден. Установите TronLink или вставьте TRON-адрес вручную ниже.", "error");
      return;
    }

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0];

    if (!address || !isValidTronAddress(address)) {
      throw new Error("TRON address was not returned");
    }

    setConnected(address);
    setStatus("Кошелек подключен. Теперь можно пройти проверку участия.", "success");

    // Immediately perform the read-only eligibility check.
    await checkEligibility(address);
  } catch (error) {
    console.error("Wallet connection:", error);
    if (error?.code === 4001) {
      setStatus("Подключение отменено в кошельке.", "error");
    } else {
      setStatus("Не удалось подключить кошелек. Можно вставить адрес вручную.", "error");
    }
  } finally {
    connectBtn.disabled = false;
    if (!connectBtn.classList.contains("connected")) connectBtn.innerHTML = oldText;
  }
});

input.addEventListener("input", () => {
  input.value = input.value.replace(/\s+/g, "");
  walletState.hidden = true;
  connectBtn.classList.remove("connected");
  connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Подключить кошелек';
  if (status.textContent) setStatus("");
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  walletState.hidden = true;
  connectBtn.classList.remove("connected");
  connectBtn.innerHTML = '<i class="fa-solid fa-wallet"></i> Подключить кошелек';
  setStatus("");
  input.focus();
});

async function checkEligibility(address) {
  if (!isValidTronAddress(address)) {
    setStatus("Некорректный TRON-адрес. Адрес должен начинаться с T.", "error");
    return false;
  }

  const oldText = checkBtn.innerHTML;
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверяем USDT...';
  setStatus("Читаем баланс официального USDT TRC-20 из сети TRON...");

  try {
    const usdt = await getUsdtBalance(address);

    if (usdt >= MIN_USDT) {
      setStatus(
        `✓ Вы соответствуете условию проверки. Баланс: ${formatUsdt(usdt)} USDT. Минимум: ${MIN_USDT} USDT. Ожидайте Airdrop.`,
        "success"
      );
      return true;
    }

    setStatus(
      `Баланс: ${formatUsdt(usdt)} USDT. Для участия требуется минимум ${MIN_USDT} USDT в сети TRC-20.`,
      "error"
    );
    return false;
  } catch (error) {
    console.error("USDT TRC-20 balance check:", error);
    setStatus("Не удалось получить USDT-баланс. Проверьте адрес и повторите попытку.", "error");
    return false;
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML = oldText;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await checkEligibility(input.value.trim());
});

// Soft reveal on scroll.
const revealItems = document.querySelectorAll(
  ".stat-card, .feature-card, .drop-card, .road-step, .eco-card, .airdrop-card, .tokenomics, .drop-warning"
);

if ("IntersectionObserver" in window) {
  revealItems.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    el.style.transition = "opacity .6s ease, transform .6s ease";
  });

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealItems.forEach((el) => observer.observe(el));
}
