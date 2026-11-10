const toast = document.getElementById('toast');
let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
document.getElementById('newDeliveryBtn').addEventListener('click', () => {
  document.getElementById('deliveryDialog').showModal();
});
document.getElementById('deliveryForm').addEventListener('submit', event => {
  event.preventDefault();
  const recipient = document.getElementById('recipient').value.trim();
  const invoice = document.getElementById('invoice').value.trim();
  const date = document.getElementById('deliveryDate').value;
  if (!recipient || !invoice || !date) return;
  const tbody = document.querySelector('#deliveryTable tbody');
  const id = 'EP-' + (1050 + tbody.rows.length - 5);
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'short'}).replace('.', '');
  const row = tbody.insertRow(0);
  row.innerHTML = `<td><strong>#${id}</strong><small>NF-e ${escapeHTML(invoice)}</small></td><td>${escapeHTML(recipient)}</td><td>${formattedDate}</td><td><span class="status warning"><i></i>Aguardando</span></td><td><button class="more-btn" aria-label="Detalhes da entrega">•••</button></td>`;
  document.getElementById('deliveryDialog').close();
  event.target.reset();
  notify('Entrega registrada com sucesso! (demonstração local)');
  updateCount();
});
function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function updateCount() {
  const rows = document.querySelectorAll('#deliveryTable tbody tr').length;
  document.getElementById('resultCount').textContent = `Mostrando ${rows} entrega(s) na tabela`;
}
document.getElementById('searchInput').addEventListener('input', event => {
  const term = event.target.value.toLocaleLowerCase('pt-BR');
  let visible = 0;
  document.querySelectorAll('#deliveryTable tbody tr').forEach(row => {
    const show = row.textContent.toLocaleLowerCase('pt-BR').includes(term);
    row.hidden = !show;
    if (show) visible++;
  });
  document.getElementById('resultCount').textContent = `Mostrando ${visible} de ${document.querySelectorAll('#deliveryTable tbody tr').length} entrega(s)`;
});
document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', event => {
  if (event.target.files.length) notify(`Arquivo selecionado: ${event.target.files[0].name}. O envio real precisa de backend.`);
});
document.getElementById('reviewBtn').addEventListener('click', () => {
  document.querySelector('#entregas').scrollIntoView({behavior:'smooth'});
  document.getElementById('searchInput').value = 'Pendência';
  document.getElementById('searchInput').dispatchEvent(new Event('input'));
  notify('Filtrando entregas com pendências.');
});
document.getElementById('reportBtn').addEventListener('click', () => notify('Demonstração: o pacote de faturamento seria preparado com os comprovantes validados.'));
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = [...document.querySelectorAll('#deliveryTable tr')].filter(row => !row.hidden);
  const csv = rows.map(row => [...row.querySelectorAll('th,td')].slice(0,4).map(cell => '"' + cell.innerText.replace(/"/g,'""').replace(/\n/g,' ') + '"').join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'entregaprova-entregas.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  notify('Arquivo CSV exportado.');
});
document.getElementById('periodBtn').addEventListener('click', () => notify('Gráfico demonstrativo: os dados são fictícios.'));
document.getElementById('notificationBtn').addEventListener('click', () => notify('Você está em dia com as notificações de demonstração.'));
document.getElementById('helpBtn').addEventListener('click', () => notify('Canal de suporte demonstrativo — conecte aqui seu atendimento.'));
document.getElementById('viewAllBtn').addEventListener('click', event => { event.preventDefault(); document.getElementById('searchInput').value=''; document.getElementById('searchInput').dispatchEvent(new Event('input')); notify('Todas as entregas de demonstração estão exibidas.'); });
document.querySelectorAll('.more-btn').forEach(button => button.addEventListener('click', () => notify('Detalhes da entrega — esta é uma interface demonstrativa.')));
function updateCountInitial() { document.getElementById('resultCount').textContent = `Mostrando ${document.querySelectorAll('#deliveryTable tbody tr').length} entregas recentes`; }
updateCountInitial();
