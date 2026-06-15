const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '0', 10);
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const SENDER_NAME = process.env.SENDER_NAME || 'euSeguro';
app.use(express.json());
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/health', (req, res) => { res.json({ ok: true, brevo_key: BREVO_API_KEY ? 'set' : 'missing', brevo_list: BREVO_LIST_ID || 'missing' }); });
function digits(str) { return String(str || '').replace(/\D/g, ''); }
app.post('/api/lead', async (req, res) => {
  try {
    const { nome, telefone, placa, email, possui_seguro } = req.body || {};
    if (!nome || !telefone || !placa || !email || !possui_seguro) { return res.status(400).json({ ok: false, error: 'Preencha todos os campos.' }); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { return res.status(400).json({ ok: false, error: 'E-mail invalido.' }); }
    if (!BREVO_API_KEY || !BREVO_LIST_ID) { return res.status(500).json({ ok: false, error: 'Servico indisponivel no momento.' }); }
    const smsIntl = digits(telefone) ? '+55' + digits(telefone) : '';
    const r = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', 'accept': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), attributes: { NOME: nome.trim(), TELEFONE: telefone.trim(), SMS: smsIntl, PLACA: placa.trim().toUpperCase(), POSSUI_SEGURO: possui_seguro }, listIds: [BREVO_LIST_ID], updateEnabled: true }) });
    if (!r.ok && r.status !== 204) { const d = await r.text().catch(() => ''); console.error('Erro Brevo:', r.status, d); return res.status(502).json({ ok: false, error: 'Nao foi possivel registrar agora. Tente novamente.' }); }
    if (NOTIFY_EMAIL && SENDER_EMAIL) { fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', 'accept': 'application/json' }, body: JSON.stringify({ sender: { name: SENDER_NAME, email: SENDER_EMAIL }, to: [{ email: NOTIFY_EMAIL }], subject: 'Novo lead euSeguro: ' + nome.trim(), htmlContent: '<p>Nome: ' + nome.trim() + '</p><p>Telefone: ' + telefone.trim() + '</p><p>Email: ' + email.trim() + '</p><p>Placa: ' + placa.trim().toUpperCase() + '</p><p>Possui seguro: ' + possui_seguro + '</p>' }) }).catch(e => console.error('notify fail', e.message)); }
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: 'Erro interno. Tente novamente.' }); }
});
app.listen(PORT, () => { console.log('euSeguro LP na porta ' + PORT); });