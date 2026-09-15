require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from root directory
app.use(express.static(path.join(__dirname)));

app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get(['/admin', '/admin/login', '/admin/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

supabase.from('categories').select('id').limit(1)
  .then(({ error }) => console.log(error ? `Supabase error: ${error.message}` : 'Supabase connected'))
  .catch(error => console.error(`Supabase connection error: ${error.message}`));

// Serve index for catalog
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
});
