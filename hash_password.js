const bcrypt = require('bcrypt');
const saltRounds = 10;
const plainPassword = 'adminpassword'; // Choose a strong password

bcrypt.hash(plainPassword, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Your hashed password is:');
    console.log(hash);
});