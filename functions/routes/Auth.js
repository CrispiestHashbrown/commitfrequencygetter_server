const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const request = require('request');
const crypto = require('crypto');
const base64url = require('base64url');
const FirestoreInstance = require('../middleware/FirestoreInstance');
const authHeaderParser = require('../helpers/AuthHeaderParser');
const tokenVerifier = require('../helpers/TokenVerifier');

const ghid = functions.config().appauth.ghid;
const scopeTruth = 'public_repo,read:user,user:follow';

router.use(express.json());

// -- routes --
// Redirect user for GitHub auth
router.get('/', (req, res) => {
  const appScopes = req.query.scope;
  if (appScopes !== scopeTruth) {
    return res.status(400).send('Bad request.');
  }

  const stateValue = unguessableRandomString(20);
  req.session.stateValue = stateValue;
  const url = `https://github.com/login/oauth/authorize?client_id=${ghid}&scope=${scopeTruth}&state=${stateValue}`;
  res.redirect(301, url);
});

// Auth handler with access code
router.get('/handler', (req, res) => {
  const sessionStateValue = req.session.stateValue;
  const queryState = req.query.state;
  const code = req.query.code;
  if (!code || !sessionStateValue || queryState !== sessionStateValue) {
    return res.status(400).send('Bad request');
  }

  const options = {
    uri: 'https://github.com/login/oauth/access_token',
    method: 'POST',
    body: {
      client_id: ghid,
      client_secret: functions.config().appauth.ghs,
      code: code,
      state: sessionStateValue
    },
    headers: {
      'Accept': 'application/json'
    },
    json: true
  };

  function callback (error, response, body) {
    if (!error && response.statusCode === 200) {
      // TODO: clean up Firestore sessions
      const token = body.access_token;
      res.render('../views/handler', { token: token });
    } else {
      console.log(`${response.statusCode} error: ${error}`);
      res.status(500).send('Error while authenticating with GitHub.');
    }
  }

  request.post(options, callback);
});

// Verify token
router.get('/verify', (req, res) => {
  const authHeader = req.get('Authorization');
  tokenVerifier(authHeader, function (verifierRes, verifierErr) {
    if (!verifierRes) {
      res.status(400).send(`Error verifying token: ${verifierErr}`);
    } else {
      res.status(200).send('Token verified.');
    }
  });
});

// DELETE to revoke app access grant
router.delete('/grants', (req, res) => {
  const authHeader = req.header('Authorization');
  const ght = authHeaderParser(authHeader);
  if (!ght) {
    res.status(400).send('Invalid authorization.');
  } else {
    const url = `https://api.github.com/applications/${ghid}/grants/${ght}`;
    request.delete(url, {
      'auth': {
        'user': ghid,
        'pass': functions.config().appauth.ghs
      },
      headers: {
        'Authorization': `bearer ${ght}`,
        'User-Agent': 'CrispiestHashbrown',
        'Accept': 'application/json'
      }
    }, function (error, response) {
      if (!error && response.statusCode === 204) {
        return res.status(204).send('No Content');
      } else {
        return res.status(400).send('Failed to revoke token grants.');
      }
    });
  }
});

// Generate unguessable random string
function unguessableRandomString (size) {
  return base64url(crypto.randomBytes(size));
}

module.exports = router;
