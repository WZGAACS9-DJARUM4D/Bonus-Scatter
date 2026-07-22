const EMPTY_OUTPUT = '<p class="empty-output">Menunggu data ditempel...</p>';

let mahjongParsedData = [];
let mahjongSlotMode = false;

function showMainContent() {
  const initialView = document.getElementById('initialView');
  const mainContent = document.getElementById('mainContent');

  initialView.classList.add('hidden');
  setTimeout(() => {
    initialView.style.display = 'none';
    mainContent.classList.add('visible');
  }, 500);
}

function switchFormula(type) {
  const tabSlot = document.getElementById('tabSlot');
  const tabMahjong = document.getElementById('tabMahjong');
  const secSlot = document.getElementById('sectionSlot');
  const secMahjong = document.getElementById('sectionMahjong');

  resetSlot();
  resetMahjong();

  if (type === 'slot') {
    tabSlot.classList.add('active');
    tabMahjong.classList.remove('active');
    secSlot.classList.add('active');
    secMahjong.classList.remove('active');
  } else {
    tabMahjong.classList.add('active');
    tabSlot.classList.remove('active');
    secMahjong.classList.add('active');
    secSlot.classList.remove('active');
  }
}

function prosesSlot() {
  const input = document.getElementById('inputSlot').value.trim();
  const outputDiv = document.getElementById('outputSlot');

  if (!input) {
    outputDiv.innerHTML = EMPTY_OUTPUT;
    return;
  }

  const lines = input.split('\n').map(line => line.trim()).filter(line => line !== '');
  const transaksiList = [];

  for (let i = 0; i < lines.length; i += 10) {
    if (i + 9 < lines.length) {
      transaksiList.push({
        gameName: lines[i],
        provider: lines[i + 1],
        roundId: lines[i + 2],
        username: lines[i + 4],
        tipe: lines[i + 7],
        nominal: lines[i + 8].replace(/[^0-9,.]/g, '')
      });
    }
  }

  const gabunganData = {};

  transaksiList.forEach(transaksi => {
    const key = `${transaksi.username}_${transaksi.roundId}`;

    if (!gabunganData[key]) {
      gabunganData[key] = {
        username: transaksi.username,
        provider: transaksi.provider,
        gameName: transaksi.gameName,
        roundId: transaksi.roundId,
        kemenangan: '-'
      };
    }

    if (transaksi.tipe.toLowerCase() === 'credit') {
      gabunganData[key].kemenangan = transaksi.nominal;
    }
  });

  let htmlTable = `
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Nama</th>
          <th>Nomor</th>
          <th>Provider</th>
          <th>Game Name</th>
          <th>Round ID</th>
          <th>Super</th>
          <th>Jumlah Kemenangan</th>
          <th>Nominal Bet</th>
        </tr>
      </thead>
      <tbody id="tabelSlotBody">`;

  Object.values(gabunganData).forEach(item => {
    htmlTable += `
      <tr>
        <td class="cell-user">${item.username}</td>
        <td class="cell-muted">-</td>
        <td class="cell-muted">-</td>
        <td>${item.provider}</td>
        <td>${item.gameName}</td>
        <td class="cell-code">${item.roundId}</td>
        <td class="cell-muted">-</td>
        <td class="cell-credit">${item.kemenangan}</td>
        <td class="cell-muted">-</td>
      </tr>`;
  });

  htmlTable += '</tbody></table>';
  outputDiv.innerHTML = htmlTable;
}

function salinSlotBody() {
  copyTableBody('tabelSlotBody', 'btnCopySlot');
}

function resetSlot() {
  document.getElementById('inputSlot').value = '';
  prosesSlot();
}

function prosesMahjong() {
  const input = document.getElementById('inputMahjong').value.trim();
  const outputDiv = document.getElementById('outputMahjong');

  if (!input) {
    mahjongParsedData = [];
    outputDiv.innerHTML = EMPTY_OUTPUT;
    return;
  }

  const lines = input.split('\n').map(line => line.trim()).filter(line => line !== '');
  const grouped = {};

  let currentPeriode = '';
  let currentUser = '';
  let currentGame = '';
  let currentProvider = '';
  let totalCreditAll = 0;
  let totalDebitAll = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (nextLine.toLowerCase().includes('pgsoft')) {
      currentGame = line;
      currentProvider = normalizeProvider(nextLine);
    }

    if (line.toLowerCase().includes('ext. id')) {
      const match = line.match(/ext\. id\s*:\s*([a-z0-9\-]+)/i);

      if (match) {
        const parts = match[1].split('-');
        currentPeriode = parts[1] || match[1];

        if (!grouped[currentPeriode]) {
          grouped[currentPeriode] = {
            user: '',
            game: '',
            provider: '',
            credit: 0,
            debit: 0
          };
        }

        const possibleUser = lines[i + 1] || '';

        if (/^[a-zA-Z0-9_\-]+$/.test(possibleUser)) {
          currentUser = possibleUser;
        } else if (!possibleUser.includes(':') && !/\d{2}\s\w{3}/.test(possibleUser)) {
          currentUser = possibleUser.trim();
        }

        grouped[currentPeriode].user = currentUser;
        grouped[currentPeriode].game = currentGame;
        grouped[currentPeriode].provider = currentProvider || 'PGSOFT';
      }
    }

    if (line.toLowerCase().startsWith('credit')) {
      const amount = parseInt(nextLine.replace(/[^\d]/g, ''), 10);

      if (!isNaN(amount) && grouped[currentPeriode]) {
        grouped[currentPeriode].credit += amount;
        totalCreditAll += amount;
      }
    }

    if (line.toLowerCase().startsWith('debit')) {
      const amount = parseInt(nextLine.replace(/[^\d]/g, ''), 10);

      if (!isNaN(amount) && grouped[currentPeriode]) {
        grouped[currentPeriode].debit += amount;
        totalDebitAll += amount;
      }
    }
  }

  mahjongParsedData = Object.entries(grouped).map(([periode, data]) => ({
    periode,
    user: data.user || '-',
    game: data.game || '-',
    provider: data.provider || 'PGSOFT',
    credit: data.credit,
    debit: data.debit
  }));

  renderCurrentMahjongTable();

  const totalKemenangan = totalCreditAll - totalDebitAll;
  const totalTaruhan = totalDebitAll;

  if (totalTaruhan > 0 && totalKemenangan / totalTaruhan >= 300) {
    showBonusAlert();
  }
}

