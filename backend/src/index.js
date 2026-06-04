require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./database/connection');
const { startAssignmentJob } = require('./jobs/assignment.job');
const { startReminderJob }   = require('./jobs/reminder.job');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
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
