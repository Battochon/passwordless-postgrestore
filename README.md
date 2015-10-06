# Passwordless-PostgreStore

This module provides token storage for [Passwordless](https://github.com/florianheinemann/passwordless), a node.js module for express that allows website authentication without password using verification through email or other means. Visit the project's [website](https://passwordless.net) for more details.

Tokens are stored in a PostgreSQL database and are hashed and salted using [bcrypt](https://github.com/ncb000gt/node.bcrypt.js/).

## Usage

First, install the module:

`$ npm install passwordless-postgrestore --save`

Afterwards, follow the guide for [Passwordless](https://github.com/florianheinemann/passwordless). A typical implementation may look like this:

```javascript
var passwordless = require('passwordless');
var PostgreStore = require('passwordless-postgrestore');

passwordless.init(new PostgreStore('postgres://user:password@localhost/database'));

passwordless.addDelivery(
    function(tokenToSend, uidToSend, recipient, callback) {
        // Send out a token
    });
    
app.use(passwordless.sessionSupport());
app.use(passwordless.acceptToken());
```

## Initialization

```javascript
new PostgreStore(connectionString, [options]);
```
* **connectionString:** *(String)* Mandatory. PostgreSQL connection string
* **[options]:** *(Object)* Optional. Some configuration option. See below exemple

Example:
```javascript
passwordless.init(new PostgreStore('postgres://user:password@localhost/database', {
    pgstore: {
        table: 'not_default_table_name',    // *(String)* Optional. Use another table to store token, default is 'passwordless'
        pgPoolSize: '100'                   // *(Number)* Optional. Postgre client pool size
    }
}));
```

## PostgreSQL table creation
You could use this SQL statement to create the token table, or you can customize it according to your needs :

```sql
CREATE TABLE passwordless
(
  id serial NOT NULL,
  uid character varying(160),
  token character varying(60) NOT NULL,
  origin text NOT NULL,
  ttl bigint,
  CONSTRAINT passwordless_pkey PRIMARY KEY (id),
  CONSTRAINT passwordless_token_key UNIQUE (token),
  CONSTRAINT passwordless_uid_key UNIQUE (uid)
)
```

## Hash and salt
As the tokens are equivalent to passwords (even though only for a limited time) they have to be protected in the same way. passwordless-postgrestore uses [bcrypt](https://github.com/ncb000gt/node.bcrypt.js/) with automatically created random salts. To generate the salt 10 rounds are used.

## Tests

`$ npm test`

## License

[MIT License](http://opensource.org/licenses/MIT)

## Author
Bruno MARQUES (http://marques.io) (I just adapted code from Florian Heinemann [@thesumofall](http://twitter.com/thesumofall/))