function normalizeProvider(provider) {
  const cleanedProvider = String(provider || '').replace(/\s+/g, ' ').trim();

  if (/pg\s*soft|pgsoft/i.test(cleanedProvider)) {
    return 'PGSOFT';
  }

  return cleanedProvider || 'PGSOFT';
}

function renderCurrentMahjongTable() {
  if (!mahjongParsedData.length) {
    document.getElementById('outputMahjong').innerHTML = EMPTY_OUTPUT;
    return;
  }

  if (mahjongSlotMode) {
    renderSlotClaimTable(mahjongParsedData);
  } else {
    renderMahjongTable(mahjongParsedData);
  }
}

function renderMahjongTable(dataList) {
  let htmlTable = `
    <table>
      <thead>
        <tr>
          <th>USER ID</th>
          <th>NAMA REKENING</th>
          <th>NOMOR REKENING</th>
          <th>PERMAINAN</th>
          <th>KODE TICKET</th>
          <th>TOTAL KEMENANGAN</th>
          <th>NILAI TARUHAN</th>
        </tr>
      </thead>
      <tbody id="tabelMahjongBody">`;

  dataList.forEach(data => {
    htmlTable += `
      <tr>
        <td class="cell-user">${data.user}</td>
        <td class="cell-muted">-</td>
        <td class="cell-muted">-</td>
        <td>${data.game}</td>
        <td class="cell-code">${data.periode}</td>
        <td class="cell-credit">${formatKoma(data.credit)}</td>
        <td class="cell-debit">${formatKoma(data.debit)}</td>
      </tr>`;
  });

  htmlTable += '</tbody></table>';
  document.getElementById('outputMahjong').innerHTML = htmlTable;
}

function renderSlotClaimTable(dataList) {
  let htmlTable = `
    <table>
      <thead>
        <tr>
          <th>USER ID</th>
          <th>NAMA</th>
          <th>NOMOR</th>
          <th>PROVIDER</th>
          <th>GAME NAME</th>
          <th>ROUND ID</th>
          <th>SUPER</th>
          <th>JUMLAH KEMENANGAN</th>
          <th>NOMINAL BET</th>
        </tr>
      </thead>
      <tbody id="tabelMahjongBody">`;

  dataList.forEach(data => {
    htmlTable += `
      <tr>
        <td class="cell-user">${data.user}</td>
        <td class="cell-muted">-</td>
        <td class="cell-muted">-</td>
        <td>${data.provider || 'PGSOFT'}</td>
        <td>${data.game}</td>
        <td class="cell-code">${data.periode}</td>
        <td class="cell-muted">-</td>
        <td class="cell-credit">${formatKoma(data.credit)}</td>
        <td class="cell-debit">${formatKoma(data.debit)}</td>
      </tr>`;
  });

  htmlTable += '</tbody></table>';
  document.getElementById('outputMahjong').innerHTML = htmlTable;
}

function toggleMahjongFormat() {
  const toggle = document.getElementById('toggleMahjongToSlot');
  mahjongSlotMode = Boolean(toggle && toggle.checked);
  renderCurrentMahjongTable();
}

function salinMahjongBody() {
  copyTableBody('tabelMahjongBody', 'btnCopyMahjong');
}

function copyTableBody(tbodyId, buttonId) {
  const tbody = document.getElementById(tbodyId);
  const btn = document.getElementById(buttonId);

  if (!tbody || !btn) {
    return;
  }

  const range = document.createRange();
  range.selectNode(tbody);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  try {
    document.execCommand('copy');
    btn.innerHTML = '<i class="fas fa-check-circle"></i> BERHASIL DISALIN!';

    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy"></i> SALIN DATA';
    }, 1200);
  } catch (error) {
    console.error('Gagal menyalin tabel:', error);
  }

  window.getSelection().removeAllRanges();
}

function resetMahjong() {
  document.getElementById('inputMahjong').value = '';
  mahjongParsedData = [];
  setMahjongSlotMode(false);
  document.getElementById('outputMahjong').innerHTML = EMPTY_OUTPUT;
}

function setMahjongSlotMode(enabled) {
  mahjongSlotMode = Boolean(enabled);

  const toggle = document.getElementById('toggleMahjongToSlot');
  if (toggle) {
    toggle.checked = mahjongSlotMode;
  }
}

function formatKoma(num) {
  return Number(num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function showBonusAlert() {
  document.getElementById('bonusAlert').style.display = 'flex';
}

function closeBonusAlert() {
  document.getElementById('bonusAlert').style.display = 'none';
}
