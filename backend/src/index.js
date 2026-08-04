require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { connectDB } = require('./database/connection');
const { startAssignmentJob } = require('./jobs/assignment.job');
const { startReminderJob }   = require('./jobs/reminder.job');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Demasiados intentos, intenta en 15 minutos' },
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// TEMPORAL — diagnóstico de envío de correo vía Resend. Remover tras depurar.
app.get('/test-mail', async (req, res) => {
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM || 'Urbalert <noreply@urbalert.site>',
      to: ['cruzfernando3b46@gmail.com'],
      subject: 'Test Urbalert',
      html: '<p>Test de correo desde Railway</p>'
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.json({ ok: false, error: err.message, detail: JSON.stringify(err) });
  }
});

// Routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/validation', require('./routes/validation'));
app.use('/api/assignment',    require('./routes/assignment'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/heatmap',       require('./routes/heatmap'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/users',         require('./routes/users'));

async function start() {
  await connectDB();
  startAssignmentJob();
  startReminderJob();
  app.listen(PORT, () => {
    console.log(`Urbalert backend corriendo en http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Error al iniciar el servidor:', err.message);
  process.exit(1);
});
