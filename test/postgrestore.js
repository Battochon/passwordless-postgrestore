'use strict';

var expect = require('chai').expect;
var uuid = require('node-uuid');
var chance = new require('chance')();

var PostgreStore = require('../');
var TokenStore = require('passwordless-tokenstore');

var pg = require("pg");
var pgClient = null;
var conString = 'postgres://postgres:password@localhost/postgres';

var standardTests = require('passwordless-tokenstore-test');

function TokenStoreFactory() {
	return new PostgreStore(conString);
}

var pgDoneCallback;

var beforeEachTest = function(done) {
    if(!pgClient) {
        pg.connect(conString, function(err, newClient, pgDone) {
            if(err) {
                done(err);
                throw new Error('Could not connect to Postgres database, with error : ' + err);
            }
            pgClient = newClient;
            done();
            pgDoneCallback = pgDone;
        });
    }else{
        done();
    }
};

var afterEachTest = function(done) {
    pgDoneCallback();
    done();
};

// Call all standard tests
standardTests(TokenStoreFactory, beforeEachTest, afterEachTest, 1000);

describe('Specific tests', function() {

	beforeEach(function(done) {
		beforeEachTest(done);
	});

	afterEach(function(done) {
		afterEachTest(done);
	});

	it('should allow the instantiation with an empty constructor', function () {
		expect(function() { new PostgreStore() }).to.not.throw;
	});

	it('should allow the instantiation with host and port but no options', function () {
		expect(function() { new PostgreStore(conString) }).to.not.throw;
	});

	it('should allow proper instantiation', function () {
		expect(function() { TokenStoreFactory() }).to.not.throw;
	});

	it('should store tokens only in their hashed form', function(done) {
		var store = TokenStoreFactory();
		var user = chance.email();
		var token = uuid.v4();
		store.storeOrUpdate(token, user, 
			1000*60, 'http://' + chance.domain() + '/page.html', 
			function() {
                pgClient.query('SELECT * FROM passwordless WHERE uid=$1',[user], function(err, obj) {
					expect(err).to.not.exist;
					expect(obj).to.exist;
					expect(obj.rows[0].token).to.exist;
					expect(obj.rows[0].token).to.not.equal(token);
					done();
				})
			});
	});

	it('should store tokens not only hashed but also salted', function(done) {
		var store = TokenStoreFactory();
		var user = chance.email();
		var token = uuid.v4();
		var hashedToken1;
		store.storeOrUpdate(token, user, 
			1000*60, 'http://' + chance.domain() + '/page.html', 
			function() {
                pgClient.query('SELECT * FROM passwordless WHERE uid=$1',[user], function(err, obj) {
					expect(err).to.not.exist;
					expect(obj).to.exist;
					expect(obj.rows[0].token).to.exist;
					hashedToken1 = obj.rows[0].token;
					store.storeOrUpdate(token, user, 
						1000*60, 'http://' + chance.domain() + '/page.html', 
						function() {
                            pgClient.query('SELECT * FROM passwordless WHERE uid=$1',[user], function(err, obj) {
								expect(err).to.not.exist;
								expect(obj).to.exist;
								expect(obj.rows[0].token).to.exist;
								expect(obj.rows[0].token).to.not.equal(hashedToken1);
								done();
							});						
						});
				})
			});		
	});
});