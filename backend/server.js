const express = require('express');
const bodyParser = require('body-parser');
const registrationRoutes = require('./routes/registration');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(bodyParser.json());

app.use('/api/registration', registrationRoutes);
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Hospital Registration API Running');
});

const port = process.env.PORT || 3000;
const ip = 'localhost';
app.listen(port, ip, () => {
  console.log(`The Server running on http://${ip}:${port}`);
});
