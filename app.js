const form = document.getElementById("walletForm");
const input = document.getElementById("tronAddress");
const status = document.getElementById("statusMsg");
const clearBtn = document.getElementById("clearBtn");

// Минимальный баланс для Eligibility.
// Поменяй только это число, если нужен другой порог.
const MIN_TRX = 100;

// Публичный TRON FullNode endpoint.
// API-ключ не нужен. Мы только читаем баланс и ничего не подписываем/не отправляем.
const TRON_NODE = "https://api.trongrid.io/wallet/getaccount";

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status" + (type ? ` ${type}` : "");
}

function isValidTronAddress(address) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function formatTrx(sun) {
  return (Number(sun) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

input.addEventListener("input", () => {
  input.value = input.value.replace(/\s+/g, "");
  if (status.textContent) setStatus("");
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  setStatus("");
  input.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const address = input.value.trim();

  if (!address) {
    setStatus("Введите публичный TRON-адрес.", "error");
    input.focus();
    return;
  }

  if (!isValidTronAddress(address)) {
    setStatus("Некорректный адрес. TRC-20 адрес должен начинаться с T.", "error");
    input.focus();
    return;
  }

  const checkBtn = document.getElementById("checkBtn");
  const oldText = checkBtn.innerHTML;

  checkBtn.disabled = true;
  checkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Проверяем...';
  setStatus("Получаем актуальный баланс из сети TRON...");

  try {
    const response = await fetch(TRON_NODE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        address,
        visible: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const account = await response.json();

    // Если аккаунт не создан / нет balance, TRON возвращает объект без balance.
    const sun = Number(account.balance || 0);
    const trx = sun / 1_000_000;

    if (trx >= MIN_TRX) {
      setStatus(
        `✓ Eligibility подтвержден. Баланс: ${formatTrx(sun)} TRX. Минимум: ${MIN_TRX} TRX.`,
        "success"
      );
    } else {
      setStatus(
        `Баланс: ${formatTrx(sun)} TRX. Для Eligibility требуется минимум ${MIN_TRX} TRX.`,
        "error"
      );
    }
  } catch (error) {
    console.error("TRON balance check:", error);
    setStatus(
      "Не удалось получить баланс. Проверьте адрес или повторите попытку через несколько секунд.",
      "error"
    );
  } finally {
    checkBtn.disabled = false;
    checkBtn.innerHTML = oldText;
  }
});

// Soft reveal on scroll.
const revealItems = document.querySelectorAll(
  ".stat-card, .feature-card, .road-step, .eco-card, .airdrop-card, .tokenomics"
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
