// Frankfurter API (avaimeton)
const API_BASE = "https://api.frankfurter.dev/v1";

// Tunnista kieli <html lang="...">
const LANG = (document.documentElement.lang || "fi").toLowerCase();

// Kielikohtaiset tekstit
const I18N = {
  fi: {
    loadingCurrencies: "Ladataan valuuttoja...",
    loadError: "Valuuttojen lataus epäonnistui.",
    invalidAmount: "Anna kelvollinen positiivinen summa.",
    selectBoth: "Valitse molemmat valuutat.",
    sameCurrency: "Sama valuutta molemmissa.",
    fetchingRate: "Haetaan kurssia...",
    rateError: "Kurssin haku epäonnistui.",
    formatRateLine(from, to, rate, date) {
      return `1 ${from} = ${rate.toFixed(6)} ${to} • Päivä: ${date}`;
    },
  },
  en: {
    loadingCurrencies: "Loading currencies...",
    loadError: "Failed to load currencies.",
    invalidAmount: "Please enter a valid positive amount.",
    selectBoth: "Please select both currencies.",
    sameCurrency: "Same currency selected.",
    fetchingRate: "Fetching rate...",
    rateError: "Failed to fetch exchange rate.",
    formatRateLine(from, to, rate, date) {
      return `1 ${from} = ${rate.toFixed(6)} ${to} • Date: ${date}`;
    },
  },
  sv: {
    loadingCurrencies: "Laddar valutor...",
    loadError: "Det gick inte att ladda valutor.",
    invalidAmount: "Ange ett giltigt positivt belopp.",
    selectBoth: "Välj båda valutorna.",
    sameCurrency: "Samma valuta vald.",
    fetchingRate: "Hämtar växelkurs...",
    rateError: "Det gick inte att hämta växelkursen.",
    formatRateLine(from, to, rate, date) {
      return `1 ${from} = ${rate.toFixed(6)} ${to} • Datum: ${date}`;
    },
  },
};

const T = I18N[LANG] || I18N.fi;

// Suomeksi haettavat nimet / synonyymit (toimivat myös muilla kielillä haun lisänä)
const FI_CURRENCY_NAMES = {
  SEK: ["ruotsin kruunu", "ruotsi kruunu", "ruotsin raha", "kruunu"],
  NOK: ["norjan kruunu", "norja kruunu", "kruunu"],
  DKK: ["tanskan kruunu", "tanska kruunu", "kruunu"],
  ISK: ["islannin kruunu", "islanti kruunu", "kruunu"],

  USD: ["yhdysvaltain dollari", "us dollari", "usa dollari", "dollari"],
  EUR: ["euro", "eurot"],
  GBP: ["englannin punta", "britti punta", "punta"],
  CHF: ["sveitsin frangi", "frangi"],
  JPY: ["japanin jeni", "jeni"],
  CNY: ["kiinan juan", "juan", "yuan"],
  AUD: ["australian dollari"],
  CAD: ["kanadan dollari"],
};

const amountInput = document.getElementById("amount");
const swapButton = document.getElementById("swap-button");
const convertButton = document.getElementById("convert-button");
const statusText = document.getElementById("status-text");
const errorText = document.getElementById("error-text");
const resultMain = document.getElementById("result-main");
const resultRate = document.getElementById("result-rate");

const currencyFields = document.querySelectorAll(
  '[data-role="currency-field"]'
);

let currencies = {}; // { "EUR": "Euro", ... }
let currentFrom = "EUR";
let currentTo = "USD";

// Ääkkös-normalisointi
function normalize(str) {
  return str
    .toLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .trim();
}

// Lataa valuutat
async function loadCurrencies() {
  try {
    if (statusText) statusText.textContent = T.loadingCurrencies;
    const res = await fetch(`${API_BASE}/currencies`);
    if (!res.ok) throw new Error("Virhe latauksessa");
    currencies = await res.json();

    initCurrencyFields();
    if (statusText) statusText.textContent = "";
    convert(); // eka laskenta
  } catch (err) {
    console.error(err);
    if (errorText) errorText.textContent = T.loadError;
    if (statusText) statusText.textContent = "";
  }
}

// Rakentaa yhden dropdownin listan
function buildCurrencyList(fieldEl) {
  const type = fieldEl.dataset.type; // "from" tai "to"
  const dropdown = fieldEl.querySelector(".currency-dropdown");
  const listEl = dropdown.querySelector(".currency-list");
  const searchInput = dropdown.querySelector(".currency-search");
  const searchTerm = normalize(searchInput.value || "");

  // Tyhjennä lista
  listEl.innerHTML = "";

  const codes = Object.keys(currencies).sort();

  for (const code of codes) {
    const enName = currencies[code];

    let matchText = `${code} ${enName}`.toLowerCase();

    if (FI_CURRENCY_NAMES[code]) {
      matchText += " " + FI_CURRENCY_NAMES[code].join(" ").toLowerCase();
    }

    matchText = normalize(matchText);

    // Hakusuodatus: jos ei osumaa, skippaa
    if (searchTerm && !matchText.includes(searchTerm)) continue;

    const optionBtn = document.createElement("button");
    optionBtn.type = "button";
    optionBtn.className = "currency-option";
    optionBtn.dataset.code = code;

    const codeSpan = document.createElement("span");
    codeSpan.className = "currency-option-code";
    codeSpan.textContent = code;

    const nameSpan = document.createElement("span");
    nameSpan.className = "currency-option-name";
    nameSpan.textContent = enName;

    optionBtn.appendChild(codeSpan);
    optionBtn.appendChild(nameSpan);

    if (FI_CURRENCY_NAMES[code]) {
      const fiSpan = document.createElement("span");
      fiSpan.className = "currency-option-fi";
      fiSpan.textContent = FI_CURRENCY_NAMES[code][0];
      optionBtn.appendChild(fiSpan);
    }

    optionBtn.addEventListener("click", () => {
      setCurrency(type, code);
      closeDropdown(fieldEl);
      convert();
    });

    listEl.appendChild(optionBtn);
  }
}

