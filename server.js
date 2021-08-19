require("dotenv").config();

const express = require("express");
const axios = require("axios");
const sortBy = require("lodash.sortby");

const api = require("./api");
const auth = require("./auth");

const NA_bot = "gamezbd_na_bot";
const EU_bot = "gamezbd_eu_bot";

const app = express();

//Authenticate when server starts
(async () => {
  await auth.auth(process.env.PHONE_NUMBER);
})();

app.get("/cron", async (request, response) => {
  const [botNA, botEU] = await Promise.all([getBotInfo(NA_bot), getBotInfo(EU_bot)]);

  pressBossBtn(botNA.inputPeer, botNA.msg_id, botNA.buttons);
  pressBossBtn(botEU.inputPeer, botEU.msg_id, botEU.buttons);

  botNA.name = "NA";
  botEU.name = "EU";
  await processBossMsg(botNA, botEU);

  response.status(200).send("Job done!");
});
//process.env.PORT
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

async function pressBossBtn(inputPeer, msg_id, buttons) {
  try {
    await api.call("messages.getBotCallbackAnswer", {
      game: false,
      peer: inputPeer,
      msg_id: msg_id,
      data: buttons[1].data,
    });
  } catch (e) {}
}

async function getBotInfo(bot_name) {
  const resolvedPeer = await api.call("contacts.resolveUsername", {
    username: bot_name,
  });

  const inputPeer = {
    _: "inputPeerUser",
    user_id: resolvedPeer.users[0].id,
    access_hash: resolvedPeer.users[0].access_hash,
  };

  const firstHistoryResult = await api.call("messages.getHistory", {
    peer: inputPeer,
    limit: 1,
  });

  const buttons = firstHistoryResult.messages[0].reply_markup.rows[0].buttons;
  const msg_id = firstHistoryResult.messages[0].id;

  return { inputPeer: inputPeer, msg_id: msg_id, buttons: buttons };
}

async function processBossMsg(botNA, botEU) {
  var promises = [];
  var na = new Promise(function (resolve, reject) {
    promises.push({ resolve: resolve, reject: reject });
  });
  var eu = new Promise(function (resolve, reject) {
    promises.push({ resolve: resolve, reject: reject });
  });

  api.getMTProto().updates.on("updates", ({ updates }) => {
    const editedMessages = updates.filter((update) => update._ === "updateEditMessage").map(({ message }) => message);

    editedMessages.forEach((message) => {
      if (message.id === botNA.msg_id) {
        postBossMsg(message, botNA).then(() => {
          promises[0].resolve(true);
        });
      } else if (message.id === botEU.msg_id) {
        postBossMsg(message, botEU).then(() => {
          promises[1].resolve(true);
        });
      }
    });
  });
  
  await Promise.all([na, eu]).then(() => {
    api.getMTProto().updates.removeAllListeners("updates");
  });
}

async function postBossMsg(message, bot) {
  let resultJson = convertMsg(message.message);
  let config = {
    headers: {
      [process.env.PRESHARED_AUTH_HEADER_KEY]: process.env.PRESHARED_AUTH_HEADER_VALUE,
    },
  };

  await axios
    .post(
      `${process.env.CF_WORKER_URL}/bosses`,
      {
        name: bot.name,
        contents: JSON.stringify(resultJson),
      },
      config
    )
    .catch((error) => {
      console.error(error);
    });
}

function convertMsg(msg) {
  msg = msg.substring(msg.indexOf("\n") + 1);
  msg = msg.substring(msg.indexOf("\n") + 1);
  msg = msg.substring(msg.indexOf("\n") + 1);

  var data = msg.split("\n\n");
  var bossesData = [];

  data.forEach((channelText) => {
    const chName = channelText.substring(0, channelText.indexOf("\n"));
    let tmp = mapLinetoArray(chName, channelText.substring(channelText.indexOf("\n") + 1));
    bossesData = bossesData.concat(tmp);
  });

  bossesData = sortBy(bossesData, "time");

  return { status: 200, data: bossesData };
}

function mapLinetoArray(chName, data) {
  var ret = [];
  var splitArr = data.split("\n");

  splitArr.forEach((element) => {
    let bossData = element.split(" spawns ");
    bossData[0] = bossData[0].replace("- ", "");
    bossData[1] = bossData[1].replace(/ *\([^)]*\) */g, "");
    bossData[1] = new Date(bossData[1] + " GMT");

    let tmp = { name: bossData[0], server: chName, time: bossData[1] };
    ret.push(tmp);
  });

  return ret;
}
