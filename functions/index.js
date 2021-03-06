const functions = require('firebase-functions');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const engines = require('consolidate');
const FirestoreStore = require('firestore-store')(session);
const ResponseHeaders = require('./middleware/SetResponseHeaders');
const cors = require('cors');
const FirestoreInstance = require('./middleware/FirestoreInstance');

const Auth = require('./routes/Auth');
const RepoCommitCount = require('./routes/RepoCommitCount');
const Repos = require('./routes/userdata/Repos');
const Issues = require('./routes/Issues');
const Following = require('./routes/userdata/Following');
const Starred = require('./routes/userdata/Starred');
const Search = require('./routes/Search');

const app = express();
const sessionSecret = functions.config().session.secret;
const ghs = functions.config().appauth.ghs;

if (!sessionSecret || !ghs) {
  console.error('FATAL ERROR');
  process.exit(1);
}

var userSession = session({
  store: new FirestoreStore({
    database: FirestoreInstance
  }),
  name: '__session',
  secret: sessionSecret,
  proxy: true,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 300000,
    secure: true,
    httpOnly: false
  }
});

app.engine('hbs', engines.handlebars);
app.set('views', './views');
app.set('view engine', 'hbs');

app.use(cors());
app.use(helmet());
app.use(helmet.hsts({
  maxAge: 31536000
}));
app.options('*', cors());
app.use(userSession);
app.use(express.json());
app.use(ResponseHeaders);
app.use('/__/auth', Auth);
app.use('/repocommitcount', RepoCommitCount);
app.use('/user/repos', Repos);
app.use('/issues', Issues);
app.use('/user/following', Following);
app.use('/user/starred', Starred);
app.use('/search/repositories', Search);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
app.listen(80, function () {
  console.log('CORS-enabled web server listening on port 80');
});

exports.app = functions.https.onRequest(app);