// Avaa dropdown
function openDropdown(fieldEl) {
  const dropdown = fieldEl.querySelector(".currency-dropdown");
  const toggle = fieldEl.querySelector(".currency-toggle");
  const searchInput = dropdown.querySelector(".currency-search");

  currencyFields.forEach((field) => {
    if (field !== fieldEl) closeDropdown(field);
  });

  dropdown.hidden = false;
  toggle.setAttribute("aria-expanded", "true");

  searchInput.value = "";
  buildCurrencyList(fieldEl);
  searchInput.focus();
}

// Sulje dropdown
function closeDropdown(fieldEl) {
  const dropdown = fieldEl.querySelector(".currency-dropdown");
  const toggle = fieldEl.querySelector(".currency-toggle");
  dropdown.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
}

// Aseta valuutta
function setCurrency(type, code) {
  const name = currencies[code] || code;

  if (type === "from") {
    currentFrom = code;
  } else {
    currentTo = code;
  }

  const codeSpan = document.querySelector(
    `.currency-toggle-code[data-current-code="${type}"]`
  );
  const nameSpan = document.querySelector(
    `.currency-toggle-name[data-current-name="${type}"]`
  );

  if (codeSpan) codeSpan.textContent = code;
  if (nameSpan) nameSpan.textContent = name;
}

// Alusta kaikki valuuttakentät
function initCurrencyFields() {
  currencyFields.forEach((fieldEl) => {
    const type = fieldEl.dataset.type; // from/to
    const toggle = fieldEl.querySelector(".currency-toggle");
    const dropdown = fieldEl.querySelector(".currency-dropdown");
    const searchInput = dropdown.querySelector(".currency-search");

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeDropdown(fieldEl);
      } else {
        openDropdown(fieldEl);
      }
    });

    searchInput.addEventListener("input", () => {
      buildCurrencyList(fieldEl);
    });

    if (type === "from") {
      setCurrency("from", "EUR");
    } else {
      setCurrency("to", "USD");
    }
  });

  // Sulje kun klikataan ulkopuolelle
  document.addEventListener("click", (event) => {
    let inside = false;
    currencyFields.forEach((fieldEl) => {
      if (fieldEl.contains(event.target)) inside = true;
    });
    if (!inside) {
      currencyFields.forEach((fieldEl) => closeDropdown(fieldEl));
    }
  });
}

// Muunnos
async function convert() {
  if (!amountInput) return; // jos ollaan info/privacy-sivulla

  if (errorText) errorText.textContent = "";
  if (statusText) statusText.textContent = "";

  const raw = (amountInput.value || "").toString().replace(",", ".");
  const amount = parseFloat(raw);

  if (isNaN(amount) || amount < 0) {
    if (errorText) errorText.textContent = T.invalidAmount;
    if (resultMain) resultMain.textContent = "–";
    if (resultRate) resultRate.textContent = "";
    return;
  }

  if (!currentFrom || !currentTo) {
    if (errorText) errorText.textContent = T.selectBoth;
    return;
  }

  if (currentFrom === currentTo) {
    if (resultMain) {
      resultMain.textContent =
        `${amount.toFixed(2)} ${currentFrom} = ${amount.toFixed(
          2
        )} ${currentTo}`;
    }
    if (resultRate) {
      resultRate.textContent = T.sameCurrency;
    }
    return;
  }

  try {
    if (statusText) statusText.textContent = T.fetchingRate;
    const res = await fetch(
      `${API_BASE}/latest?base=${currentFrom}&symbols=${currentTo}`
    );
    if (!res.ok) throw new Error("Virhe kurssin haussa");
    const data = await res.json();

    const rate = data.rates[currentTo];
    if (!rate) throw new Error("Kurssia ei löytynyt.");

    const converted = amount * rate;

    if (resultMain) {
      resultMain.textContent =
        `${amount.toFixed(2)} ${currentFrom} = ${converted.toFixed(
          2
        )} ${currentTo}`;
    }
    if (resultRate) {
      resultRate.textContent = T.formatRateLine(
        currentFrom,
        currentTo,
        rate,
        data.date
      );
    }
    if (statusText) statusText.textContent = "";
  } catch (err) {
    console.error(err);
    if (errorText) errorText.textContent = T.rateError;
    if (statusText) statusText.textContent = "";
  }
}

// Vaihda suunnat
function swapCurrencies() {
  const oldFrom = currentFrom;
  currentFrom = currentTo;
  currentTo = oldFrom;

  setCurrency("from", currentFrom);
  setCurrency("to", currentTo);
  convert();
}

// Tapahtumat
if (swapButton) {
  swapButton.addEventListener("click", swapCurrencies);
}

if (convertButton) {
  convertButton.addEventListener("click", convert);
}

if (amountInput) {
  amountInput.addEventListener("input", () => {
    convert();
  });
}

// Käynnistys vain laskurisivuilla
if (amountInput) {
  loadCurrencies();
}
