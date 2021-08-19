require("dotenv").config();

const auth = require("./auth");

(async () => {
  await auth.auth(process.env.PHONE_NUMBER);
})();
