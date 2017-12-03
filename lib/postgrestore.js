'use strict';

var util = require('util');
var bcrypt = require('bcrypt');
var TokenStore = require('passwordless-tokenstore');
var pg = require('pg');

/**
 * Constructor of PostgreStore
 * @param {String} conString URI as defined by the PostgreSQL specification. Please
 * check the documentation for details:
 * https://github.com/brianc/node-postgres
 * @param {Object} [options] Combines both the options for the PostgreClient as well
 * as the options for PostgreStore. For the PostgreClient options please refer back to
 * the documentation. PostgreStore understands the following options:
 * (1) { pgstore: { table: string }} to change the name of the table used. Defaults to: 'passwordless'
 * (2) { pgstore: { pgPoolSize: integer }} to change the pool size of PostgreSQL client. Defaults to: 10
 * @constructor
 */
function PostgreStore(conString, options) {
    if(!conString){
        throw new Error('Connection String is missing.');
    }
	this._options = options || {};
	this._options.pgstore = this._options.pgstore || {};
	this._table = this._options.pgstore.table || 'passwordless';

    this._client = new pg.Pool({
        connectionString: conString,
        max: this._options.pgstore.pgPoolSize || 10
    });

    delete this._options.pgstore;

    var self = this;
    this._client.connect(function(err, client) {
        if(err) {
            throw new Error('Could not connect to Postgres database, with error : ' + err);
        }
    });
}

util.inherits(PostgreStore, TokenStore);

/**
 * Checks if the provided token / user id combination exists and is
 * valid in terms of time-to-live. If yes, the method provides the
 * the stored referrer URL if any.
 * @param  {String}   token to be authenticated
 * @param  {String}   uid Unique identifier of an user
 * @param  {Function} callback in the format (error, valid, referrer).
 * In case of error, error will provide details, valid will be false and
 * referrer will be null. If the token / uid combination was not found
 * found, valid will be false and all else null. Otherwise, valid will
 * be true, referrer will (if provided when the token was stored) the
 * original URL requested and error will be null.
 */
PostgreStore.prototype.authenticate = function(token, uid, callback) {
	if(!token || !uid || !callback) {
		throw new Error('TokenStore:authenticate called with invalid parameters');
	}

    var self = this;

    self._client.query('SELECT * FROM ' + self._table + ' WHERE uid=$1',[uid], function(err, result) {
        if(err) {
            return callback(err, false, null);
        }
        else if(!result || !result.rows || !result.rows.length || (result && result.rows && result.rows.length > 1)) {
            return callback(null, false, null);
        } else if(Date.now() > result.rows[0].ttl) {
            callback(null, false, null);
        } else {
            bcrypt.compare(token, result.rows[0].token, function(err, res) {
                if(err) {
                    callback(err, false, null);
                } else if(res) {
                    callback(null, true, result.rows[0].origin || "");
                } else {
                    callback(null, false, null);
                }
            });
        }
    });
};

/**
 * Stores a new token / user ID combination or updates the token of an
 * existing user ID if that ID already exists. Hence, a user can only
 * have one valid token at a time
 * @param  {String}   token Token that allows authentication of _uid_
 * @param  {String}   uid Unique identifier of an user
 * @param  {Number}   msToLive Validity of the token in ms
 * @param  {String}   originUrl Originally requested URL or null
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() if the token was successully stored / updated
 */
PostgreStore.prototype.storeOrUpdate = function(token, uid, msToLive, originUrl, callback) {
	if(!token || !uid || !msToLive || !callback || !isNumber(msToLive)) {
		throw new Error('TokenStore:storeOrUpdate called with invalid parameters');
	}

	var self = this;
    bcrypt.hash(token, 10, function(err, hashedToken) {
        if(err) {
            return callback(err);
        }

        self._client.query('INSERT INTO ' + self._table + '(uid,token, origin, ttl) VALUES($1, $2, $3, $4)',[uid, hashedToken, originUrl, (Date.now() + msToLive)], function(err) {
            if(err){
                self._client.query('UPDATE ' + self._table + ' SET token=$1, origin=$2, ttl=$3 WHERE uid=$4',[hashedToken, originUrl, (Date.now() + msToLive), uid], function(err) {
                    if(err){
                        callback(err);
                    }
                    else{
                        callback();
                    }
                    //self._client.end();
                });
            }
            else{
                callback();
            }
        });
    });
};

/**
 * Invalidates and removes a user and the linked token
 * @param  {String} uid  user ID
 * @param  {Function} callback called with callback(error) in case of an
 * error or as callback() if the uid was successully invalidated
 */
PostgreStore.prototype.invalidateUser = function(uid, callback) {
	if(!uid || !callback) {
		throw new Error('TokenStore:invalidateUser called with invalid parameters');
	}

    this._client.query('DELETE FROM ' + this._table + ' WHERE uid=$1',[uid], function(err) {
        if(err){
            callback(err);
        }
        else{
            callback();
        }
    });
};

/**
 * Removes and invalidates all token
 * @param  {Function} callback Called with callback(error) in case of an
 * error or as callback() otherwise
 */
PostgreStore.prototype.clear = function(callback) {
	if(!callback) {
		throw new Error('TokenStore:clear called with invalid parameters');
	}
    this._client.query('DELETE FROM ' + this._table, function(err) {
        if(err){
            callback(err);
        }
        else{
            callback();
        }
    });
};

/**
 * Number of tokens stored (no matter the validity)
 * @param  {Function} callback Called with callback(null, count) in case
 * of success or with callback(error) in case of an error
 */
PostgreStore.prototype.length = function(callback) {
	if(!callback) {
		throw new Error('TokenStore:length called with invalid parameters');
	}

    this._client.query('SELECT COUNT(uid) FROM ' + this._table, function(err, result) {
        if(err){
            callback(err);
        }
        else{
            callback(null, parseInt(result.rows[0].count));
        }
    });
};

PostgreStore.prototype.disconnect = function() {
    self._client.done();
};

function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = PostgreStore;
